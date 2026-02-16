import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Alert } from 'react-native';
import { X, Clock, Calendar, ChevronRight, Pill, Check, Plus, Minus, Save, AlertTriangle, Trash2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { Partition } from '../../types';
import {inspect} from "node:util";
import styles = module

// --- CONSTANTS ---
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

  // --- 1. DATA REQUEST STATE (Updated for Spring Boot) ---
  const [dataRequest, setDataRequest] = useState({
    slotId: partition.id,
    pillName: isEditMode ? partition.medicineName : "",
    takerName: "User", // Corrected key from 'medicineName' to 'takerName'
    pillAmount: partition.pillCount || 0,
    startTime: "08:00",
    durationDays: partition.durationDays || 0,
    dosage: partition.dosage || "",
    startDate: new Date().toISOString().split('T')[0], // Default to today
    intervalHours: 0,
    calculatedTimes: ""
  });

  // --- 2. UI STATES ---
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
    partition.isShortTerm ? 'temporary' : 'maintenance'
  );

  const [tempDuration, setTempDuration] = useState(
    partition.durationDays ? String(partition.durationDays) : '7'
  );
  const [tempUnit, setTempUnit] = useState<'days' | 'weeks'>('days');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly'>(partition.frequencyType || 'daily');
  const [selectedDays, setSelectedDays] = useState<number[]>(partition.selectedDays || []);

  const [scheduleData, setScheduleData] = useState({
    dosage: partition.dosage || '',
    timesPerDay: partition.timesPerDay ? String(partition.timesPerDay) : '1',
    firstDoseTime: partition.schedule && partition.schedule.length > 0 ? new Date(partition.schedule[0]) : new Date(),
    startDate: new Date(),
    color: partition.colorTheme && partition.colorTheme !== '#cbd5e1' ? partition.colorTheme : COLORS[4],
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

  const toggleDay = (dayValue: number) => {
    setSelectedDays(prev =>
      prev.includes(dayValue) ? prev.filter(d => d !== dayValue) : [...prev, dayValue]
    );
  };

  const postMedConfig = async (partitionId: number, data: any) => {
    try {
        // REPLACE WITH YOUR BACKEND IP
        const response = await axios.put(`http://localhost:8080/api/schedule/update/${partitionId}`, data);
        return response.data;
    } catch (error) {
        console.error("Hardware Sync Error:", error);
        throw error;
    }
  };

  const handleWizardSave = () => {
    if (frequencyType === 'weekly' && selectedDays.length === 0) {
      return Alert.alert("Selection Required", "Please select at least one day of the week.");
    }
    setScheduleData(prev => ({ ...prev, isConfigured: true }));
    setWizardVisible(false);
  };

  const handleFinalSave = async () => {
    if (!basicInfo.medicineName.trim()) {
      setError("Medicine Name is required.");
      return;
    }
    if (!scheduleData.isConfigured) {
      setError("Please configure the schedule first.");
      return;
    }

    setSaving(true);
    setError(null);

    // 1. Calculations
    const finalDuration = prescriptionType === 'maintenance'
        ? 365
        : (parseInt(tempDuration) || 1) * (tempUnit === 'weeks' ? 7 : 1);

    const times = parseInt(scheduleData.timesPerDay) || 1;
    const interval = 16 / Math.max(times, 1);
    const generatedScheduleStrings: string[] = [];
    const startTimeDate = new Date(scheduleData.firstDoseTime);

    for (let i = 0; i < times; i++) {
      const nextDose = new Date(startTimeDate);
      if (i > 0) nextDose.setHours(startTimeDate.getHours() + (i * interval));
      generatedScheduleStrings.push(nextDose.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }

    // 2. Build the final dataRequest body with current UI states
    const finalRequest = {
        slotId: partition.id,
        pillName: basicInfo.medicineName,
        takerName: "Jamiel", // Set correctly
        pillAmount: basicInfo.pillCount,
        startTime: startTimeDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
        durationDays: finalDuration,
        dosage: scheduleData.dosage,
        startDate: scheduleData.startDate.toISOString().split('T')[0],
        intervalHours: interval,
        calculatedTimes: generatedScheduleStrings.join(",")
    };

    try {
        await postMedConfig(partition.id, finalRequest);

        onSave({
            ...partition,
            label: basicInfo.label || (prescriptionType === 'maintenance' ? 'Daily Meds' : 'Temporary'),
            medicineName: basicInfo.medicineName,
            pillCount: basicInfo.pillCount,
            dosage: scheduleData.dosage,
            colorTheme: scheduleData.color,
            durationDays: finalDuration,
            schedule: generatedScheduleStrings,
            timesPerDay: times,
            startDate: scheduleData.startDate
        });
        onClose();
    } catch (err) {
        setError("Failed to sync with medical kit. Ensure server is running.");
    } finally {
        setSaving(false);
    }
  };

  // ... (handleRemove and render methods remain the same as the previous correct code)

//   const handleRemove = () => {
//     Alert.alert("Remove Assignment", "Are you sure you want to clear this slot?", [
//       { text: "Cancel", style: "cancel" },
//       {
//         text: "Remove",
//         style: "destructive",
//         onPress: async () => {
//           setSaving(true);
//           const resetData = { slotId: partition.id, pillName: "Unassigned", pillAmount: 0, calculatedTimes: "", dosage: "", durationDays: 0 };
//           try {
//             await postMedConfig(partition.id, resetData);
//             onSave({ ...partition, label: 'Unassigned', medicineName: '', pillCount: 0, schedule: [] });
//             onClose();
//           } catch (e) { setError("Failed to reset slot on hardware."); }
//           setSaving(false);
//         }
//       }
//     ]);
//   };

  const renderWizardStep1 = () => (
    <View style={styles.wizContent}>
      <Text style={styles.wizTitle}>Prescription Type</Text>
      <Text style={styles.wizSubtitle}>How long will you be taking this?</Text>
      <View style={styles.cardContainer}>
        <TouchableOpacity onPress={() => setPrescriptionType('temporary')} style={[styles.typeCard, prescriptionType === 'temporary' ? styles.cardActiveTemp : styles.cardInactive]}>
          <View style={styles.cardHeader}><View style={[styles.iconBox, { backgroundColor: prescriptionType === 'temporary' ? '#3b82f6' : '#f1f5f9' }]}><Clock size={24} stroke={prescriptionType === 'temporary' ? '#fff' : '#64748b'} /></View><Text style={styles.cardTitle}>Temporary</Text></View>
          <Text style={styles.cardDesc}>Short-term treatment like antibiotics.</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setPrescriptionType('maintenance')} style={[styles.typeCard, prescriptionType === 'maintenance' ? styles.cardActiveMain : styles.cardInactive]}>
          <View style={styles.cardHeader}><View style={[styles.iconBox, { backgroundColor: prescriptionType === 'maintenance' ? '#10b981' : '#f1f5f9' }]}><Calendar size={24} stroke={prescriptionType === 'maintenance' ? '#fff' : '#64748b'} /></View><Text style={styles.cardTitle}>Maintenance</Text></View>
          <Text style={styles.cardDesc}>Long-term, ongoing medication.</Text>
        </TouchableOpacity>
      </View>
      {prescriptionType === 'temporary' && (
        <View style={styles.durationSection}>
          <Text style={styles.inputLabel}>SET DURATION</Text>
          <View style={styles.durationRow}>
            <TextInput style={styles.durationInput} keyboardType="number-pad" value={tempDuration} onChangeText={setTempDuration} />
            <View style={styles.unitToggle}>
              <TouchableOpacity style={[styles.unitBtn, tempUnit === 'days' && styles.unitBtnActive]} onPress={() => setTempUnit('days')}><Text style={[styles.unitText, tempUnit === 'days' && styles.unitTextActive]}>Days</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.unitBtn, tempUnit === 'weeks' && styles.unitBtnActive]} onPress={() => setTempUnit('weeks')}><Text style={[styles.unitText, tempUnit === 'weeks' && styles.unitTextActive]}>Weeks</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <View style={styles.wizFooter}>
        <TouchableOpacity style={styles.btnOutline} onPress={() => setWizardVisible(false)}><Text style={styles.btnOutlineText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={() => setWizardStep(2)}><Text style={styles.btnPrimaryText}>Next Step</Text><ChevronRight size={20} stroke="#fff" /></TouchableOpacity>
      </View>
    </View>
  );

  const renderWizardStep2 = () => (
    <ScrollView style={styles.wizScroll}>
      <View style={styles.detailHeader}>
        <View style={styles.titleRow}><Pill size={24} stroke="#2563eb" /><Text style={styles.detailTitle}>Schedule Details</Text></View>
        <View style={[styles.badge, prescriptionType === 'maintenance' ? { backgroundColor: '#d1fae5' } : { backgroundColor: '#dbeafe' }]}><Text style={[styles.badgeText, prescriptionType === 'maintenance' ? { color: '#047857' } : { color: '#1e40af' }]}>{prescriptionType.toUpperCase()}</Text></View>
      </View>
      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}><Text style={styles.inputLabel}>DOSAGE</Text><TextInput style={styles.textInput} placeholder="e.g. 500mg" value={scheduleData.dosage} onChangeText={(t) => setScheduleData({...scheduleData, dosage: t})} /></View>
        <View style={{ flex: 1 }}><Text style={styles.inputLabel}>START DATE</Text><TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('date')}><Text style={styles.dateBtnText}>{scheduleData.startDate.toLocaleDateString()}</Text></TouchableOpacity></View>
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>SCHEDULE TYPE</Text>
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleBtn, frequencyType === 'daily' && styles.toggleBtnActive]} onPress={() => setFrequencyType('daily')}><Text style={[styles.toggleText, frequencyType === 'daily' && styles.toggleTextActive]}>Every Day</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, frequencyType === 'weekly' && styles.toggleBtnActive]} onPress={() => setFrequencyType('weekly')}><Text style={[styles.toggleText, frequencyType === 'weekly' && styles.toggleTextActive]}>Specific Days</Text></TouchableOpacity>
        </View>
      </View>
      {frequencyType === 'weekly' && (
        <View style={styles.formGroup}>
          <Text style={styles.inputLabel}>SELECT DAYS</Text>
          <View style={styles.dayGrid}>
            {WEEKDAYS.map((day) => (
              <TouchableOpacity key={day.value} onPress={() => toggleDay(day.value)} style={[styles.dayChip, selectedDays.includes(day.value) ? styles.dayChipActive : styles.dayChipInactive]}>
                <Text style={[styles.dayText, selectedDays.includes(day.value) ? styles.dayTextActive : styles.dayTextInactive]}>{day.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      <View style={styles.rowInputs}>
        <View style={{ flex: 1 }}><Text style={styles.inputLabel}>TIMES PER DAY</Text><TextInput style={styles.textInput} keyboardType="number-pad" value={scheduleData.timesPerDay} onChangeText={(t) => setScheduleData({...scheduleData, timesPerDay: t})} /></View>
        <View style={{ flex: 1 }}><Text style={styles.inputLabel}>FIRST DOSE</Text><TouchableOpacity style={styles.dateBtn} onPress={() => openPicker('time')}><Text style={styles.dateBtnText}>{scheduleData.firstDoseTime.toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})}</Text></TouchableOpacity></View>
      </View>
      <View style={styles.formGroup}>
        <Text style={styles.inputLabel}>LABEL COLOR</Text>
        <View style={styles.colorRow}>{COLORS.map((c) => (
            <TouchableOpacity key={c} onPress={() => setScheduleData({...scheduleData, color: c})} style={[styles.colorDot, { backgroundColor: c }, scheduleData.color === c && styles.colorDotActive]} />
        ))}</View>
      </View>
      <View style={styles.wizFooter}>
        <TouchableOpacity style={styles.btnOutline} onPress={() => setWizardStep(1)}><Text style={styles.btnOutlineText}>Back</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnPrimary} onPress={handleWizardSave}><Text style={styles.btnPrimaryText}>Save Schedule</Text><Check size={20} stroke="#fff" /></TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}><View style={styles.idBadge}><Text style={styles.idBadgeText}>S{partition.id}</Text></View><View><Text style={styles.headerTitle}>{isEditMode ? 'Edit Slot' : 'Configure Slot'}</Text><Text style={styles.headerSubtitle}>DIGITAL-PHYSICAL MAPPING</Text></View></View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}><X size={24} stroke="#94a3b8" /></TouchableOpacity>
      </View>
      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        {error && <View style={styles.errorBanner}><AlertTriangle size={18} stroke="#e11d48" /><Text style={styles.errorText}>{error}</Text></View>}
        <View style={styles.inputGroup}><Text style={styles.label}>ILLNESS / PURPOSE</Text><TextInput style={styles.input} value={basicInfo.label} onChangeText={(text) => setBasicInfo({...basicInfo, label: text})} placeholder="e.g. Heart Condition" /></View>
        <View style={styles.inputGroup}><Text style={styles.label}>MEDICINE NAME</Text><TextInput style={styles.input} value={basicInfo.medicineName} onChangeText={(text) => updatePillData(text, basicInfo.pillCount)} placeholder="e.g. Atorvastatin 20mg" /></View>
        <View style={styles.inputGroup}><Text style={styles.label}>TOTAL PILLS LOADED</Text>
          <View style={styles.counter}>
            <TouchableOpacity onPress={() => updatePillData(basicInfo.medicineName, Math.max(1, basicInfo.pillCount - 1))} style={styles.counterBtn}><Minus size={24} stroke="#475569" /></TouchableOpacity>
            <View style={styles.counterDisplay}><Text style={styles.counterValue}>{basicInfo.pillCount}</Text><Text style={styles.counterLabel}>CURRENT INVENTORY</Text></View>
            <TouchableOpacity onPress={() => updatePillData(basicInfo.medicineName, basicInfo.pillCount + 1)} style={styles.counterBtn}><Plus size={24} stroke="#475569" /></TouchableOpacity>
          </View>
        </View>
        <View style={styles.scheduleGroup}><Text style={styles.label}>ALARM SCHEDULE</Text>
          <TouchableOpacity style={[styles.bigScheduleBtn, scheduleData.isConfigured && styles.bigScheduleBtnActive]} onPress={() => { setWizardStep(1); setWizardVisible(true); }}>
            <View style={[styles.scheduleIconCircle, scheduleData.isConfigured && {backgroundColor: '#22c55e'}]}>{scheduleData.isConfigured ? <Check size={32} stroke="#fff" /> : <Clock size={32} stroke="#fff" />}</View>
            <Text style={styles.scheduleBtnTitle}>{scheduleData.isConfigured ? 'Schedule Configured' : 'Create Schedule'}</Text>
            <Text style={styles.scheduleBtnSub}>{scheduleData.isConfigured ? 'Tap to edit settings' : 'Tap to set time & frequency'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleFinalSave} disabled={saving} style={[styles.submitBtn, saving && styles.submitBtnDisabled]}>
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={24} stroke="#fff" />}
          <Text style={styles.submitBtnText}>{saving ? "SYNCING..." : "SAVE CHANGES"}</Text>
        </TouchableOpacity>
        {isEditMode && <TouchableOpacity onPress={handleRemove} disabled={saving} style={styles.removeBtn}><Trash2 size={20} stroke="#ef4444" /><Text style={styles.removeBtnText}>Remove Slot Assignment</Text></TouchableOpacity>}
      </ScrollView>
      <Modal visible={isWizardVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setWizardVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}><Text style={styles.modalHeaderTitle}>Setup Wizard</Text><TouchableOpacity onPress={() => setWizardVisible(false)} style={styles.closeBtn}><X size={24} stroke="#64748b" /></TouchableOpacity></View>
          {wizardStep === 1 ? renderWizardStep1() : renderWizardStep2()}
        </View>
        {showPicker && <DateTimePicker value={pickerMode === 'date' ? scheduleData.startDate : scheduleData.firstDoseTime} mode={pickerMode} display="default" onChange={onPickerChange} />}
      </Modal>
    </KeyboardAvoidingView>
  );
};

// ... (styles stay the same)bufeu

export default PartitionConfig;