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
        selectedDays: [0, 1, 2, 3, 4, 5, 6], // Default Everyday
        isBlinking: false,
        adherenceRate: 0,
        history: [],
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

    // --- 1. FIREBASE REAL-TIME LISTENER ---
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        if (phase === AppPhase.HOME) {
            setLoadingScreen(true);
            const slotsRef = ref(rtdb, 'pillbox_001/slots');

            unsubscribe = onValue(slotsRef, (snapshot) => {
                if (snapshot.exists()) {
                    const slotsData = snapshot.val();
                    
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
                                    selectedDays: dbSlot.selectedDays || [0, 1, 2, 3, 4, 5, 6] // Fetch selected days
                                };
                            }
                            return p;
                        });
                        return { ...prevPatient, partitions: updatedPartitions };
                    });
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
            
            // Format current time to "HH:MM"
            const currentH = now.getHours().toString().padStart(2, '0');
            const currentM = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentH}:${currentM}`;
            
            // Format current date to "YYYY-MM-DD" for start_date comparison
            const currentYear = now.getFullYear();
            const currentMonth = (now.getMonth() + 1).toString().padStart(2, '0');
            const currentDayStr = now.getDate().toString().padStart(2, '0');
            const currentDateStr = `${currentYear}-${currentMonth}-${currentDayStr}`;
            
            // Get current day of week (0 = Sunday, 6 = Saturday)
            const currentDayOfWeek = now.getDay(); 

            if (currentTime !== lastCheckedMinute.current) {
                patient.partitions.forEach(p => {
                    // CONDITION 1: Has the start date arrived?
                    const hasStarted = !p.start_date || currentDateStr >= p.start_date;

                    // CONDITION 2: Is today one of the selected schedule days?
                    const isTodaySelected = !p.selectedDays || p.selectedDays.includes(currentDayOfWeek);

                    // CONDITION 3: Does current time match a scheduled dose time?
                    const isTimeMatch = p.schedule && p.schedule.includes(currentTime);

                    // CONDITION 4: Are there pills in the box?
                    const hasPills = p.pillCount > 0;

                    // If ALL four conditions are met, trigger the alarm!
                    if (hasStarted && isTodaySelected && isTimeMatch && hasPills) {
                        setActiveAlarm(p);
                    }
                });
                
                // Mark this minute as checked so we don't spam the modal
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
        setActiveAlarm(null);

        try {
             const slotRef = ref(rtdb, `pillbox_001/slots/${id}`);
             await update(slotRef, { amount: newAmount });
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