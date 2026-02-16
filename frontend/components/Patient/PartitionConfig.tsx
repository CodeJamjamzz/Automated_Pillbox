// import React, { useState } from 'react';
// import {
//   View,
//   Text,
//   StyleSheet,
//   TouchableOpacity,
//   TextInput,
//   ScrollView,
//   KeyboardAvoidingView,
//   Platform,
//   Modal,
//   SafeAreaView,
//   Switch,
//   Alert
// } from 'react-native';
// import {
//   X,
//   Clock,
//   Calendar,
//   ChevronRight,
//   Check,
//   Plus,
//   Minus,
//   Activity,
//   ArrowLeft
// } from 'lucide-react-native';
// import DateTimePicker from '@react-native-community/datetimepicker';
// import axios from 'axios';
//
// // --- TYPES (Mocked for context if file is missing) ---
// interface Partition {
//   id: number;
//   label: string;
//   medicineName: string;
//   pillCount: number;
//   color_code: number;
//   duration_days?: number;
//   dosage?: string;
//   start_date?: string;
//   start_time?: string;
//   schedule?: string[];
// }
//
// interface PartitionConfigProps {
//   partition: Partition;
//   onSave: (data: any) => void;
//   onClose: () => void;
// }
//
// // --- CONSTANTS ---
// const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899']; // Red, Orange, Yellow, Green, Blue, Purple, Pink
//
// const PartitionConfig: React.FC<PartitionConfigProps> = ({ partition, onSave, onClose }) => {
//   const isEditMode = partition.label !== 'Unassigned';
//
//   // --- STATE MANAGEMENT ---
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);
//
//   // Form Data
//   const [medName, setMedName] = useState(isEditMode ? partition.medicineName : '');
//   const [pillCount, setPillCount] = useState(partition.pillCount || 1);
//   const [selectedColorIdx, setSelectedColorIdx] = useState(partition.color_code || 4);
//   const [dosage, setDosage] = useState(partition.dosage || '10mg');
//
//   // Schedule Logic
//   const [isWizardVisible, setWizardVisible] = useState(false);
//   const [wizardStep, setWizardStep] = useState<1 | 2>(1);
//
//   // Wizard State
//   const [prescriptionType, setPrescriptionType] = useState<'temporary' | 'maintenance'>(
//     partition.duration_days && partition.duration_days < 365 ? 'temporary' : 'maintenance'
//   );
//   const [tempDurationStr, setTempDurationStr] = useState(String(partition.duration_days || '7'));
//   const [timesPerDay, setTimesPerDay] = useState(1);
//   const [startDate, setStartDate] = useState(new Date());
//   const [firstDoseTime, setFirstDoseTime] = useState(new Date());
//
//   // Picker State
//   const [showPicker, setShowPicker] = useState(false);
//   const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
//
//   // --- HELPERS ---
//   const handleDateChange = (event: any, selectedDate?: Date) => {
//     if (Platform.OS === 'android') setShowPicker(false);
//     if (!selectedDate) return;
//
//     if (pickerMode === 'date') setStartDate(selectedDate);
//     else setFirstDoseTime(selectedDate);
//   };
//
//   const showDatePicker = (mode: 'date' | 'time') => {
//     setPickerMode(mode);
//     setShowPicker(true);
//   };
//
//   const handleSaveWrapper = async () => {
//     if (!medName.trim()) {
//       setError("Medicine Name is required.");
//       return;
//     }
//
//     setLoading(true);
//     setError(null);
//
//     try {
//       // 1. Calculate Schedule
//       const duration = prescriptionType === 'maintenance' ? 365 : parseInt(tempDurationStr) || 7;
//       const intervalHours = 16 / Math.max(timesPerDay, 1);
//
//       // Generate specific time strings
//       const generatedTimes: string[] = [];
//       for (let i = 0; i < timesPerDay; i++) {
//         const d = new Date(firstDoseTime);
//         d.setHours(d.getHours() + (i * intervalHours));
//         generatedTimes.push(d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
//       }
//
//       // 2. Prepare Payload
//       const payload = {
//         slotId: partition.id,
//         pillName: medName,
//         pillAmount: pillCount,
//         startTime: generatedTimes[0],
//         durationDays: duration,
//         dosage: dosage,
//         startDate: startDate.toISOString().split('T')[0],
//         intervalHours: intervalHours,
//         calculatedTimes: generatedTimes.join(",")
//       };
//
//       // 3. API Call (Mocked for safety if backend isn't reachable in this context)
//       // await axios.put(`https://192.168.1.192:8080/api/schedule/update/${partition.id}`, payload);
//
//       // Simulate network delay for UX
//       await new Promise(r => setTimeout(r, 800));
//
//       // 4. Update Parent
//       onSave({
//         ...partition,
//         label: medName,
//         medicineName: medName,
//         pillCount: pillCount,
//         color_code: selectedColorIdx,
//         duration_days: duration,
//         dosage: dosage,
//         schedule: generatedTimes,
//         start_date: payload.startDate,
//         start_time: payload.startTime
//       });
//       onClose();
//
//     } catch (err) {
//       setError("Failed to sync. Please check connection.");
//       console.error(err);
//     } finally {
//       setLoading(false);
//     }
//   };
//
//   // --- RENDERERS ---
//
//   // Render the Date/Time Picker Modal/Inline
//   const renderPicker = () => {
//     if (!showPicker) return null;
//     return (
//       <DateTimePicker
//         value={pickerMode === 'date' ? startDate : firstDoseTime}
//         mode={pickerMode}
//         display={Platform.OS === 'ios' ? 'spinner' : 'default'}
//         onChange={handleDateChange}
//         minimumDate={new Date()}
//       />
//     );
//   };
//
//   // Wizard Step 1: Type Selection
//   const renderWizardStep1 = () => (
//     <View style={styles.wizContent}>
//       <Text style={styles.wizHeader}>How long do you need this?</Text>
//
//       <TouchableOpacity
//         onPress={() => setPrescriptionType('temporary')}
//         style={[styles.typeCard, prescriptionType === 'temporary' && styles.typeCardActive]}
//       >
//         <View style={[styles.iconCircle, { backgroundColor: '#e0f2fe' }]}>
//           <Clock size={24} color="#0ea5e9" />
//         </View>
//         <View style={styles.typeTextContainer}>
//           <Text style={styles.typeTitle}>Temporary</Text>
//           <Text style={styles.typeSub}>Antibiotics, Painkillers, etc.</Text>
//         </View>
//         {prescriptionType === 'temporary' && <Check size={20} color="#0ea5e9" />}
//       </TouchableOpacity>
//
//       <TouchableOpacity
//         onPress={() => setPrescriptionType('maintenance')}
//         style={[styles.typeCard, prescriptionType === 'maintenance' && styles.typeCardActive]}
//       >
//         <View style={[styles.iconCircle, { backgroundColor: '#dcfce7' }]}>
//           <Calendar size={24} color="#22c55e" />
//         </View>
//         <View style={styles.typeTextContainer}>
//           <Text style={styles.typeTitle}>Maintenance</Text>
//           <Text style={styles.typeSub}>Daily Vitamins, Heart Meds</Text>
//         </View>
//         {prescriptionType === 'maintenance' && <Check size={20} color="#22c55e" />}
//       </TouchableOpacity>
//
//       <TouchableOpacity style={styles.btnPrimary} onPress={() => setWizardStep(2)}>
//         <Text style={styles.btnText}>Next Step</Text>
//         <ChevronRight color="#fff" size={20} />
//       </TouchableOpacity>
//     </View>
//   );
//
//   // Wizard Step 2: Details
//   const renderWizardStep2 = () => (
//     <ScrollView contentContainerStyle={styles.wizScroll}>
//       <Text style={styles.wizHeader}>Schedule Details</Text>
//
//       {/* Duration (Only for Temporary) */}
//       {prescriptionType === 'temporary' && (
//         <View style={styles.inputSection}>
//           <Text style={styles.inputLabel}>DURATION (DAYS)</Text>
//           <TextInput
//             style={styles.input}
//             value={tempDurationStr}
//             onChangeText={setTempDurationStr}
//             keyboardType="numeric"
//             placeholder="7"
//           />
//         </View>
//       )}
//
//       {/* Start Date */}
//       <View style={styles.inputSection}>
//         <Text style={styles.inputLabel}>START DATE</Text>
//         <TouchableOpacity style={styles.pickerBtn} onPress={() => showDatePicker('date')}>
//           <Calendar size={20} color="#64748b" />
//           <Text style={styles.pickerText}>{startDate.toDateString()}</Text>
//         </TouchableOpacity>
//       </View>
//
//       {/* Times Per Day */}
//       <View style={styles.inputSection}>
//         <Text style={styles.inputLabel}>TIMES PER DAY</Text>
//         <View style={styles.pillCounter}>
//           <TouchableOpacity onPress={() => setTimesPerDay(Math.max(1, timesPerDay - 1))} style={styles.counterBtn}>
//             <Minus size={20} color="#334155" />
//           </TouchableOpacity>
//           <Text style={styles.counterText}>{timesPerDay}</Text>
//           <TouchableOpacity onPress={() => setTimesPerDay(Math.min(6, timesPerDay + 1))} style={styles.counterBtn}>
//             <Plus size={20} color="#334155" />
//           </TouchableOpacity>
//         </View>
//       </View>
//
//       {/* First Dose */}
//       <View style={styles.inputSection}>
//         <Text style={styles.inputLabel}>FIRST DOSE TIME</Text>
//         <TouchableOpacity style={styles.pickerBtn} onPress={() => showDatePicker('time')}>
//           <Clock size={20} color="#64748b" />
//           <Text style={styles.pickerText}>
//             {firstDoseTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
//           </Text>
//         </TouchableOpacity>
//       </View>
//
//       {/* Platform specific picker rendering */}
//       {Platform.OS === 'ios' && showPicker && (
//          <View style={styles.iosPickerContainer}>
//             {renderPicker()}
//             <TouchableOpacity style={styles.iosPickerDone} onPress={() => setShowPicker(false)}>
//               <Text style={{color: '#2563eb', fontWeight:'600'}}>Done</Text>
//             </TouchableOpacity>
//          </View>
//       )}
//
//       <View style={{ height: 20 }} />
//
//       <TouchableOpacity style={styles.btnPrimary} onPress={() => setWizardVisible(false)}>
//         <Text style={styles.btnText}>Confirm Schedule</Text>
//         <Check color="#fff" size={20} />
//       </TouchableOpacity>
//     </ScrollView>
//   );
//
//   return (
//     <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
//
//       {/* HEADER */}
//       <SafeAreaView style={styles.headerArea}>
//         <View style={styles.header}>
//           <View>
//             <Text style={styles.headerTitle}>{isEditMode ? 'Edit Medication' : 'New Setup'}</Text>
//             <Text style={styles.headerSubtitle}>Slot #{partition.id}</Text>
//           </View>
//           <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
//             <X size={24} color="#64748b" />
//           </TouchableOpacity>
//         </View>
//       </SafeAreaView>
//
//       <ScrollView contentContainerStyle={styles.content}>
//         {error && (
//           <View style={styles.errorBanner}>
//             <Activity size={20} color="#dc2626" />
//             <Text style={styles.errorText}>{error}</Text>
//           </View>
//         )}
//
//         {/* 1. MEDICINE INFO */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>MEDICINE DETAILS</Text>
//           <TextInput
//             style={styles.mainInput}
//             value={medName}
//             onChangeText={setMedName}
//             placeholder="Medication Name (e.g. Ibuprofen)"
//             placeholderTextColor="#94a3b8"
//           />
//            <TextInput
//             style={[styles.mainInput, {marginTop: 12}]}
//             value={dosage}
//             onChangeText={setDosage}
//             placeholder="Dosage (e.g. 500mg)"
//             placeholderTextColor="#94a3b8"
//           />
//         </View>
//
//         {/* 2. PILL COUNT & COLOR */}
//         <View style={styles.row}>
//           <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
//             <Text style={styles.sectionTitle}>REFILL COUNT</Text>
//             <View style={styles.pillCounter}>
//               <TouchableOpacity onPress={() => setPillCount(Math.max(1, pillCount - 1))} style={styles.counterBtn}>
//                 <Minus size={20} color="#334155" />
//               </TouchableOpacity>
//               <Text style={styles.counterText}>{pillCount}</Text>
//               <TouchableOpacity onPress={() => setPillCount(pillCount + 1)} style={styles.counterBtn}>
//                 <Plus size={20} color="#334155" />
//               </TouchableOpacity>
//             </View>
//           </View>
//         </View>
//
//         <View style={styles.section}>
//             <Text style={styles.sectionTitle}>LED COLOR INDICATOR</Text>
//             <View style={styles.colorRow}>
//               {COLORS.map((c, idx) => (
//                 <TouchableOpacity
//                   key={c}
//                   onPress={() => setSelectedColorIdx(idx)}
//                   style={[
//                     styles.colorCircle,
//                     { backgroundColor: c },
//                     selectedColorIdx === idx && styles.colorCircleActive
//                   ]}
//                 >
//                   {selectedColorIdx === idx && <Check size={16} color="#fff" strokeWidth={3} />}
//                 </TouchableOpacity>
//               ))}
//             </View>
//         </View>
//
//         {/* 3. SCHEDULE SUMMARY CARD */}
//         <View style={styles.section}>
//           <Text style={styles.sectionTitle}>SCHEDULE</Text>
//           <TouchableOpacity style={styles.scheduleCard} onPress={() => {
//             setWizardVisible(true);
//             setWizardStep(1);
//           }}>
//             <View style={styles.scheduleInfo}>
//               <View style={styles.scheduleRow}>
//                 <Clock size={16} color="#64748b" />
//                 <Text style={styles.scheduleText}>
//                   {timesPerDay} time{timesPerDay > 1 ? 's' : ''} per day
//                 </Text>
//               </View>
//               <View style={styles.scheduleRow}>
//                 <Calendar size={16} color="#64748b" />
//                 <Text style={styles.scheduleText}>
//                   Starts {startDate.toLocaleDateString()}
//                 </Text>
//               </View>
//             </View>
//             <View style={styles.editBadge}>
//               <Text style={styles.editBadgeText}>Configure</Text>
//               <ChevronRight size={16} color="#2563eb" />
//             </View>
//           </TouchableOpacity>
//         </View>
//
//         <View style={{ height: 40 }} />
//       </ScrollView>
//
//       {/* FOOTER SAVE BUTTON */}
//       <View style={styles.footer}>
//         <TouchableOpacity
//           style={[styles.saveBtn, loading && styles.saveBtnDisabled]}
//           onPress={handleSaveWrapper}
//           disabled={loading}
//         >
//           {loading ? (
//              <Activity color="#fff" />
//           ) : (
//             <>
//               <Text style={styles.saveBtnText}>Save Medication</Text>
//               <Check color="#fff" size={20} />
//             </>
//           )}
//         </TouchableOpacity>
//       </View>
//
//       {/* --- WIZARD MODAL --- */}
//       <Modal visible={isWizardVisible} animationType="slide" presentationStyle="pageSheet">
//         <SafeAreaView style={styles.modalSafe}>
//           <View style={styles.modalHeader}>
//             <TouchableOpacity onPress={() => {
//               if(wizardStep === 2) setWizardStep(1);
//               else setWizardVisible(false);
//             }}>
//               {wizardStep === 2 ? <ArrowLeft size={24} color="#0f172a" /> : <X size={24} color="#0f172a" />}
//             </TouchableOpacity>
//             <Text style={styles.modalTitle}>Step {wizardStep} of 2</Text>
//             <View style={{ width: 24 }} />
//           </View>
//
//           <View style={styles.modalBody}>
//             {wizardStep === 1 ? renderWizardStep1() : renderWizardStep2()}
//           </View>
//
//           {/* Android Picker needs to be outside the render logic to float properly if modal used */}
//           {Platform.OS === 'android' && renderPicker()}
//         </SafeAreaView>
//       </Modal>
//
//     </KeyboardAvoidingView>
//   );
// };
//
// const styles = StyleSheet.create({
//   // Main Container
//   container: { flex: 1, backgroundColor: '#f8fafc' },
//   headerArea: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
//   header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
//   headerTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
//   headerSubtitle: { fontSize: 14, color: '#64748b', fontWeight: '500' },
//   closeBtn: { padding: 8, backgroundColor: '#f1f5f9', borderRadius: 50 },
//
//   content: { padding: 20 },
//
//   // Sections
//   section: { marginBottom: 24 },
//   sectionTitle: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8, letterSpacing: 0.5 },
//   row: { flexDirection: 'row' },
//
//   // Inputs
//   mainInput: {
//     backgroundColor: '#fff',
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//     borderRadius: 16,
//     padding: 16,
//     fontSize: 16,
//     color: '#0f172a',
//     shadowColor: '#64748b',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.05,
//     shadowRadius: 4,
//     elevation: 2
//   },
//
//   // Pill Counter
//   pillCounter: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     backgroundColor: '#fff',
//     borderRadius: 12,
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//     padding: 4,
//     justifyContent: 'space-between'
//   },
//   counterBtn: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 8 },
//   counterText: { fontSize: 18, fontWeight: 'bold', width: 40, textAlign: 'center' },
//
//   // Colors
//   colorRow: { flexDirection: 'row', justifyContent: 'space-between' },
//   colorCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
//   colorCircleActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 3 },
//
//   // Schedule Card
//   scheduleCard: {
//     backgroundColor: '#fff',
//     padding: 16,
//     borderRadius: 16,
//     borderWidth: 1,
//     borderColor: '#e2e8f0',
//     flexDirection: 'row',
//     justifyContent: 'space-between',
//     alignItems: 'center'
//   },
//   scheduleInfo: { gap: 8 },
//   scheduleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
//   scheduleText: { color: '#334155', fontWeight: '500' },
//   editBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', padding: 8, borderRadius: 8 },
//   editBadgeText: { color: '#2563eb', fontWeight: '700', fontSize: 12, marginRight: 4 },
//
//   // Footer
//   footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9' },
//   saveBtn: {
//     backgroundColor: '#2563eb',
//     padding: 18,
//     borderRadius: 16,
//     flexDirection: 'row',
//     justifyContent: 'center',
//     alignItems: 'center',
//     gap: 12,
//     shadowColor: '#2563eb',
//     shadowOffset: { width: 0, height: 4 },
//     shadowOpacity: 0.3,
//     shadowRadius: 8,
//     elevation: 4
//   },
//   saveBtnDisabled: { backgroundColor: '#94a3b8' },
//   saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
//
//   // Error
//   errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2', padding: 12, borderRadius: 12, marginBottom: 16, gap: 8 },
//   errorText: { color: '#dc2626', fontWeight: '600' },
//
//   // WIZARD STYLES
//   modalSafe: { flex: 1, backgroundColor: '#fff' },
//   modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: '#f1f5f9', alignItems: 'center' },
//   modalTitle: { fontWeight: '700', fontSize: 16 },
//   modalBody: { flex: 1, padding: 20 },
//   wizContent: { flex: 1, gap: 16 },
//   wizScroll: { paddingBottom: 40 },
//   wizHeader: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 20 },
//
//   typeCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', gap: 16, marginBottom: 12 },
//   typeCardActive: { borderColor: '#3b82f6', backgroundColor: '#f8fafc', borderWidth: 2 },
//   iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
//   typeTextContainer: { flex: 1 },
//   typeTitle: { fontWeight: '700', fontSize: 16, color: '#0f172a' },
//   typeSub: { color: '#64748b', fontSize: 13 },
//
//   btnPrimary: { backgroundColor: '#0f172a', padding: 18, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 'auto' },
//   btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
//
//   inputSection: { marginBottom: 20 },
//   inputLabel: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 8 },
//   input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16 },
//   pickerBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
//   pickerText: { fontSize: 16, color: '#0f172a' },
//
//   iosPickerContainer: { backgroundColor: '#f1f5f9', borderRadius: 12, overflow: 'hidden', marginTop: 10 },
//   iosPickerDone: { alignItems: 'flex-end', padding: 12, backgroundColor: '#e2e8f0' }
// });
//
// export default PartitionConfig;

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import {
  X,
  Clock,
  Check,
  Plus,
  Minus,
  Link as LinkIcon,
  Calendar
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';

// --- TYPES ---
interface Partition {
  id: number;
  label: string;
  medicineName: string;
  pillCount: number;
  color_code: number;
  duration_days?: number;
  dosage?: string;
  start_date?: string;
  start_time?: string;
  schedule?: string[];
  illness?: string;
  timesPerDay?: number;
}

interface PartitionConfigProps {
  partition: Partition;
  onSave: (data: any) => void;
  onClose: () => void;
}

// --- CONSTANTS ---
const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

// Update this IP to match your Spring Boot server's IP address
const API_BASE_URL = 'http://192.168.1.192:8080/api/schedule';

const PartitionConfig: React.FC<PartitionConfigProps> = ({ partition, onSave, onClose }) => {
  const isEditMode = partition.label !== 'Unassigned' && partition.medicineName !== '';

  // --- STATE INITIALIZATION ---
  const [illness, setIllness] = useState(partition.illness || '');
  const [medName, setMedName] = useState(partition.medicineName || '');
  const [pillCount, setPillCount] = useState(partition.pillCount || 0);

  // Schedule Details
  const [dosage, setDosage] = useState(partition.dosage || '');
  const [selectedColorIdx, setSelectedColorIdx] = useState(
    typeof partition.color_code === 'number' ? partition.color_code : 4
  );

  // Frequency
  const [timesPerDay, setTimesPerDay] = useState(() => {
    if (partition.timesPerDay) return partition.timesPerDay;
    if (partition.schedule && partition.schedule.length > 0) return partition.schedule.length;
    return 1;
  });

  // Date & Time
  const [startDate, setStartDate] = useState(() => {
    return partition.start_date ? new Date(partition.start_date) : new Date();
  });

  const [firstDoseTime, setFirstDoseTime] = useState(() => {
    if (partition.start_time) {
      const [hours, minutes] = partition.start_time.split(':').map(Number);
      const d = new Date();
      d.setHours(hours || 0);
      d.setMinutes(minutes || 0);
      d.setSeconds(0);
      return d;
    }
    return new Date();
  });

  // UI State
  const [isScheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [isScheduleConfigured, setIsScheduleConfigured] = useState(isEditMode);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

  // --- HANDLERS ---
  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (!selectedDate) return;
    if (pickerMode === 'date') setStartDate(selectedDate);
    else setFirstDoseTime(selectedDate);
  };

  const showDatePicker = (mode: 'date' | 'time') => {
    setPickerMode(mode);
    setShowPicker(true);
  };

  const confirmScheduleConfig = () => {
    setIsScheduleConfigured(true);
    setScheduleModalVisible(false);
  };

  const handleFinalSave = async () => {
    // Validation 1: Medicine Name
    if (!medName.trim()) {
      Alert.alert("Missing Information", "Please enter a medicine name.");
      return;
    }

    // Validation 2: Pill Count > 0
    if (pillCount <= 0) {
      Alert.alert("Invalid Pill Count", "Please add at least 1 pill to the inventory before saving.");
      return;
    }

    setLoading(true);

    try {
      const rawInterval = 24 / Math.max(timesPerDay, 1);
      const intervalHours = Math.floor(rawInterval);

      const generatedTimes: string[] = [];
      let currentScan = new Date(firstDoseTime);

      for (let i = 0; i < timesPerDay; i++) {
        generatedTimes.push(currentScan.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        currentScan.setHours(currentScan.getHours() + intervalHours);
      }
      const calculatedTimesStr = generatedTimes.join(",");

      const formattedStartDate = startDate.toISOString().split('T')[0];
      const formattedStartTime = firstDoseTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

      const apiPayload = {
        pillName: medName,
        illnessName: illness,
        pillAmount: pillCount,
        dosage: dosage,
        colorCode: selectedColorIdx,
        startDate: formattedStartDate,
        startTime: formattedStartTime,
        intervalHours: intervalHours,
        durationDays: 365,
        calculatedTimes: calculatedTimesStr
      };

      console.log("PUT Request to:", `${API_BASE_URL}/update/${partition.id}`);

      const response = await axios.put(`${API_BASE_URL}/update/${partition.id}`, apiPayload);

      if (response.status === 200) {
          const uiPayload = {
            ...partition,
            label: medName,
            medicineName: medName,
            illness: illness,
            pillCount: pillCount,
            color_code: selectedColorIdx,
            dosage: dosage,
            start_date: formattedStartDate,
            start_time: formattedStartTime,
            schedule: generatedTimes,
            timesPerDay: timesPerDay,
            duration_days: 365,
          };

          onSave(uiPayload);
          onClose();
      } else {
        throw new Error("Server returned status: " + response.status);
      }

    } catch (error) {
      console.error("Database Error:", error);
      Alert.alert("Sync Failed", "Could not save to the PillBox. Please check your Wi-Fi connection.");
    } finally {
      setLoading(false);
    }
  };

  const renderPicker = () => {
    if (!showPicker) return null;
    return (
      <DateTimePicker
        value={pickerMode === 'date' ? startDate : firstDoseTime}
        mode={pickerMode}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleDateChange}
        minimumDate={new Date()}
      />
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER SAFE AREA */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={24} color="#334155" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Configure Slot</Text>
                <Text style={styles.headerSubtitle}>DIGITAL-PHYSICAL MAPPING</Text>
            </View>
            <View style={{width: 40}} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>

            {/* ILLNESS */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>ILLNESS / PURPOSE</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. Heart Condition"
                    placeholderTextColor="#94a3b8"
                    value={illness}
                    onChangeText={setIllness}
                />
            </View>

            {/* MEDICINE */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>MEDICINE NAME</Text>
                <TextInput
                    style={[styles.input, styles.largeInput]}
                    placeholder="e.g. Atorvastatin 20mg"
                    placeholderTextColor="#94a3b8"
                    value={medName}
                    onChangeText={setMedName}
                />
            </View>

            {/* PILL COUNTER */}
            <View style={styles.counterSection}>
                <Text style={styles.label}>TOTAL PILLS LOADED</Text>
                <View style={styles.counterRow}>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => setPillCount(Math.max(0, pillCount - 1))}>
                        <Minus size={24} color="#64748b" />
                    </TouchableOpacity>
                    <View style={styles.countDisplay}>
                        <Text style={[styles.countText, pillCount === 0 && styles.countTextZero]}>{pillCount}</Text>
                        <Text style={styles.countLabel}>CURRENT INVENTORY</Text>
                    </View>
                    <TouchableOpacity style={styles.counterBtn} onPress={() => setPillCount(pillCount + 1)}>
                        <Plus size={24} color="#64748b" />
                    </TouchableOpacity>
                </View>
                {pillCount === 0 && (
                   <Text style={styles.errorText}>* Must be greater than 0</Text>
                )}
            </View>

            {/* SCHEDULE CARD */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>ALARM SCHEDULE</Text>
                {!isScheduleConfigured ? (
                    <TouchableOpacity style={styles.createScheduleCard} onPress={() => setScheduleModalVisible(true)}>
                        <View style={styles.blueIconBg}><Clock size={24} color="#fff" /></View>
                        <View>
                            <Text style={styles.cardTitle}>Create Schedule</Text>
                            <Text style={styles.cardSubtitle}>Tap to set time & frequency</Text>
                        </View>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.successScheduleCard} onPress={() => setScheduleModalVisible(true)}>
                        <View style={styles.greenIconBg}><Check size={24} color="#fff" /></View>
                        <View>
                            <Text style={styles.successTitle}>Schedule Configured</Text>
                            <Text style={styles.successSubtitle}>
                                {timesPerDay}x Daily • Starts {startDate.toLocaleDateString()}
                            </Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
            style={[styles.finalSaveBtn, pillCount === 0 && styles.finalSaveBtnDisabled]}
            onPress={handleFinalSave}
            disabled={loading}
        >
            {loading ? (
                <Text style={styles.finalSaveText}>SYNCING...</Text>
            ) : (
                <Text style={styles.finalSaveText}>SAVE CHANGES</Text>
            )}
        </TouchableOpacity>
      </View>

      {/* --- MAINTENANCE SCHEDULE MODAL --- */}
      <Modal visible={isScheduleModalVisible} animationType="slide" presentationStyle="pageSheet">
        {/* MODAL SAFE AREA" */}
        <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setScheduleModalVisible(false)}>
                    <Text style={styles.cancelText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.modalTitleContainer}>
                    <LinkIcon size={16} color="#2563eb" style={{marginRight: 6}} />
                    <Text style={styles.modalTitle}>Schedule Details</Text>
                    <View style={styles.badge}><Text style={styles.badgeText}>MAINTENANCE</Text></View>
                </View>
                <View style={{width: 40}} />
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
                {/* Row 1 */}
                <View style={styles.row}>
                    <View style={[styles.col, {marginRight: 10}]}>
                        <Text style={styles.modalLabel}>DOSAGE</Text>
                        <TextInput style={styles.modalInput} placeholder="e.g. 500mg" value={dosage} onChangeText={setDosage} />
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.modalLabel}>START DATE</Text>
                        <TouchableOpacity style={styles.modalInput} onPress={() => showDatePicker('date')}>
                            <Text style={styles.modalInputValue}>{startDate.toLocaleDateString('en-GB')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Row 2: STATIC EVERY DAY LABEL */}
                <View style={styles.inputGroup}>
                    <Text style={styles.modalLabel}>SCHEDULE TYPE</Text>
                    <View style={styles.staticInput}>
                        <Text style={styles.staticInputText}>Every Day</Text>
                        <Calendar size={18} color="#64748b" />
                    </View>
                </View>

                {/* Row 3 */}
                <View style={styles.row}>
                    <View style={[styles.col, {marginRight: 10}]}>
                        <Text style={styles.modalLabel}>TIMES PER DAY</Text>
                        <TextInput style={styles.modalInput} value={String(timesPerDay)} keyboardType="number-pad" onChangeText={(t) => setTimesPerDay(Number(t))} />
                    </View>
                    <View style={styles.col}>
                        <Text style={styles.modalLabel}>FIRST DOSE</Text>
                        <TouchableOpacity style={styles.modalInput} onPress={() => showDatePicker('time')}>
                            <Text style={styles.modalInputValue}>{firstDoseTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Row 4 */}
                <View style={styles.inputGroup}>
                    <Text style={styles.modalLabel}>LABEL COLOR</Text>
                    <View style={styles.colorRow}>
                        {COLORS.map((c, idx) => (
                            <TouchableOpacity key={c} onPress={() => setSelectedColorIdx(idx)} style={[styles.colorCircle, { backgroundColor: c }, selectedColorIdx === idx && styles.colorCircleActive]} />
                        ))}
                    </View>
                </View>

                {Platform.OS === 'ios' && showPicker && (
                    <View style={styles.pickerWrapper}>
                         {renderPicker()}
                         <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerDone}><Text style={{color: '#2563eb', fontWeight: 'bold'}}>Done</Text></TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.saveScheduleBtn} onPress={confirmScheduleConfig}>
                    <Text style={styles.saveScheduleText}>Save Schedule</Text>
                    <Check color="#fff" size={18} />
                </TouchableOpacity>
            </View>
            {Platform.OS === 'android' && renderPicker()}
        </SafeAreaView>
      </Modal>

      {/* SYNC OVERLAY */}
      {loading && (
        <View style={styles.loadingOverlay}>
            <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#2563eb" />
                <Text style={styles.loadingText}>Syncing with Cloud...</Text>
            </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // --- UPDATED SAFE AREA (TOP) ---
  safeArea: {
      backgroundColor: '#fff',
      // Adds specific padding for Android status bar overlap
      paddingTop: Platform.OS === 'android' ? 40 : 0
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  headerTextContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  headerSubtitle: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  closeBtn: { padding: 8 },
  content: { padding: 24 },

  inputGroup: { marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a', fontWeight: '500' },
  largeInput: { fontSize: 18, fontWeight: '600' },

  // Static Input for Every Day
  staticInput: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  staticInputText: { fontSize: 15, color: '#64748b', fontWeight: '600' },

  counterSection: { marginBottom: 24 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  counterBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  countDisplay: { alignItems: 'center' },
  countText: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
  countTextZero: { color: '#ef4444' }, // Red if 0
  countLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 4 },
  errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },

  createScheduleCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', gap: 12 },
  blueIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  cardSubtitle: { fontSize: 14, color: '#64748b' },

  successScheduleCard: { backgroundColor: '#f0fdf4', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbf7d0', gap: 12 },
  greenIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '700', color: '#15803d' },
  successSubtitle: { fontSize: 14, color: '#166534' },

  // --- UPDATED FOOTER (BOTTOM) ---
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    // Adds extra padding for Home Indicator / Navigation Bar
    paddingBottom: Platform.OS === 'ios' ? 48 : 34
  },
  finalSaveBtn: { backgroundColor: '#2563eb', borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  finalSaveBtnDisabled: { backgroundColor: '#94a3b8' },
  finalSaveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  modalContainer: {
      flex: 1,
      backgroundColor: '#f8fafc',
      // Ensure Modal also clears Android status bar
      paddingTop: Platform.OS === 'android' ? 20 : 0
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  cancelText: { color: '#64748b', fontSize: 16 },
  modalTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontWeight: '700', fontSize: 16, color: '#0f172a', marginRight: 8 },
  badge: { backgroundColor: '#dcfce7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { color: '#15803d', fontSize: 10, fontWeight: '700' },
  modalContent: { padding: 20 },
  row: { flexDirection: 'row', marginBottom: 20 },
  col: { flex: 1 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', fontWeight: '500' },
  modalInputValue: { fontSize: 15, color: '#0f172a' },
  colorRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  colorCircle: { width: 32, height: 32, borderRadius: 16 },
  colorCircleActive: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 3, transform: [{scale: 1.1}] },

  // --- UPDATED MODAL FOOTER ---
  modalFooter: {
      padding: 20,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderColor: '#f1f5f9',
      // Adds extra padding for Home Indicator
      paddingBottom: Platform.OS === 'ios' ? 34 : 24
  },
  saveScheduleBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveScheduleText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pickerWrapper: { backgroundColor: '#f1f5f9', marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  pickerDone: { alignItems: 'flex-end', padding: 12, backgroundColor: '#e2e8f0' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  loadingBox: { alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 16, fontWeight: '600', color: '#334155' }
});

export default PartitionConfig;