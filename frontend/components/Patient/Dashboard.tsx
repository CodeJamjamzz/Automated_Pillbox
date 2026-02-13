import React, {useState, useEffect, useMemo, useRef} from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Dimensions, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Battery, Bluetooth, MapPin, Volume2, Clock, Maximize2, X, Check, Calendar, PlusCircle, Smartphone, Box, MapPinOff, RefreshCw, Lock } from 'lucide-react-native';
// import MapView, { Marker, Polyline } from 'react-native-maps';
// import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

// --- IMPORTS ---
import { PatientRecord, Partition } from '../../types';
import PartitionConfig from './PartitionConfig';
import AlarmModal from './AlarmModal';
import { registerForNotifications } from '@/app/utils/NotificationService';
import WifiSetupModal from '../WifiSetupModal';

import {bleManager} from '@/app/utils/BleService'
import {Device} from "react-native-ble-plx";
import {useRoute, useNavigation} from "@react-navigation/native";

const { width } = Dimensions.get('window');
const GRID_SPACING = 12;
const ITEM_WIDTH = (width - 76) / 2;

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
    frequencyType: 'daily' as 'daily',
    selectedDays: [] as number[],
    timesPerDay: 0,
    dosage: ''
  }))
};

// const FALLBACK_REGION = {
//   latitude: 10.3292,
//   longitude: 123.9063,
//   latitudeDelta: 0.005,
//   longitudeDelta: 0.005,
// };

interface PatientDashboardProps {
  patient?: PatientRecord;
  onUpdate?: (patient: PatientRecord) => void;
  connectedDevice: Device | null;
}

