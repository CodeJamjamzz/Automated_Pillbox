import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { Device } from 'react-native-ble-plx';
import { AppPhase, PatientRecord, Partition } from '../../types'; 
import PatientDashboard from '../../components/Patient/Dashboard';
import { Layout } from '../../components/Layout';
import SplashScreen from '../../components/SplashScreen';
import BluetoothScreen from '../../components/BluetoothScreen';
import AlarmModal from '../../components/Patient/AlarmModal';
import LoadingScreen from "../../components/LoadingScreen";

// --- FIREBASE RTDB IMPORTS ---
import { ref, onValue, update } from "firebase/database";
import { rtdb } from "../utils/firebase";

// --- INITIAL DATA ---
const INITIAL_PATIENT: PatientRecord = {
    id: 'P001',
    name: 'User',
    age: 68,
    partitions: Array.from({ length: 4 }).map((_, i) => ({
        id: i + 1,
        dosage: "",
        duration_days: 0,
        start_date: new Date().toISOString().split("T")[0],
        start_time: "08:00",
        label: 'Unassigned',
        medicineName: '',
        illness: '',
        pillCount: 0,
        schedule: [],
        selectedDays: [0, 1, 2, 3, 4, 5, 6],
        isBlinking: false,
        adherenceRate: 0,
        history: []
    })),
    lastLocation: { lat: 10.3157, lng: 123.8854 },
    riskScore: 0
};

const App: React.FC = () => {
    const [isLoading, setLoadingScreen] = useState(false); 
    const [phase, setPhase] = useState<AppPhase>(AppPhase.SPLASH);
    const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
    const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT);
    const [activeAlarm, setActiveAlarm] = useState<Partition | null>(null);
    const lastCheckedMinute = useRef<string>("");
    
    // --- NEW: LOG COUNTER TRACKER ---
    const localLogCounter = useRef<number>(-1);

    // --- 1. FIREBASE REAL-TIME LISTENER ---
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (phase === AppPhase.HOME) {
            setLoadingScreen(true);
            
            // Listen to the ROOT of the device to get slots AND log_counter simultaneously
            const deviceRef = ref(rtdb, 'pillbox_001');

            unsubscribe = onValue(deviceRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const slotsData = data.slots || {};
                    const cloudLogCounter = data.log_counter || 0;
                    
                    // 1. Sync Partitions
                    setPatient(prevPatient => {
                        const updatedPartitions = prevPatient.partitions.map(p => {
                            const dbSlot = slotsData[p.id.toString()];
                            if (dbSlot) {
                                return {
                                    ...p,
                                    pillCount: dbSlot.amount !== undefined ? dbSlot.amount : 0,
                                    schedule: dbSlot.times ? dbSlot.times.split(',').filter((t: string) => t.trim() !== '') : [],
                                    label: dbSlot.medicineName || 'Unassigned',
                                    medicineName: dbSlot.medicineName || '',
                                    illness: dbSlot.illness || '',
                                    dosage: dbSlot.dosage || '',
                                    timesPerDay: dbSlot.timesPerDay || 1,
                                    start_date: dbSlot.start_date || p.start_date,
                                    start_time: dbSlot.start_time || p.start_time,
                                    selectedDays: dbSlot.selectedDays || [0, 1, 2, 3, 4, 5, 6] 
                                };
                            }
                            return p;
                        });
                        return { ...prevPatient, partitions: updatedPartitions };
                    });

                    // 2. RECIPROCAL OVERRIDE: Check if Hardware resolved the alarm first!
                    if (localLogCounter.current === -1) {
                        localLogCounter.current = cloudLogCounter; // First boot sync
                    } else if (cloudLogCounter > localLogCounter.current) {
                        console.log("Device handled the alarm! Dismissing App Modal.");
                        localLogCounter.current = cloudLogCounter;
                        
                        // Force dismiss the modal because the physical button was pressed!
                        setActiveAlarm(null);
                    }
                }
                setLoadingScreen(false);
            }, (error) => {
                console.error("Firebase Error:", error);
                setLoadingScreen(false);
            });
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [phase]);

    // --- 2. SPLASH TIMER ---
    useEffect(() => {
        if (phase === AppPhase.SPLASH) {
            const timer = setTimeout(() => setPhase(AppPhase.BLUETOOTH), 2500);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    // --- 3. BULLETPROOF ALARM CHECKER ---
    useEffect(() => {
        if (phase !== AppPhase.HOME) return;

        const alarmInterval = setInterval(() => {
            const now = new Date();
            const currentH = now.getHours().toString().padStart(2, '0');
            const currentM = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentH}:${currentM}`;
            const currentYear = now.getFullYear();
            const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
            const currentDayStr = now.getDate().toString().padStart(2, '0');
            const currentDateStr = `${currentYear}-${currentMonth}-${currentDayStr}`;
            const currentDayOfWeek = now.getDay(); 

            if (currentTime !== lastCheckedMinute.current) {
                patient.partitions.forEach(p => {
                    const hasStarted = !p.start_date || currentDateStr >= p.start_date;
                    const isTodaySelected = !p.selectedDays || p.selectedDays.includes(currentDayOfWeek);
                    const isTimeMatch = p.schedule && p.schedule.includes(currentTime);
                    const hasPills = p.pillCount > 0;

                    if (hasStarted && isTodaySelected && isTimeMatch && hasPills) {
                        setActiveAlarm(p);
                    }
                });
                
                lastCheckedMinute.current = currentTime;
            }
        }, 5000);

        return () => clearInterval(alarmInterval);
    }, [phase, patient.partitions]);

    // --- 4. HANDLERS ---
    const handleTakeMed = async (id: number) => {
        const slotToUpdate = patient.partitions.find(p => p.id === id);
        if (!slotToUpdate) return;

        const newAmount = Math.max(0, slotToUpdate.pillCount - 1);
        setActiveAlarm(null); // Close modal instantly for UI responsiveness

        try {
             // 1. Advance the local counter so we don't accidentally trigger our own dismiss logic
             const newCounter = localLogCounter.current === -1 ? 1 : localLogCounter.current + 1;
             localLogCounter.current = newCounter;
             
             const logName = `log_${String(newCounter).padStart(3, '0')}`;

             // 2. Perform a multi-path atomic update to update amount AND tell ESP32 to shut up!
             const updates: any = {};
             updates[`pillbox_001/slots/${id}/amount`] = newAmount;
             updates[`pillbox_001/log_counter`] = newCounter;
             updates[`pillbox_001/logs/${logName}`] = {
                 action: "TAKEN_VIA_APP",
                 slot_id: id,
                 timestamp: Math.floor(Date.now() / 1000)
             };

             const rootRef = ref(rtdb);
             await update(rootRef, updates);

        } catch (e) {
            console.error("Failed to update Firebase", e);
        }
    };

    const handleConnect = (device: Device) => {
        setConnectedDevice(device.name || "MedSync");
        setPhase(AppPhase.HOME);
    };

    const handleDisconnect = () => {
        setConnectedDevice(null);
        setPhase(AppPhase.BLUETOOTH);
    };

    // --- 5. RENDER ---
    if (phase === AppPhase.SPLASH) return <SplashScreen />;
    if (phase === AppPhase.BLUETOOTH) return <BluetoothScreen onConnect={handleConnect} />;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Layout onDisconnect={handleDisconnect}>
                {isLoading ? (
                    <LoadingScreen />
                ) : (
                    <PatientDashboard patient={patient} onUpdate={setPatient} />
                )}
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

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#f8fafc' } });
export default App;