import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { X, Clock, Calendar, ChevronRight, Pill, Check, Plus, Minus, Save, AlertTriangle, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { Partition } from '../../types';

// --- CONSTANTS ---//
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
const WEEKDAYS = [
    { label: 'Sun', value: 0 }, { label: 'Mon', value: 1 }, { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 }, { label: 'Thu', value: 4 }, { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
];

interface PartitionConfigProps {
    partition: Partition;
    onSave: (data: any) => void;
    onClose: () => void;
}

const PartitionConfig: React.FC<PartitionConfigProps> = ({ partition, onSave, onClose }) => {
    const isEditMode = partition.label !== 'Unassigned';

    // --- 1. UI STATES (Standardized to match backend keys) ---
    const [basicInfo, setBasicInfo] = useState({
        label: isEditMode ? partition.label : '',
        medicineName: isEditMode ? partition.medicineName : '',
        pillCount: partition.pillCount === 0 ? 1 : partition.pillCount,
    });

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isWizardVisible, setWizardVisible] = useState(false);
    const [wizardStep, setWizardStep] = useState<1 | 2>(1);

    const [prescriptionType, setPrescriptionType] = useState<'temporary' | 'maintenance'>(
        partition.duration_days && partition.duration_days < 365 ? 'temporary' : 'maintenance'
    );

    const [tempDuration, setTempDuration] = useState(String(partition.duration_days || '7'));
    const [tempUnit, setTempUnit] = useState<'days' | 'weeks'>('days');
    const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly'>('daily');
    const [selectedDays, setSelectedDays] = useState<number[]>([]);

    const [scheduleData, setScheduleData] = useState({
        dosage: partition.dosage || '',
        timesPerDay: '1',
        firstDoseTime: new Date(),
        startDate: new Date(),
        color: COLORS[partition.color_code] || COLORS[4],
        isConfigured: isEditMode
    });

    const [showPicker, setShowPicker] = useState(false);
    const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

    // --- HELPERS ---
    const updatePillData = (name: string, count: number) => {
        setBasicInfo({ ...basicInfo, medicineName: name, pillCount: count });
    };

    const openPicker = (mode: 'date' | 'time') => {
        setPickerMode(mode);
        setShowPicker(true);
    };

    const onPickerChange = (event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') setShowPicker(false);
        if (!selectedDate) return;

        if (pickerMode === 'date') {
            setScheduleData({ ...scheduleData, startDate: selectedDate });
        } else {
            setScheduleData({ ...scheduleData, firstDoseTime: selectedDate });
        }
    };

    // Find this function around line 100
    const postMedConfig = async (partitionId: number, data: any) => {
        try {
            // CHANGED: Use your Local IP (HTTP) instead of localhost or Render
            const response = await axios.put(`http://172.20.10.5:8080/api/schedule/update/${partitionId}`, data);
            return response.data;
        } catch (error) {
            console.error("Hardware Sync Error:", error);
            throw error;
        }
    };

    const handleFinalSave = async () => {
        if (!basicInfo.medicineName.trim()) {
            setError("Medicine Name is required.");
            return;
        }
        setSaving(true);
        setError(null);

        // Calculation Logic
        const finalDuration = prescriptionType === 'maintenance' ? 365 : parseInt(tempDuration) * (tempUnit === 'weeks' ? 7 : 1);
        const times = parseInt(scheduleData.timesPerDay) || 1;
        const interval = 16 / Math.max(times, 1);
        const generatedTimes: string[] = [];

        for (let i = 0; i < times; i++) {
            const d = new Date(scheduleData.firstDoseTime);
            d.setHours(d.getHours() + (i * interval));
            generatedTimes.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
        }

        const payload = {
            slotId: partition.id,
            pillName: basicInfo.medicineName,
            takerName: "User",
            pillAmount: basicInfo.pillCount,
            startTime: generatedTimes[0],
            durationDays: finalDuration,
            dosage: scheduleData.dosage,
            startDate: scheduleData.startDate.toISOString().split('T')[0],
            intervalHours: interval,
            calculatedTimes: generatedTimes.join(",")
        };

        try {
            await postMedConfig(partition.id, payload);
            onSave({
                ...partition,
                label: basicInfo.label || "Medication",
                medicineName: basicInfo.medicineName,
                pillCount: basicInfo.pillCount,
                color_code: COLORS.indexOf(scheduleData.color),
                duration_days: finalDuration,
                dosage: scheduleData.dosage,
                schedule: generatedTimes,
                start_date: payload.startDate,
                start_time: payload.startTime
            });
            onClose();
        } catch (err) {
            setError("Failed to sync with cloud. Check network.");
        } finally {
            setSaving(false);
        }
    };

    // Rendering logic for steps...
    const renderWizardStep1 = () => (
        <View style={styles.wizContent}>
            <Text style={styles.wizTitle}>Prescription Type</Text>
            <View style={styles.cardContainer}>
                <TouchableOpacity onPress={() => setPrescriptionType('temporary')} style={[styles.typeCard, prescriptionType === 'temporary' ? styles.cardActiveTemp : styles.cardInactive]}>
                    <Text style={styles.cardTitle}>Temporary</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPrescriptionType('maintenance')} style={[styles.typeCard, prescriptionType === 'maintenance' ? styles.cardActiveMain : styles.cardInactive]}>
                    <Text style={styles.cardTitle}>Maintenance</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.wizFooter}>
                <TouchableOpacity style={styles.btnPrimary} onPress={() => setWizardStep(2)}><Text style={styles.btnPrimaryText}>Next Step</Text></TouchableOpacity>
            </View>
        </View>
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{isEditMode ? 'Edit' : 'Configure'} Slot S{partition.id}</Text>
                <TouchableOpacity onPress={onClose}><X size={24} stroke="#94a3b8" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.formContent}>
                {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>MEDICINE NAME</Text>
                    <TextInput style={styles.input} value={basicInfo.medicineName} onChangeText={(t) => setBasicInfo({...basicInfo, medicineName: t})} placeholder="e.g. Aspirin" />
                </View>
                <TouchableOpacity style={[styles.bigScheduleBtn, scheduleData.isConfigured && styles.bigScheduleBtnActive]} onPress={() => setWizardVisible(true)}>
                    <Text style={styles.scheduleBtnTitle}>{scheduleData.isConfigured ? 'Schedule Set' : 'Configure Schedule'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleFinalSave} disabled={saving} style={styles.submitBtn}>
                    <Text style={styles.submitBtnText}>{saving ? "SYNCING..." : "SAVE CHANGES"}</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={isWizardVisible} animationType="slide">
                <View style={styles.modalContainer}>
                    {wizardStep === 1 ? renderWizardStep1() : <View><Text>Step 2 Logic</Text><TouchableOpacity onPress={() => setWizardVisible(false)}><Text>Close</Text></TouchableOpacity></View>}
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#f1f5f9' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    formContent: { padding: 20, gap: 20 },
    inputGroup: { gap: 8 },
    label: { fontSize: 12, fontWeight: '900', color: '#94a3b8' },
    input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16 },
    bigScheduleBtn: { backgroundColor: '#3b82f6', padding: 24, borderRadius: 24, alignItems: 'center' },
    bigScheduleBtnActive: { backgroundColor: '#10b981' },
    scheduleBtnTitle: { color: '#fff', fontWeight: 'bold' },
    submitBtn: { backgroundColor: '#2563eb', padding: 20, borderRadius: 20, alignItems: 'center' },
    submitBtnText: { color: '#fff', fontWeight: 'bold' },
    errorBanner: { backgroundColor: '#fef2f2', padding: 12, borderRadius: 12 },
    errorText: { color: '#dc2626', fontWeight: 'bold' },
    modalContainer: { flex: 1, padding: 40, justifyContent: 'center' },
    wizContent: { gap: 20 },
    wizTitle: { fontSize: 24, fontWeight: 'bold' },
    cardContainer: { gap: 12 },
    typeCard: { padding: 20, borderRadius: 12, borderWidth: 1 },
    cardActiveTemp: { borderColor: '#3b82f6', backgroundColor: '#eff6ff' },
    cardActiveMain: { borderColor: '#10b981', backgroundColor: '#ecfdf5' },
    cardInactive: { borderColor: '#e2e8f0' },
    cardTitle: { fontWeight: 'bold' },
    wizFooter: { marginTop: 20 },
    btnPrimary: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center' },
    btnPrimaryText: { color: '#fff', fontWeight: 'bold' }
});

export default PartitionConfig;