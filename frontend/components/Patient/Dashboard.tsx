import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity} from 'react-native';
import { Battery, Bluetooth, Smartphone, Box, X } from 'lucide-react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
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
import { registerForNotifications } from '@/app/utils/NotificationService';

// --- FIREBASE RTDB IMPORTS ---
import { ref, update, onValue, get } from "firebase/database";
import { rtdb } from "@/app/utils/firebase";

// --- INITIAL STATE & CONSTANTS ---
const INITIAL_PATIENT_DATA: PatientRecord = {
  id: 'P001',
  name: 'User',
  age: 68,
  partitions: [
    {
      id: 1, dosage: "0", duration_days: 0,
      start_date: new Date().toISOString().split("T")[0],
      start_time: new Date().toTimeString().slice(0, 5),
      label: 'Unassigned', medicineName: '', pillCount: 0,
      schedule: [], selectedDays: [0,1,2,3,4,5,6], isBlinking: false, adherenceRate: 0, history: []
    },
    {
      id: 2, dosage: "0", duration_days: 0,
      start_date: new Date().toISOString().split("T")[0],
      start_time: new Date().toTimeString().slice(0, 5),
      label: 'Unassigned', medicineName: '', pillCount: 0,
      schedule: [], selectedDays: [0,1,2,3,4,5,6], isBlinking: false, adherenceRate: 0, history: []
    },
    {
      id: 3, dosage: "0", duration_days: 0,
      start_date: new Date().toISOString().split("T")[0],
      start_time: new Date().toTimeString().slice(0, 5),
      label: 'Unassigned', medicineName: '', pillCount: 0,
      schedule: [], selectedDays: [0,1,2,3,4,5,6], isBlinking: false, adherenceRate: 0, history: []
    },
    {
      id: 4, dosage: "0", duration_days: 0,
      start_date: new Date().toISOString().split("T")[0],
      start_time: new Date().toTimeString().slice(0, 5),
      label: 'Unassigned', medicineName: '', pillCount: 0,
      schedule: [], selectedDays: [0,1,2,3,4,5,6], isBlinking: false, adherenceRate: 0, history: []
    },
  ],
  lastLocation: { lat: 10.3157, lng: 123.8854 }, // Centered on Cebu City
  riskScore: 45
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

const Dashboard: React.FC<PatientDashboardProps> = (props) => {
  const [patient, setPatient] = useState<PatientRecord>(props.patient || INITIAL_PATIENT_DATA);
  const [configPartition, setConfigPartition] = useState<Partition | null>(null);

  // This forces the Dashboard to instantly update whenever Firebase sends new data!
  useEffect(() => {
    if (props.patient) {
      setPatient(props.patient);
    }
  }, [props.patient]);

  // --- TIME STATE ---
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- MAP / TRACKING STATE ---
  const [showFullMap, setShowFullMap] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [userLocation, setUserLocation] = useState<any>(null);
  const [kitLocation, setKitLocation] = useState<any>(null);
  const route = useRoute();
  const isNewDevice = patient.partitions.every(p => !p.label || p.label === 'Unassigned');

  // --- 1. GET DEVICE FROM NAVIGATION PARAMS ---
  const { connectedDevice } = (route.params as { connectedDevice?: Device }) || {};

  // --- 2. CREATE THE STATE VARIABLE ---
  const [device, setDevice] = useState<Device | null>(connectedDevice || null);

  // --- 3. REHYDRATE THE DEVICE ---
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
            console.log("Device not found in connected list. Attempting reconnect...");
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

  // --- NEW: PING DEVICE FUNCTIONALITY (FIREBASE RTDB) ---
    const [isPinging, setIsPinging] = useState(false);

    const handlePingDevice = async () => {
      try {
        setIsPinging(true);

        // Target the specific device node in Firebase
        const pingRef = ref(rtdb, 'pillbox_001');

        // Update the 'locate' node to 1 to trigger the ESP32
        await update(pingRef, { locate: 1 });

        // Auto-reset the UI button state after 15 seconds
        // The ESP32 will also reset the Firebase value to 0 on its end
        setTimeout(async () => {
          setIsPinging(false);
          // Optional: Failsafe to ensure it resets in the cloud if the ESP32 is offline
          await update(pingRef, { locate: 0 });
        }, 15000);
      } catch (error) {
        console.error("Failed to ping device via Firebase:", error);
        setIsPinging(false);
        alert("Failed to send ping command to MedBox.");
      }
    };

   // --- REAL-TIME DEVICE SYNC (Listens to ESP32 physical button presses) ---
     useEffect(() => {
       const logsRef = ref(rtdb, 'pillbox_001/logs');

       const unsubscribe = onValue(logsRef, (snapshot) => {
         if (snapshot.exists()) {
           const logsData = snapshot.val();

           // Convert the logs object into an array and get logs from the last 24 hours
           const twentyFourHoursAgo = (Date.now() / 1000) - (24 * 60 * 60);

           const recentLogs = Object.values(logsData).filter((log: any) =>
             log.timestamp > twentyFourHoursAgo &&
             (log.action === "TAKEN" || log.action === "MANUAL_TAKE" || log.action === "TAKEN_VIA_APP")
           );

           setTakenDoses(prevDoses => {
             const updatedDoses = new Set(prevDoses);

             recentLogs.forEach((log: any) => {
               patient.partitions.forEach(p => {
                 if (p.id === log.slot_id && p.schedule) {
                    p.schedule.forEach((timeStr, index) => {
                       const doseId = `${p.id}-${index}`;
                       updatedDoses.add(doseId);
                    });
                 }
               });
             });

             return updatedDoses;
           });
         }
       });

       return () => unsubscribe();
     }, [patient.partitions]);

  // --- SCHEDULE LOGIC ---
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

  // --- Handle Dose Action (Take/Undo) & Update Inventory ---
  const handleDoseAction = (dose: any) => {
    if (takenDoses.has(dose.id)) return;

    // 1. Update Visual Status
    setTakenDoses(prev => {
      const next = new Set(prev);
      next.add(dose.id);
      return next;
    });

    // 2. Update Inventory (Pill Count)
    const updatedPartitions = patient.partitions.map(p => {
      if (p.id === dose.partitionId) {
        return { ...p, pillCount: Math.max(0, p.pillCount - 1) };
      }
      return p;
    });

    handlePatientUpdate({ ...patient, partitions: updatedPartitions });

    // 3. TELL THE ESP32 WE TOOK IT VIA APP!
            try {
              const counterRef = ref(rtdb, 'pillbox_001/log_counter');
              const counterSnap = await get(counterRef);
              let newCounter = 1;
              if (counterSnap.exists()) {
                newCounter = counterSnap.val() + 1;
              }

              // Format log name e.g. log_169
              const logName = `log_${String(newCounter).padStart(3, '0')}`;

              const newLogRef = ref(rtdb, `pillbox_001/logs/${logName}`);
              await update(newLogRef, {
                 action: "TAKEN_VIA_APP",
                 slot_id: dose.partitionId,
                 timestamp: Math.floor(Date.now() / 1000)
              });

              await update(counterRef, newCounter); // Update counter so ESP32 syncs it
            } catch (error) {
              console.error("Failed to log app action to Firebase:", error);
            }
  };


  const handlePatientUpdate = (updatedPatient: PatientRecord) => {
    setPatient(updatedPatient);
    if (props.onUpdate) props.onUpdate(updatedPatient);
  };

  // --- 1. HEARTBEAT: UPDATE CLOCK FOR TIMELINE UI ---
  // (We removed the old duplicate Alarm Logic from here!)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

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

          {/* COMPONENT 1: DEVICE LAYOUT (Grid) */}
          <DeviceLayout
              partitions={patient.partitions}
              onPartitionSelect={setConfigPartition}
          />

          {/* COMPONENT 2: DAILY SCHEDULE (Timeline) */}
          <DailySchedule
              todayDoses={todayDoses}
              currentTime={currentTime}
              onDoseAction={handleDoseAction}
              isNewDevice={isNewDevice}
          />


          {/* --- NEW: PING DEVICE BUTTON --- */}
                    <View style={styles.pingContainer}>
                      <TouchableOpacity
                        // Removed the !device opacity check so it's fully opaque and clickable over Wi-Fi
                        style={[styles.pingButton, isPinging && styles.pingButtonActive]}
                        onPress={handlePingDevice}
                        disabled={isPinging}
                      >
                        <Bluetooth size={20} stroke={isPinging ? "#ffffff" : "#2563eb"} />
                        <Text style={[styles.pingButtonText, isPinging && styles.pingTextActive]}>
                          {isPinging ? "PINGING MEDBOX..." : "FIND MY MEDBOX"}
                        </Text>
                      </TouchableOpacity>
                    </View>

          {/* MODAL: FULL SCREEN MAP */}
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
                          <Marker coordinate={kitLocation} title="My MedBox" description="Device Location" pinColor="red" />
                          <Polyline
                              coordinates={[userLocation, kitLocation]}
                              strokeColor="#2563eb"
                              strokeWidth={2}
                              lineDashPattern={[5, 5]}
                          />
                        </>
                    )}
                  </MapView>
              ) : (
                  <MapView style={styles.fullMap} initialRegion={FALLBACK_REGION} />
              )}

              <View style={styles.legendContainer}>
                <View style={styles.legendItem}>
                  <Smartphone size={16} stroke="#2563eb" />
                  <Text style={styles.legendText}>You</Text>
                </View>
                <View style={styles.legendItem}>
                  <Box size={16} stroke="#ef4444" />
                  <Text style={styles.legendText}>MedBox</Text>
                </View>
              </View>

              <TouchableOpacity onPress={() => setShowFullMap(false)} style={styles.closeMapButton}>
                <X size={24} stroke="#fff" />
                <Text style={styles.closeMapText}>CLOSE MAP</Text>
              </TouchableOpacity>
            </View>
          </Modal>

          {/* MODAL: CONFIG PARTITION */}
          {configPartition && (
              <Modal animationType="slide" visible={true} onRequestClose={() => setConfigPartition(null)}>
                <PartitionConfig
                    partition={configPartition}
                    onSave={async (data) => {
                      const updatedP = {...configPartition, ...data as Partition};

                      // 1. Optimistic UI Update
                      handlePatientUpdate({
                        ...patient,
                        partitions: patient.partitions.map(p => p.id === configPartition.id ? updatedP : p)
                      });

                      // 2. Schedule array is ALREADY formatted as ["18:30", "02:30"], just join them!
                      let timesString = "";
                      if (updatedP.schedule && updatedP.schedule.length > 0) {
                        timesString = updatedP.schedule.join(",");
                      }

                      // 3. Push EVERYTHING to Firebase RTDB (Removed await import crashes)
                      try {
                          const slotRef = ref(rtdb, `pillbox_001/slots/${updatedP.id}`);
                          await update(slotRef, {
                              amount: updatedP.pillCount,
                              times: timesString,
                              medicineName: updatedP.medicineName || '',
                              illness: updatedP.illness || '',
                              dosage: updatedP.dosage || '',
                              timesPerDay: updatedP.timesPerDay || 1,
                              start_date: updatedP.start_date || '',
                              start_time: updatedP.start_time || '',
                              selectedDays: updatedP.selectedDays || [0,1,2,3,4,5,6]
                          });
                      } catch (error) {
                          console.error("Failed to save to Firebase RTDB:", error);
                      }

                      setConfigPartition(null);
                    }}
                    onClose={() => setConfigPartition(null)}               />
              </Modal>
          )}
        </ScrollView>
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
  badgeGray: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  badgeTextGray: { fontSize: 10, fontWeight: '900', color: '#475569' },
  fullMapContainer: { flex: 1, backgroundColor: '#000' },
  fullMap: { flex: 1 },
  legendContainer: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 16, borderRadius: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },
  closeMapButton: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  closeMapText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  // --- NEW: PING STYLES ---
    pingContainer: {
      marginTop: 24,
      alignItems: 'center'
    },
    pingButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#eff6ff',
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: '#2563eb',
      gap: 10,
      width: '100%',
      shadowColor: '#2563eb',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 2,
    },
    pingButtonActive: {
      backgroundColor: '#2563eb'
    },
    pingButtonText: {
      color: '#2563eb',
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 0.5
    },
    pingTextActive: {
      color: '#ffffff'
    },
});

export default Dashboard;