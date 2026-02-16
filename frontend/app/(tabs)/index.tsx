import React, { useState, useEffect, useRef } from 'react';
import { SafeAreaView, StyleSheet, StatusBar, Platform } from 'react-native';
import axios from 'axios';
import { Device } from 'react-native-ble-plx'; // Import the correct Device type
import { AppPhase, PatientRecord, Partition } from '../../types';
import PatientDashboard from '../../components/Patient/Dashboard';
import { Layout } from '../../components/Layout';
import SplashScreen from '../../components/SplashScreen';
import BluetoothScreen from '../../components/BluetoothScreen';
import AlarmModal from '../../components/Patient/AlarmModal';
import LoadingScreen from "../../components/LoadingScreen";

// FIXED: Initial data now matches the 'Partition' interface (dosage is string "0")
const INITIAL_PATIENT: PatientRecord = {
    id: 'P001',
    name: 'User',
    age: 68,
    partitions: [
        { id: 1, color_code: 0, dosage: "0", duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 2, color_code: 0, dosage: "0", duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 3, color_code: 0, dosage: "0", duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
        { id: 4, color_code: 0, dosage: "0", duration_days: 0, start_date: new Date().toISOString().split("T")[0], start_time: new Date().toTimeString().slice(0, 5), label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [], isBlinking: false, adherenceRate: 0, history: [] },
    ],
    lastLocation: { lat: 40.7128, lng: -74.0060 },
    riskScore: 45
};

// Interface for the data coming from your Backend API
interface Slot {
    slot_id: number;
    illness_name: string | null;
    // Backend might return an object {text: "..."} or a simple string, handling both:
    calculated_times: { text: string } | string;
    color_code: string;
    dosage: string;
    duration_days: number;
    pill_amount: number;
    pill_name: string;
    start_date: string;
    start_time: string;
}

const App: React.FC = () => {
    const [isLoading, setLoadingScreen] = useState(false);
    const [phase, setPhase] = useState<AppPhase>(AppPhase.SPLASH);
    const [connectedDevice, setConnectedDevice] = useState<string | null>(null);
    const [patient, setPatient] = useState<PatientRecord>(INITIAL_PATIENT);
    const [activeAlarm, setActiveAlarm] = useState<Partition | null>(null);
    const lastCheckedMinute = useRef<string>("");

    // --- 1. DATA FETCHING ---
    useEffect(() => {
        if (phase !== AppPhase.HOME) return;

        const fetchData = async () => {
            setLoadingScreen(true);
            try {
                // Use 10.0.2.2 for Android Emulator, localhost for iOS/Web
                const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
                const response = await axios.get(`https://pillbox-backend.onrender.com/api/schedule/sync`);
                const slotList: Slot[] = response.data;

                setPatient(prevPatient => {
                    // Create a shallow copy of the partitions array
                    const newPartitions = [...prevPatient.partitions];

                    slotList.forEach((slot, index) => {
                        // Ensure we only update slots 0-3 and ignore empty ones
                        if (index < 4 && slot.illness_name) {

                            // Handle schedule parsing safely
                            let scheduleArr: string[] = [];
                            if (typeof slot.calculated_times === 'string') {
                                scheduleArr = slot.calculated_times.split(',');
                            } else if (slot.calculated_times && slot.calculated_times.text) {
                                scheduleArr = slot.calculated_times.text.trim().split(/\s+/);
                            }

                            // Update the partition with backend data
                            newPartitions[index] = {
                                ...newPartitions[index], // Keep existing fields (like isBlinking)
                                label: slot.illness_name || 'Unassigned',
                                color_code: Number(slot.color_code) || 0, // Convert backend string to number
                                dosage: slot.dosage || "0",
                                duration_days: slot.duration_days,
                                pillCount: slot.pill_amount,
                                medicineName: slot.pill_name,
                                schedule: scheduleArr,
                                start_date: slot.start_date,
                                start_time: slot.start_time
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
    }, [phase]);

    // --- 2. SPLASH TIMER ---
    useEffect(() => {
        if (phase === AppPhase.SPLASH) {
            const timer = setTimeout(() => setPhase(AppPhase.BLUETOOTH), 2500);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    // --- 3. ALARM CHECKER ---
    useEffect(() => {
        if (phase !== AppPhase.HOME || !connectedDevice) return;

        const interval = setInterval(() => {
            const now = new Date();
            const currentH = now.getHours().toString().padStart(2, '0');
            const currentM = now.getMinutes().toString().padStart(2, '0');
            const currentTime = `${currentH}:${currentM}`;

            if (currentTime !== lastCheckedMinute.current) {
                patient.partitions.forEach(p => {
                    if (p.schedule && p.schedule.includes(currentTime)) {
                        setActiveAlarm(p);
                        lastCheckedMinute.current = currentTime;
                    }
                });
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [phase, connectedDevice, patient.partitions]);

    // --- 4. HANDLERS ---
    const handleTakeMed = (id: number) => {
        setPatient(prev => ({
            ...prev,
            partitions: prev.partitions.map(p =>
                p.id === id ? { ...p, pillCount: Math.max(0, p.pillCount - 1) } : p
            )
        }));
        setActiveAlarm(null);
    };

    // FIXED: Now accepts the full Device object (fixing the TS2322 error)
    const handleConnect = (device: Device) => {
        setConnectedDevice(device.name || "MedBox Pro");
        setPhase(AppPhase.HOME);
    };

    const handleDisconnect = () => {
        setConnectedDevice(null);
        setPhase(AppPhase.BLUETOOTH);
    };

    // --- 5. RENDER ---
    if (phase === AppPhase.SPLASH) return <SplashScreen />;

    if (phase === AppPhase.BLUETOOTH) {
        return <BluetoothScreen onConnect={handleConnect} />;
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />
            <Layout onDisconnect={handleDisconnect}>
                {isLoading ? (
                    <LoadingScreen />
                ) : (
                    <PatientDashboard
                        patient={patient}
                        onUpdate={setPatient}
                    />
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
});

export default App;