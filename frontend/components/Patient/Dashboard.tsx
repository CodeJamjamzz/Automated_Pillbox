import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, TouchableOpacity} from 'react-native';
import { Battery, Bluetooth, Smartphone, Box, X } from 'lucide-react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications'; 
import { Audio } from 'expo-av';

// --- SUB COMPONENTS ---
import DeviceLayout from '../DeviceLayout';
import DailySchedule from '../DailySchedule';
import LocationTracker from '../LocationTracker';

// --- IMPORTS ---
import { PatientRecord, Partition } from '../../types'; 
import PartitionConfig from './PartitionConfig'; 
import AlarmModal from './AlarmModal'; 
import { registerForNotifications } from '@/app/utils/NotificationService'; 

// --- INITIAL STATE & CONSTANTS ---
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

const Dashboard: React.FC<PatientDashboardProps> = (props) => {
  const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT_DATA);
  const [configPartition, setConfigPartition] = useState<Partition | null>(null);
  
  // --- ALARM & TIME STATE ---
  const [activeAlarmPartition, setActiveAlarmPartition] = useState<Partition | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date()); 

  // --- MAP / TRACKING STATE ---
  const [showFullMap, setShowFullMap] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'undetermined' | 'granted' | 'denied'>('undetermined');
  const [userLocation, setUserLocation] = useState<any>(null); 
  const [kitLocation, setKitLocation] = useState<any>(null); 

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
  };

  const handlePatientUpdate = (updatedPatient: PatientRecord) => {
    setPatient(updatedPatient);
    if (props.onUpdate) props.onUpdate(updatedPatient);
  };

  // --- 1. HEARTBEAT: CHECK TIME & UPDATE CLOCK ---
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

            if (
              d.getHours() === currentHour && 
              d.getMinutes() === currentMinute && 
              !takenDoses.has(doseId) &&
              activeAlarmPartition?.id !== p.id
            ) {
              setActiveAlarmPartition(p);
            }
          });
        }
      });
    }, 5000); 

    return () => clearInterval(interval);
  }, [patient, takenDoses, activeAlarmPartition]);


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
        console.log("Could not play alarm sound.", error);
      }
    };

    if (activeAlarmPartition) {
      timeoutId = setTimeout(() => setActiveAlarmPartition(null), 60000);
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

        {/* COMPONENT 3: LOCATION TRACKER (Map Widget) */}
        <LocationTracker 
          permissionStatus={permissionStatus}
          userLocation={userLocation}
          kitLocation={kitLocation}
          onRequestPermission={requestLocationPermission}
          onShowFullMap={() => setShowFullMap(true)}
        />

        {/* MODAL: FULL SCREEN MAP (Kept here to overlay everything) */}
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

      {/* MODAL: ALARM */}
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
  badgeGray: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  badgeTextGray: { fontSize: 10, fontWeight: '900', color: '#475569' },
  
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