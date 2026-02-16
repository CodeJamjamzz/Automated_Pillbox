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
        { id: 1, color_code: 0, dosage: 0, duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 2, color_code: 0, dosage: 0, duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 3, color_code: 0, dosage: 0, duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 4, color_code: 0, dosage: 0, duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    ],
    lastLocation: { lat: 40.7128, lng: -74.0060 },
    riskScore: 45
};

interface Slot {
    slot_id: number;
    illness_name: string | null;
    calculated_times: string | null; // Changed to string based on backend logs ("08:00,12:00")
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

    // --- HOOKS MUST BE HERE (Before any returns) ---

    // 3. Data Fetching Hook
    useEffect(() => {
        // Only fetch when we enter HOME phase to save resources
        if (phase !== AppPhase.HOME) return;

        const fetchData = async () => {
            try {
                // Android Emulator uses 10.0.2.2, iOS uses localhost
                const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
                const response = await axios.get(`http://${host}:8080/api/schedule/sync`); // Use sync endpoint or your specific list endpoint

                // Note: Check what your backend actually returns.
                // If it returns "1|08:00;2|09:00", you need parsing logic.
                // If it returns a JSON list of objects (as assumed below), this works.
                const slotList: Slot[] = response.data;

                // 4. Correct State Update (Immutable)
                setPatient(prevPatient => {
                    const newPartitions = [...prevPatient.partitions];

                    slotList.forEach((slot, index) => {
                        if (index < 4 && slot.illness_name) {
                            // Safety check for calculated_times
                            let scheduleArr: string[] = [];
                            if (typeof slot.calculated_times === 'string') {
                                scheduleArr = slot.calculated_times.split(',');
                            }
                            // If backend sends object { text: "..." }
                            else if (slot.calculated_times && (slot.calculated_times as any).text) {
                                scheduleArr = (slot.calculated_times as any).text.split(',');
                            }

                            newPartitions[index] = {
                                ...newPartitions[index],
                                label: slot.illness_name || 'Unassigned',
                                color_code: Number(slot.color_code) || 0,
                                dosage: Number(slot.dosage) || 0,
                                duration_days: slot.duration_days,
                                pillCount: slot.pill_amount,
                                medicineName: slot.pill_name,
                                schedule: scheduleArr,
                                start_date: slot.start_date, // 5. Fixed Assignments
                                start_time: slot.start_time, // 5. Fixed Assignments
                            };
                        }
                    });

                    return { ...prevPatient, partitions: newPartitions };
                });

            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoadingScreen(false);
            }
        };

        fetchData();
    }, [phase]); // Run only when phase changes to HOME

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

    // --- CONDITIONAL RENDERS (Must be AFTER hooks) ---

    if (phase === AppPhase.SPLASH) return <SplashScreen />;

    if (phase === AppPhase.BLUETOOTH) {
        return <BluetoothScreen onConnect={handleConnect} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Layout onDisconnect={handleDisconnect}>
                { isLoading ? <LoadingScreen/> :
                    <PatientDashboard
                        patient={patient}
                        onUpdate={setPatient}
                    />
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