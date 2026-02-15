import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { Bluetooth, Smartphone, Box, X } from 'lucide-react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import { Base64 } from 'js-base64';
import { useRoute } from '@react-navigation/native';
import { Device } from 'react-native-ble-plx';
import { bleManager } from '@/app/utils/BleService';

// --- SUB COMPONENTS ---
import DeviceLayout from '../DeviceLayout';
import DailySchedule from '../DailySchedule';

// --- IMPORTS ---
import { PatientRecord, Partition } from '../../types';
import PartitionConfig from './PartitionConfig';
import AlarmModal from './AlarmModal';
import { registerForNotifications } from '@/app/utils/NotificationService';

// --- INITIAL STATE ---
export const INITIAL_PATIENT_DATA: PatientRecord = {
  id: 'patient-1',
  name: 'User',
  age: 65,
  riskScore: 0,
  lastLocation: { lat: 10.3292, lng: 123.9063 },
  partitions: Array.from({ length: 4 }).map((_, i) => ({
    id: i + 1,
    label: 'Unassigned',
    medicineName: '',
    pillCount: 0,
    schedule: [] as string[],
    isBlinking: false,
    adherenceRate: 0,
    history: [] as boolean[],
    colorTheme: '#cbd5e1',
    isShortTerm: false,
    durationDays: 0,
    frequencyType: 'daily',
    selectedDays: [] as number[],
    timesPerDay: 0,
    dosage: ''
  }))
};

const FALLBACK_REGION = {
  latitude: 10.3292,
  longitude: 123.9063,
  latitudeDelta: 0.005,
  longitudeDelta: 0.005,
};

interface PatientDashboardProps {
  patient?: PatientRecord;
  onUpdate?: (patient: PatientRecord) => void;
}

// ⚠️ IMPORTANT: Replace with your actual Laptop/Server IP
const BACKEND_URL = "http://192.168.1.5:8080/api/pillbox/status";
const WINDOW_MINUTES = 5;