const Dashboard: React.FC<PatientDashboardProps> = (props) => {
  const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT_DATA);
  const [configPartition, setConfigPartition] = useState<Partition | null>(null);
  const [isWifiModalVisible, setWifiModalVisible] = useState(false);

  const route = useRoute();
  const navigation = useNavigation();
  const isRebooting = useRef(false);

  // 1. Get the "Hollow" device from params (contains ID, but no methods)
  const {connectedDevice} = (route.params as {connectedDevice?: Device}) || {};

  // 2. State to hold the "Live" device (contains methods like .writeCharacteristic)
  const [device, setDevice] = useState<Device | null>(connectedDevice || null);

  // --- REHYDRATE DEVICE OBJECT ---
  // This restores the BLE functions lost during navigation
  useEffect(() => {
    const fetchLiveDevice = async () => {
      if (connectedDevice?.id) {
        try {
          // Get all connected devices from the OS
          const connectedDevices = await bleManager.connectedDevices([]);
          // Find the one that matches our ID
          const liveDevice = connectedDevices.find(d => d.id === connectedDevice.id);

          if (liveDevice) {
            console.log("Device rehydrated successfully");
            setDevice(liveDevice);
          } else {
            console.log("Device not found in connected list. It may have disconnected.");
            // Optional: You could trigger a re-connect scan here if needed
          }
        } catch (error) {
          console.warn("Failed to rehydrate device:", error);
        }
      }
    };

    fetchLiveDevice();
  }, [connectedDevice]);

  const handleWifiSuccess = () => {
    console.log("Wi-Fi credentials sent. Expecting reboot...");
    isRebooting.current = true;
    setWifiModalVisible(false);
  };

  // --- ALARM & TIME STATE ---
  const [activeAlarmPartition, setActiveAlarmPartition] = useState<Partition | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // --- MAP / TRACKING STATE ---
  // const [showFullMap, setShowFullMap] = useState(false);
  // const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  // const [userLocation, setUserLocation] = useState<any>(null);
  // const [kitLocation, setKitLocation] = useState<any>(null);

  const isNewDevice = patient.partitions.every(p => !p.label || p.label === 'Unassigned');

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
    const isTaking = !takenDoses.has(dose.id);

    // 1. Update Visual Status
    setTakenDoses(prev => {
      const next = new Set(prev);
      if (isTaking) next.add(dose.id);
      else next.delete(dose.id);
      return next;
    });

    // 2. Update Inventory (Pill Count)
    const updatedPartitions = patient.partitions.map(p => {
      if (p.id === dose.partitionId) {
        const newCount = isTaking
            ? Math.max(0, p.pillCount - 1)
            : p.pillCount + 1;
        return { ...p, pillCount: newCount };
      }
      return p;
    });

    handlePatientUpdate({ ...patient, partitions: updatedPartitions });
  };

  const handlePatientUpdate = (updatedPatient: PatientRecord) => {
    setPatient(updatedPatient);
    if (props.onUpdate) props.onUpdate(updatedPatient);
  };


  // --- 2. ALARM LOGIC: TIMEOUT & SOUND ---
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
        console.log("Could not play alarm sound. Check if assets/audio/alarm.wav exists.", error);
      }
    };

    if (activeAlarmPartition) {
      timeoutId = setTimeout(() => {
        setActiveAlarmPartition(null);
      }, 60000);
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


  // --- 3. HANDLE ALARM CONFIRM ---
  const handleAlarmConfirm = () => {
    if (!activeAlarmPartition) return;

    const doseToMark = todayDoses.find(d =>
        d.partitionId === activeAlarmPartition.id && d.status === 'pending'
    );

    if (doseToMark) {
      handleDoseAction(doseToMark);
    } else {
      const updatedPartitions = patient.partitions.map(p => {
        if (p.id === activeAlarmPartition.id) {
          return { ...p, pillCount: Math.max(0, p.pillCount - 1) };
        }
        return p;
      });
      handlePatientUpdate({ ...patient, partitions: updatedPartitions });
    }

    setActiveAlarmPartition(null);
  };


  // --- LOCATION & NOTIFICATION ---
  // const requestLocationPermission = async () => {
  //   setPermissionStatus('undetermined');
  //   try {
  //     let { status } = await Location.requestForegroundPermissionsAsync();
  //
  //     if (status !== 'granted') {
  //       setPermissionStatus('denied');
  //       setUserLocation(null);
  //       return;
  //     }
  //
  //     setPermissionStatus('granted');
  //     let location = await Location.getCurrentPositionAsync({});
  //
  //     const userLoc = {
  //       latitude: location.coords.latitude,
  //       longitude: location.coords.longitude,
  //       latitudeDelta: 0.005,
  //       longitudeDelta: 0.005,
  //     };
  //     setUserLocation(userLoc);
  //     setKitLocation({
  //       latitude: location.coords.latitude + 0.0003,
  //       longitude: location.coords.longitude + 0.0003,
  //     });
  //
  //   } catch (error) {
  //     console.log("Error requesting location:", error);
  //     setPermissionStatus('denied');
  //   }
  // };

  useEffect(() => {
    // requestLocationPermission();
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

  // --- HELPER FORMATTERS ---
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getNextDoseText = (schedule: string[]) => {
    if (!schedule || schedule.length === 0) return '--:--';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const timesInMinutes = schedule.map(isoString => {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return -1;
      return d.getHours() * 60 + d.getMinutes();
    }).filter(t => t !== -1).sort((a, b) => a - b);

    if (timesInMinutes.length === 0) return '--:--';
    const nextTime = timesInMinutes.find(t => t > currentMinutes);
    const timeToDisplay = nextTime !== undefined ? nextTime : timesInMinutes[0];
    const h = Math.floor(timeToDisplay / 60);
    const m = timeToDisplay % 60;
    const displayDate = new Date();
    displayDate.setHours(h);
    displayDate.setMinutes(m);
    return displayDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

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
              <TouchableOpacity
                  style={styles.badgeBlue}
                  onPress={() => {
                    // Check if we have a live device before opening modal
                    // We check for .connect method existence to verify it's not a hollow object
                    if (device && typeof device.connect === 'function') {
                      setWifiModalVisible(true);
                    } else {
                      Alert.alert("Not Connected", "Device is not actively connected or functionality is limited. Please reconnect.");
                    }
                  }}
              >
                <Bluetooth size={14} stroke="#0d9488" />
                <Text style={styles.badgeTextBlue}>LINK / WI-FI</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* DEVICE LAYOUT GRID */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEVICE LAYOUT</Text>
            <View style={styles.grid}>
              {patient.partitions.map((partition) => {
                const isUnassigned = !partition.label || partition.label === 'Unassigned';
                const activeColor = isUnassigned ? '#cbd5e1' : (partition.colorTheme || '#2563eb');

                return (
                    <TouchableOpacity
                        key={partition.id}
                        onPress={() => setConfigPartition(partition)}
                        style={[
                          styles.gridItem,
                          !isUnassigned
                              ? { borderColor: activeColor, borderWidth: 3 }
                              : styles.inactiveItem
                        ]}
                    >
                      <View style={styles.itemHeader}>
                        <View style={[
                          styles.slotBadge,
                          !isUnassigned ? { backgroundColor: activeColor } : styles.slotBadgeInactive
                        ]}>
                          <Text style={[styles.slotBadgeText, !isUnassigned ? styles.slotTextActive : styles.slotTextInactive]}>
                            SLOT {partition.id}
                          </Text>
                        </View>
                        <Text style={styles.itemLabel} numberOfLines={1}>
                          {partition.label || 'Empty'}
                        </Text>
                        {!isUnassigned && (
                            <Text style={styles.medicineName} numberOfLines={1}>{partition.medicineName}</Text>
                        )}
                      </View>

                      <View style={styles.itemFooter}>
                        {!isUnassigned ? (
                            <>
                              <View style={styles.pillCountContainer}>
                                <Text style={[styles.pillCount, { color: activeColor }]}>{partition.pillCount}</Text>
                                <Text style={[styles.pillLabel, { color: activeColor }]}>PILLS LEFT</Text>
                              </View>
                              <View style={[styles.scheduleBadge, { borderColor: activeColor + '40', backgroundColor: activeColor + '10' }]}>
                                <Clock size={10} stroke={activeColor} />
                                <Text style={[styles.scheduleText, { color: activeColor }]}>{getNextDoseText(partition.schedule)}</Text>
                              </View>
                            </>
                        ) : (
                            <View style={styles.setupContainer}>
                              <PlusCircle size={20} stroke="#94a3b8" />
                              <Text style={styles.setupText}>TAP TO ADD</Text>
                            </View>
                        )}
                      </View>
                    </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* TODAY'S SCHEDULE */}
          <View style={styles.section}>
            <View style={styles.scheduleHeader}>
              <Clock size={20} stroke="#2563eb" />
              <Text style={styles.scheduleTitle}>Today's Schedule</Text>
            </View>

            {isNewDevice || todayDoses.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBg}>
                    <Calendar size={32} stroke="#3b82f6" />
                  </View>
                  <Text style={styles.emptyStateTitle}>No Alarms Set</Text>
                  <Text style={styles.emptyStateText}>
                    Tap any Empty slot above to set up your first medication reminder.
                  </Text>
                </View>
            ) : (
                <View style={styles.timelineContainer}>
                  <View style={styles.timelineLine} />
                  {todayDoses.map((dose) => {
                    const doseTime = new Date(dose.time);
                    const isTimeNotReached = doseTime > currentTime;
                    const isButtonDisabled = isTimeNotReached && dose.status !== 'taken';

                    return (
                        <View key={dose.id} style={styles.doseRow}>
                          <View style={[styles.timeDot, dose.status === 'taken' ? styles.timeDotTaken : styles.timeDotPending]}>
                            {dose.status === 'taken' && <Check size={12} stroke="#fff" />}
                          </View>
                          <View style={[styles.doseCard, dose.status === 'taken' && styles.doseCardTaken]}>
                            <View>
                              <Text style={styles.doseTime}>{formatTime(dose.time)}</Text>
                              <Text style={[styles.doseMedName, dose.status === 'taken' && styles.textTaken]}>
                                {dose.medName}
                              </Text>
                            </View>

                            {/*<TouchableOpacity*/}
                            {/*    onPress={() => handleDoseAction(dose)}*/}
                            {/*    disabled={isButtonDisabled}*/}
                            {/*    style={[*/}
                            {/*      styles.actionBtn,*/}
                            {/*      dose.status === 'taken' ? styles.actionBtnTaken : styles.actionBtnPending,*/}
                            {/*      isButtonDisabled ? styles.actionBtnDisabled : {}*/}
                            {/*    ]}*/}
                            {/*>*/}
                            {/*  {isButtonDisabled ? (*/}
                            {/*      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>*/}
                            {/*        <Lock size={10} stroke="#94a3b8" />*/}
                            {/*        <Text style={styles.actionTextDisabled}>Wait</Text>*/}
                            {/*      </View>*/}
                            {/*  ) : (*/}
                            {/*      <Text style={[styles.actionBtnText, dose.status === 'taken' ? styles.actionTextTaken : styles.actionTextPending]}>*/}
                            {/*        {dose.status === 'taken' ? 'Undo' : 'Take'}*/}
                            {/*      </Text>*/}
                            {/*  )}*/}
                            {/*</TouchableOpacity>*/}
                          </View>
                        </View>
                    );
                  })}
                </View>
            )}
          </View>

          {/* --- LIVE TRACKER --- */}
          {/*<View style={styles.trackerSection}>*/}
          {/*  <View style={styles.trackerHeader}>*/}
          {/*    <View style={styles.trackerTitleContainer}>*/}
          {/*      <View style={styles.iconBg}>*/}
          {/*        <MapPin size={20} stroke="#f43f5e" />*/}
          {/*      </View>*/}
          {/*      <Text style={styles.trackerTitle}>Live Tracker</Text>*/}
          {/*    </View>*/}
          {/*    {permissionStatus === 'granted' && (*/}
          {/*        <TouchableOpacity onPress={() => setShowFullMap(true)} style={styles.focusButton}>*/}
          {/*          <Maximize2 size={12} stroke="#2563eb" />*/}
          {/*          <Text style={styles.focusButtonText}>FULL MAP</Text>*/}
          {/*        </TouchableOpacity>*/}
          {/*    )}*/}
          {/*  </View>*/}

          {/*  <TouchableOpacity*/}
          {/*      onPress={() => permissionStatus === 'granted' && setShowFullMap(true)}*/}
          {/*      activeOpacity={permissionStatus === 'granted' ? 0.7 : 1}*/}
          {/*      style={styles.mapContainer}*/}
          {/*  >*/}
          {/*    {permissionStatus === 'denied' ? (*/}
          {/*        <View style={styles.errorContainer}>*/}
          {/*          <View style={styles.errorIconBg}>*/}
          {/*            <MapPinOff size={24} stroke="#ef4444" />*/}
          {/*          </View>*/}
          {/*          <Text style={styles.errorTitle}>Location Required</Text>*/}
          {/*          <Text style={styles.errorText}>Please enable location services</Text>*/}

          {/*          <TouchableOpacity onPress={requestLocationPermission} style={styles.retryButton}>*/}
          {/*            <RefreshCw size={14} stroke="#fff" />*/}
          {/*            <Text style={styles.retryButtonText}>RETRY CONNECTION</Text>*/}
          {/*          </TouchableOpacity>*/}
          {/*        </View>*/}

          {/*    ) : permissionStatus === 'granted' && userLocation ? (*/}
          {/*        <>*/}
          {/*          <MapView*/}
          {/*              style={styles.map}*/}
          {/*              initialRegion={userLocation}*/}
          {/*              showsUserLocation={true}*/}
          {/*              pointerEvents="none"*/}
          {/*          >*/}
          {/*            {kitLocation && (*/}
          {/*                <Marker*/}
          {/*                    coordinate={kitLocation}*/}
          {/*                    title="My MedBox"*/}
          {/*                    description="Last seen 2 mins ago"*/}
          {/*                    pinColor="red"*/}
          {/*                />*/}
          {/*            )}*/}
          {/*          </MapView>*/}

          {/*          <View style={styles.mapStatus}>*/}
          {/*            <View style={styles.statusRow}>*/}
          {/*              <View style={styles.blueDot} />*/}
          {/*              <Text style={styles.statusText}>Phone</Text>*/}
          {/*            </View>*/}
          {/*            <View style={styles.divider} />*/}
          {/*            <View style={styles.statusRow}>*/}
          {/*              <View style={styles.redDot} />*/}
          {/*              <Text style={styles.statusText}>Kit (45m away)</Text>*/}
          {/*            </View>*/}
          {/*          </View>*/}
          {/*        </>*/}

          {/*    ) : (*/}
          {/*        <View style={styles.loadingContainer}>*/}
          {/*          <ActivityIndicator size="small" color="#2563eb" />*/}
          {/*          <Text style={styles.loadingText}>Locating Devices...</Text>*/}
          {/*        </View>*/}
          {/*    )}*/}
          {/*  </TouchableOpacity>*/}

          {/*  <TouchableOpacity style={styles.locateButton}>*/}
          {/*    <Volume2 size={18} stroke="#475569" />*/}
          {/*    <Text style={styles.locateButtonText}>PING PHYSICAL BOX</Text>*/}
          {/*  </TouchableOpacity>*/}
          {/*</View>*/}

          {/* --- FULL SCREEN MAP MODAL --- */}
          {/*<Modal visible={showFullMap} animationType="slide">*/}
          {/*  <View style={styles.fullMapContainer}>*/}
          {/*    {userLocation ? (*/}
          {/*        <MapView*/}
          {/*            style={styles.fullMap}*/}
          {/*            initialRegion={userLocation}*/}
          {/*            showsUserLocation={true}*/}
          {/*            showsBuildings*/}
          {/*            showsTraffic*/}
          {/*        >*/}
          {/*          {kitLocation && (*/}
          {/*              <>*/}
          {/*                <Marker coordinate={kitLocation} title="My MedBox" description="Device Location" pinColor="red" />*/}
          {/*                <Polyline*/}
          {/*                    coordinates={[userLocation, kitLocation]}*/}
          {/*                    strokeColor="#2563eb"*/}
          {/*                    strokeWidth={2}*/}
          {/*                    lineDashPattern={[5, 5]}*/}
          {/*                />*/}
          {/*              </>*/}
          {/*          )}*/}
          {/*        </MapView>*/}
          {/*    ) : (*/}
          {/*        <MapView style={styles.fullMap} initialRegion={FALLBACK_REGION} />*/}
          {/*    )}*/}

          {/*    <View style={styles.legendContainer}>*/}
          {/*      <View style={styles.legendItem}>*/}
          {/*        <Smartphone size={16} stroke="#2563eb" />*/}
          {/*        <Text style={styles.legendText}>You</Text>*/}
          {/*      </View>*/}
          {/*      <View style={styles.legendItem}>*/}
          {/*        <Box size={16} stroke="#ef4444" />*/}
          {/*        <Text style={styles.legendText}>MedBox</Text>*/}
          {/*      </View>*/}
          {/*    </View>*/}

          {/*    <TouchableOpacity onPress={() => setShowFullMap(false)} style={styles.closeMapButton}>*/}
          {/*      <X size={24} stroke="#fff" />*/}
          {/*      <Text style={styles.closeMapText}>CLOSE MAP</Text>*/}
          {/*    </TouchableOpacity>*/}
          {/*  </View>*/}
          {/*</Modal>*/}

          {/* --- CONFIG MODAL --- */}
          {configPartition && (
              <Modal animationType="slide" visible={true} onRequestClose={() => setConfigPartition(null)}>
                <PartitionConfig
                    partition={configPartition}
                    onSave={(data) => {
                      handlePatientUpdate({
                        ...patient,
                        partitions: patient.partitions.map(p => p.id === configPartition.id ? { ...p, ...data as Partition } : p)
                      });
                      setConfigPartition(null);
                    }}
                    onClose={() => setConfigPartition(null)}
                />
              </Modal>
          )}
        </ScrollView>

        <WifiSetupModal
            visible={isWifiModalVisible}
            onClose={() => setWifiModalVisible(false)}
            device={device}
            onSuccess={handleWifiSuccess}
        />

        {/* --- ALARM MODAL --- */}
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

// --- STYLES ---
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

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#64748b', letterSpacing: 1.5, marginBottom: 16 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_SPACING, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 32 },
  gridItem: { width: ITEM_WIDTH, height: 160, backgroundColor: '#fff', borderRadius: 24, padding: 12, justifyContent: 'space-between', borderWidth: 3 },
  inactiveItem: { borderColor: '#fff', borderStyle: 'solid', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },

  itemHeader: { gap: 4 },
  slotBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  slotBadgeInactive: { backgroundColor: '#f1f5f9' },
  slotBadgeText: { fontSize: 8, fontWeight: '900' },
  slotTextActive: { color: '#fff' },
  slotTextInactive: { color: '#94a3b8' },
  itemLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  medicineName: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },

  itemFooter: { gap: 6 },
  pillCountContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  pillCount: { fontSize: 20, fontWeight: '900' },
  pillLabel: { fontSize: 8, fontWeight: '900' },
  scheduleBadge: { flexDirection: 'row', alignItems: 'center', padding: 4, borderRadius: 8, gap: 4, borderWidth: 1 },
  scheduleText: { fontSize: 10, fontWeight: '900' },
  setupContainer: { alignItems: 'center', justifyContent: 'center', opacity: 0.4, gap: 4 },
  setupText: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },

  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  scheduleTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#eff6ff', borderStyle: 'dashed' },
  emptyIconBg: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 4 },
  emptyStateText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, maxWidth: 220, lineHeight: 20 },

  timelineContainer: { position: 'relative', paddingLeft: 20 },
  timelineLine: { position: 'absolute', left: 9, top: 0, bottom: 0, width: 2, backgroundColor: '#e2e8f0' },
  doseRow: { marginBottom: 16, paddingLeft: 24, position: 'relative' },
  timeDot: { position: 'absolute', left: -18, top: 20, width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  timeDotTaken: { backgroundColor: '#10b981' },
  timeDotPending: { backgroundColor: '#cbd5e1' },
  doseCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  doseCardTaken: { opacity: 0.6, backgroundColor: '#f8fafc' },
  doseTime: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  doseMedName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  textTaken: { textDecorationLine: 'line-through', color: '#94a3b8' },

  // BUTTON STYLES
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 60, alignItems: 'center' },
  actionBtnTaken: { borderColor: 'transparent', backgroundColor: 'transparent' },
  actionBtnPending: { borderColor: '#e2e8f0', backgroundColor: '#fff' },
  actionBtnDisabled: { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' },

  actionBtnText: { fontSize: 12, fontWeight: 'bold' },
  actionTextTaken: { color: '#64748b' },
  actionTextPending: { color: '#2563eb' },
  actionTextDisabled: { color: '#94a3b8', fontSize: 10 },

  trackerSection: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  trackerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBg: { padding: 8, backgroundColor: '#fff1f2', borderRadius: 12 },
  trackerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  focusButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  focusButtonText: { fontSize: 10, fontWeight: '900', color: '#2563eb' },
  mapContainer: { height: 170, backgroundColor: '#e2e8f0', borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  map: { width: '100%', height: '100%' },

  loadingContainer: { height: 160, backgroundColor: '#e2e8f0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#64748b', fontSize: 12, fontWeight: '600' },

  errorContainer: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fef2f2' },
  errorIconBg: { marginBottom: 12, padding: 12, backgroundColor: '#fee2e2', borderRadius: 50 },
  errorTitle: { fontSize: 16, fontWeight: 'bold', color: '#991b1b', marginBottom: 4 },
  errorText: { fontSize: 12, color: '#b91c1c', textAlign: 'center', marginBottom: 16 },
  retryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6, shadowColor: '#ef4444', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },

  mapStatus: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 12, backgroundColor: '#cbd5e1' },
  blueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#1e293b' },

  locateButton: { marginTop: 16, backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  locateButtonText: { fontSize: 12, fontWeight: '900', color: '#475569' },
  fullMapContainer: { flex: 1, backgroundColor: '#000' },
  fullMap: { flex: 1 },

  legendContainer: { position: 'absolute', top: 60, left: 20, backgroundColor: 'rgba(255,255,255,0.9)', padding: 16, borderRadius: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendText: { fontSize: 14, fontWeight: 'bold', color: '#1e293b' },

  closeMapButton: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: '#ef4444', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 6 },
  closeMapText: { color: '#fff', fontWeight: '900', fontSize: 14 }
});

export default Dashboard;