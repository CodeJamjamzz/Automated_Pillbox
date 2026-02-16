
import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';
import axios from 'axios'; // 1. Added missing import
import { AppPhase, PatientRecord, Partition } from '../../types';
import PatientDashboard from '../../components/Patient/Dashboard';
import { Layout } from '../../components/Layout';
import SplashScreen from '../../components/SplashScreen';
import BluetoothScreen from '../../components/BluetoothScreen';
import AlarmModal from '../../components/Patient/AlarmModal';
import LoadingScreen from "../../components/LoadingScreen";

// 2. Fixed Syntax: Replaced '=' with ':' and fixed slice() brackets
const INITIAL_PATIENT: PatientRecord = {
  id: 'P001',
  name: 'User',
  age: 68,
  partitions: [
    { id: 1, color_code: 0, dosage: 0, duration_days: 0,start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    { id: 2,color_code: 0, dosage: 0, duration_days: 0,start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    { id: 3,color_code: 0, dosage: 0, duration_days: 0,start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    { id: 4,color_code: 0, dosage: 0, duration_days: 0,start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
  ],
  lastLocation: { lat: 40.7128, lng: -74.0060 },
  riskScore: 45
};

interface Slot {
  slot_id: number;
  illness_name: string | null;
  calculated_times: { text: string };
  color_code: string;
  dosage: string;
  duration_days: number;
  pill_amount: number;
  pill_name: string;
  start_date: string;
  start_time: string;
}

const App: React.FC = () => {
    const [isLoading, setLoadingScreen] = useState(true);
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
      const fetchData = async () => {
          try {
              const response = await axios.get("http://localhost:8080/api/schedule/")
              const slotList: Slot[] = response.data;

              for (let i = 0; i < slotList.length; i++)
                  slotList[i] = response.data[i];
                  if(slotList[i].illness_name != null){
                      partitions[i].schedule = slotList[i].calculated_times.text.trim().split(/\s+/);
                      partitions[i].color_code = slotList[i].color_code; // wala
                      partitions[i].dosage = slotList[i].dosage; // wala
                      partitions[i].duration_days = slotList[i].duration_days; // // wala
                      partitions[i].label = slotList[i].illness_name;
                      partitions[i].pillCount = slotList[i].pill_amount;
                      partitions[i].medicineName = slotList[i].pill_name;
                      partitions[i].id = slotList[i].start_date; // wala
                      partitions[i].id = slotList[i].start_time; // wala
                  }
              }

          } catch (error) {
            console.error('Error fetching data:', error);
          }
        };

        fetchData();
        setLoadingScreen(false);
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
