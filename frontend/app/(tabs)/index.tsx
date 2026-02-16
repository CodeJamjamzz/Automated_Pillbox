
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, View, StatusBar, Platform } from 'react-native';
import { AppPhase, PatientRecord, Partition } from '../../types';
import PatientDashboard from '../../components/Patient/Dashboard';
import { Layout } from '../../components/Layout';
import SplashScreen from '../../components/SplashScreen';
import BluetoothScreen from '../../components/BluetoothScreen';
import AlarmModal from '../../components/Patient/AlarmModal';
import LoadingScreen from "../components/LoadingScreen";

const INITIAL_PATIENT: PatientRecord = {
  id: 'P001',
  name: 'User',
  age: 68,
  partitions: [
    { id: 1, label: 'Heart Meds', medicineName: 'Atorvastatin', pillCount: 14, schedule: ['08:00', '20:00'], isBlinking: false, adherenceRate: 98, history: [true, true, true, true, true, true, true] },
    { id: 2, label: 'Diabetes', medicineName: 'Metformin', pillCount: 4, schedule: ['09:00'], isBlinking: false, adherenceRate: 85, history: [true, false, true, true, false, true, true] },
    { id: 3, label: 'Pain Relief', medicineName: 'Ibuprofen', pillCount: 22, schedule: ['12:00', '18:00', '00:00'], isBlinking: false, adherenceRate: 40, history: [false, false, true, false, true, false, false] },
    { id: 4, label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    { id: 5, label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    { id: 6, label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] }
  ],
  lastLocation: { lat: 40.7128, lng: -74.0060 },
  riskScore: 45
};

const App: React.FC = () => {
    const [isLoading, setLoadingScreen] = useState(true)
  const [phase, setPhase] = useState<AppPhase>(AppPhase.SPLASH);
  const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
  const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT);
  const [activeAlarm, setActiveAlarm] = useState<Partition | null>(null);
  const lastCheckedMinute = useRef<string>("");

  useEffect(() => {
    if (phase === AppPhase.SPLASH) {
      const timer = setTimeout(() => setPhase(AppPhase.BLUETOOTH), 2500);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== AppPhase.HOME || !connectedDevice) return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentH = now.getHours().toString().padStart(2, '0');
      const currentM = now.getMinutes().toString().padStart(2, '0');
      const currentTime = `${currentH}:${currentM}`;

      if (currentTime !== lastCheckedMinute.current) {
        patient.partitions.forEach(p => {
          if (p.schedule.includes(currentTime)) {
            setActiveAlarm(p);
            lastCheckedMinute.current = currentTime;
          }
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [phase, connectedDevice, patient.partitions]);

  const handleTakeMed = (id: number) => {
    setPatient(prev => ({
      ...prev,
      partitions: prev.partitions.map(p => 
        p.id === id ? { ...p, pillCount: Math.max(0, p.pillCount - 1) } : p
      )
    }));
    setActiveAlarm(null);
  };

  const handleConnect = (deviceName: string) => {
    setConnectedDevice(deviceName);
    setPhase(AppPhase.HOME);
  };

  const handleDisconnect = () => {
    setConnectedDevice(null);
    setPhase(AppPhase.BLUETOOTH);
  };

  if (phase === AppPhase.SPLASH) return <SplashScreen />;
  
  if (phase === AppPhase.BLUETOOTH) {
    return <BluetoothScreen onConnect={handleConnect} />;
  }

  useEffect(() => {
      try {
          axios.get("")
      }

      })

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Layout onDisconnect={handleDisconnect}>
        { isLoading? <LoadingScreen/> :
                    <PatientDashboard
                      patient={patient}
                      onUpdate={setPatient} />
        }
      </Layout>

      {activeAlarm && (
        <AlarmModal 
          partition={activeAlarm} 
          onConfirm={() => handleTakeMed(activeAlarm.id)} 
          onClose={() => setActiveAlarm(null)} 
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default App;