const Dashboard: React.FC<PatientDashboardProps> = (props) => {
  const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT_DATA);
  const [configPartition, setConfigPartition] = useState<Partition | null>(null);

  // --- ALARM & TIME STATE ---
  const [activeAlarmPartition, setActiveAlarmPartition] = useState<Partition | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- REFS ---
  // Tracks the last dose ID that triggered the modal so we don't popup twice for the same pill
  const lastTriggeredDose = useRef<string | null>(null);

  // --- MAP / TRACKING STATE ---
  const [showFullMap, setShowFullMap] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [userLocation, setUserLocation] = useState<any>(null);
  const [kitLocation, setKitLocation] = useState<any>(null);
  const route = useRoute();
  const isNewDevice = patient.partitions.every(p => !p.label || p.label === 'Unassigned');

  // --- BLE DEVICE HANDLING ---
  const { connectedDevice } = (route.params as { connectedDevice?: Device }) || {};
  const [device, setDevice] = useState<Device | null>(connectedDevice || null);

  // --- 1. REHYDRATE BLE DEVICE ---
  useEffect(() => {
    const fetchLiveDevice = async () => {
      if (connectedDevice?.id) {
        try {
          const devices = await bleManager.connectedDevices(["6E400001-B5A3-F393-E0A9-E50E24DCCA9E"]);
          const liveDevice = devices.find(d => d.id === connectedDevice.id);

          if (liveDevice) {
            await liveDevice.discoverAllServicesAndCharacteristics();
            setDevice(liveDevice);
            console.log("Device rehydrated successfully:", liveDevice.id);
          } else {
            console.log("Device not found. Reconnecting...");
            const freshDevice = await bleManager.connectToDevice(connectedDevice.id);
            await freshDevice.discoverAllServicesAndCharacteristics();
            setDevice(freshDevice);
          }
        } catch (error) {
          console.warn("Failed to rehydrate device:", error);
        }
      }
    };
    fetchLiveDevice();
  }, [connectedDevice]);

  const syncScheduleToHardware = async (updatedPartition: Partition) => {
    if (!device) return;
    try {
      let payload = `${updatedPartition.id - 1}|`; // Hardware uses 0-3
      const timeStrings = updatedPartition.schedule.map(isoStr => {
        const d = new Date(isoStr);
        const hh = d.getHours().toString().padStart(2, '0');
        const mm = d.getMinutes().toString().padStart(2, '0');
        return `${hh}:${mm}`;
      });
      payload += timeStrings.join(',');

      console.log("Syncing to Hardware:", payload);
      await device.writeCharacteristicWithResponseForService(
          "6E400001-B5A3-F393-E0A9-E50E24DCCA9E",
          "6E400003-B5A3-F393-E0A9-E50E24DCCA9E",
          Base64.encode(payload)
      );
    } catch (e) {
      console.error("Sync Failed:", e);
    }
  };

  // --- SCHEDULE CALCULATIONS ---
  const [takenDoses, setTakenDoses] = useState<Set<string>>(new Set());

  const todayDoses = useMemo(() => {
    const doses: any[] = [];
    patient.partitions.forEach(p => {
      if (p.label !== 'Unassigned' && p.medicineName && p.schedule) {
        p.schedule.forEach((timeStr, index) => {
          const doseId = `${p.id}-${index}`;
          doses.push({
            id: doseId,
            medName: p.medicineName,
            time: timeStr,
            status: takenDoses.has(doseId) ? 'taken' : 'pending',
            partitionId: p.id
          });
        });
      }
    });
    return doses.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [patient.partitions, takenDoses]);

  // --- 2. SENSOR POLLING (SMART TRIGGER) ---
  useEffect(() => {
    const pollSensors = async () => {
      try {
        const response = await fetch(BACKEND_URL);
        const sensorData = await response.json();
        const now = new Date();

        todayDoses.forEach(dose => {
          const doseTime = new Date(dose.time);
          const diffInMinutes = (now.getTime() - doseTime.getTime()) / 60000;

          // TRIGGER RULES:
          // 1. Within 5 mins after scheduled time
          // 2. Not already taken
          // 3. Haven't already triggered the modal for this specific dose
          if (
            diffInMinutes >= 0 &&
            diffInMinutes <= WINDOW_MINUTES &&
            dose.status === 'pending' &&
            lastTriggeredDose.current !== dose.id
          ) {
            // Check specific sensor (sensor1, sensor2...)
            const sensorTriggered = sensorData[`sensor${dose.partitionId}`] === 1;

            if (sensorTriggered) {
              console.log(`Sensor ${dose.partitionId} triggered! Launching AlarmModal.`);

              const partitionToAlarm = patient.partitions.find(p => p.id === dose.partitionId);
              if (partitionToAlarm) {
                lastTriggeredDose.current = dose.id; // Mark as handled
                setActiveAlarmPartition(partitionToAlarm);
              }
            }
          }
        });
      } catch (err) {
        // Comment out error logging to avoid spam if server is offline
        // console.error("Sensor polling error:", err);
      }
    };

    const interval = setInterval(pollSensors, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [todayDoses, patient.partitions]);


  // --- 3. UPDATE INVENTORY & STATUS ---
  const handleDoseAction = (dose: any) => {
    if (takenDoses.has(dose.id)) return;

    // A. Update Visual Status
    setTakenDoses(prev => {
      const next = new Set(prev);
      next.add(dose.id);
      return next;
    });

    // B. Update Pill Count
    const updatedPartitions = patient.partitions.map(p => {
      if (p.id === dose.partitionId) {
        return { ...p, pillCount: Math.max(0, p.pillCount - 1) };
      }
      return p;
    });

    handlePatientUpdate({ ...patient, partitions: updatedPartitions });
  };

  const handlePatientUpdate = (updatedPatient: PatientRecord) => {
    setPatient(updatedPatient);
    if (props.onUpdate) props.onUpdate(updatedPatient);
  };

  // --- 4. CLOCK & SCHEDULED ALARM CHECK ---
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      patient.partitions.forEach(p => {
        if (p.label !== 'Unassigned' && p.schedule) {
          p.schedule.forEach((timeStr, index) => {
            const d = new Date(timeStr);
            const doseId = `${p.id}-${index}`;

            // Trigger standard alarm if time matches (regardless of sensor)
            if (
                d.getHours() === currentHour &&
                d.getMinutes() === currentMinute &&
                !takenDoses.has(doseId) &&
                activeAlarmPartition?.id !== p.id &&
                lastTriggeredDose.current !== doseId
            ) {
              lastTriggeredDose.current = doseId;
              setActiveAlarmPartition(p);
            }
          });
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [patient, takenDoses, activeAlarmPartition]);


  // --- 5. ALARM SOUND & TIMEOUT ---
  useEffect(() => {
    let timeoutId: any;
    let soundObject: Audio.Sound | null = null;

    const playSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
            require('@/assets/audio/alarm.wav')
        );
        soundObject = sound;
        await sound.setIsLoopingAsync(true);
        await sound.playAsync();
      } catch (error) {
        console.log("Could not play alarm sound.", error);
      }
    };

    if (activeAlarmPartition) {
      timeoutId = setTimeout(() => setActiveAlarmPartition(null), 60000); // 60s timeout
      playSound();
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (soundObject) {
        soundObject.stopAsync();
        soundObject.unloadAsync();
      }
    };
  }, [activeAlarmPartition]);


  // --- 6. HANDLE ALARM CONFIRMATION ---
  const handleAlarmConfirm = () => {
    if (!activeAlarmPartition) return;

    const doseToMark = todayDoses.find(d =>
      d.partitionId === activeAlarmPartition.id && d.status === 'pending'
    );

    if (doseToMark) {
      handleDoseAction(doseToMark);
    }

    setActiveAlarmPartition(null);
  };

  // --- LOCATION & NOTIFICATION ---
  const requestLocationPermission = async () => {
    setPermissionStatus('undetermined');
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionStatus('denied');
        setUserLocation(null);
        return;
      }
      setPermissionStatus('granted');
      let location = await Location.getCurrentPositionAsync({});
      const userLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      setUserLocation(userLoc);
      setKitLocation({
        latitude: location.coords.latitude + 0.0003,
        longitude: location.coords.longitude + 0.0003,
      });
    } catch (error) {
      console.log("Error requesting location:", error);
      setPermissionStatus('denied');
    }
  };

  useEffect(() => {
    requestLocationPermission();
    registerForNotifications();
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      if (data.screen === 'AlarmModal') {
        const validP = patient.partitions.find(p => p.label !== 'Unassigned');
        if(validP) setActiveAlarmPartition(validP);
      }
    });
    return () => subscription.remove();
  }, []);

  return (
      <View style={{ flex: 1 }}>
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.title}>MedSync</Text>
              </View>
              <Text style={styles.subtitle}>Connected PillBox Device</Text>
            </View>
            <View style={styles.statusContainer}>
              <View style={styles.badgeBlue}>
                <Bluetooth size={14} stroke="#0d9488" />
                <Text style={styles.badgeTextBlue}>LINK</Text>
              </View>
            </View>
          </View>

          {/* GRID */}
          <DeviceLayout
              partitions={patient.partitions}
              onPartitionSelect={setConfigPartition}
          />

          {/* SCHEDULE */}
          <DailySchedule
              todayDoses={todayDoses}
              currentTime={currentTime}
              onDoseAction={handleDoseAction}
              isNewDevice={isNewDevice}
          />

          {/* MAP MODAL */}
          <Modal visible={showFullMap} animationType="slide">
            <View style={styles.fullMapContainer}>
              {userLocation ? (
                  <MapView
                      style={styles.fullMap}
                      initialRegion={userLocation}
                      showsUserLocation={true}
                      showsBuildings
                      showsTraffic
                  >
                    {kitLocation && (
                        <>
                          <Marker coordinate={kitLocation} title="My MedBox" pinColor="red" />
                          <Polyline
                              coordinates={[userLocation, kitLocation]}
                              strokeColor="#2563eb"
                              strokeWidth={2}
                          />
                        </>
                    )}
                  </MapView>
              ) : (
                  <MapView style={styles.fullMap} initialRegion={FALLBACK_REGION} />
              )}

              <TouchableOpacity onPress={() => setShowFullMap(false)} style={styles.closeMapButton}>
                <X size={24} stroke="#fff" />
                <Text style={styles.closeMapText}>CLOSE MAP</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* CONFIG PARTITION MODAL */}
          {configPartition && (
              <Modal animationType="slide" visible={true} onRequestClose={() => setConfigPartition(null)}>
                <PartitionConfig
                    partition={configPartition}
                    onSave={(data) => {
                      const updatedP = { ...configPartition, ...data as Partition };
                      handlePatientUpdate({
                        ...patient,
                        partitions: patient.partitions.map(p => p.id === configPartition.id ? updatedP : p)
                      });
                      syncScheduleToHardware(updatedP);
                      setConfigPartition(null);
                    }}
                    onClose={() => setConfigPartition(null)}
                />
              </Modal>
          )}
        </ScrollView>

        {/* ALARM MODAL */}
        {activeAlarmPartition && (
            <AlarmModal
                partition={activeAlarmPartition}
                onConfirm={handleAlarmConfirm}
                onClose={() => setActiveAlarmPartition(null)}
            />
        )}
      </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  statusContainer: { flexDirection: 'row', gap: 8 },
  badgeBlue: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#ccfbf1', gap: 4 },
  badgeTextBlue: { fontSize: 10, fontWeight: '900', color: '#0d9488' },

  // Full Map Styles
  fullMapContainer: { flex: 1, backgroundColor: '#000' },
  fullMap: { flex: 1 },
  legendContainer: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 16, borderRadius: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  closeMapButton: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  closeMapText: { color: '#fff', fontWeight: '900', fontSize: 14 }
});

export default Dashboard;