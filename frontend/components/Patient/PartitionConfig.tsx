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
//   ActivityIndicator,
//   Alert
// } from 'react-native';
// import {
//   X,
//   Clock,
//   Check,
//   Plus,
//   Minus,
//   Link as LinkIcon
// } from 'lucide-react-native';
// import DateTimePicker from '@react-native-community/datetimepicker';

// // --- TYPES ---
// interface Partition {
//   id: number;
//   label: string;
//   medicineName: string;
//   pillCount: number;
//   duration_days?: number;
//   dosage?: string;
//   start_date?: string;
//   start_time?: string;
//   schedule?: string[];
//   illness?: string;
//   timesPerDay?: number;
//   selectedDays?: number[];
// }

// interface PartitionConfigProps {
//   partition: Partition;
//   onSave: (data: any) => void;
//   onClose: () => void;
// }

// const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// const PartitionConfig: React.FC<PartitionConfigProps> = ({ partition, onSave, onClose }) => {
//   const isEditMode = partition.label !== 'Unassigned' && partition.medicineName !== '';

//   // --- STATE INITIALIZATION ---
//   const [illness, setIllness] = useState(partition.illness || '');
//   const [medName, setMedName] = useState(partition.medicineName || '');
//   const [pillCount, setPillCount] = useState(partition.pillCount || 0);
//   const [dosage, setDosage] = useState(partition.dosage || '');

//   // Schedule Details
//   const [timesPerDay, setTimesPerDay] = useState(() => {
//     if (partition.timesPerDay) return partition.timesPerDay;
//     if (partition.schedule && partition.schedule.length > 0) return partition.schedule.length;
//     return 1;
//   });

//   // Selected Days Array (0 = Sunday, 6 = Saturday)
//   const [selectedDays, setSelectedDays] = useState<number[]>(() => {
//     return partition.selectedDays && partition.selectedDays.length > 0
//       ? partition.selectedDays
//       : [0, 1, 2, 3, 4, 5, 6];
//   });

//   // Date & Time
//   const [startDate, setStartDate] = useState(() => {
//     return partition.start_date ? new Date(partition.start_date) : new Date();
//   });

//   const [firstDoseTime, setFirstDoseTime] = useState(() => {
//     if (partition.start_time) {
//       const [hours, minutes] = partition.start_time.split(':').map(Number);
//       const d = new Date();
//       d.setHours(hours || 0);
//       d.setMinutes(minutes || 0);
//       d.setSeconds(0);
//       return d;
//     }
//     return new Date();
//   });

//   // UI State
//   const [isScheduleModalVisible, setScheduleModalVisible] = useState(false);
//   const [isScheduleConfigured, setIsScheduleConfigured] = useState(isEditMode);
//   const [loading, setLoading] = useState(false);
//   const [showPicker, setShowPicker] = useState(false);
//   const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');

//   // --- HANDLERS ---
//   const handleDateChange = (event: any, selectedDate?: Date) => {
//     if (Platform.OS === 'android') setShowPicker(false);
//     if (!selectedDate) return;
//     if (pickerMode === 'date') setStartDate(selectedDate);
//     else setFirstDoseTime(selectedDate);
//   };

//   const showDatePicker = (mode: 'date' | 'time') => {
//     setPickerMode(mode);
//     setShowPicker(true);
//   };

//   const toggleDay = (index: number) => {
//     if (selectedDays.includes(index)) {
//       if (selectedDays.length > 1) { 
//         setSelectedDays(selectedDays.filter(d => d !== index));
//       } else {
//         Alert.alert("Invalid Selection", "You must select at least one day.");
//       }
//     } else {
//       setSelectedDays([...selectedDays, index].sort());
//     }
//   };

//   const confirmScheduleConfig = () => {
//     setIsScheduleConfigured(true);
//     setScheduleModalVisible(false);
//   };

//   // --- REMOVE MEDICATION HANDLER ---
//   const handleRemove = () => {
//     Alert.alert(
//       "Remove Medication",
//       "Are you sure you want to delete this medication? This will clear the slot and delete its schedule.",
//       [
//         { text: "Cancel", style: "cancel" },
//         {
//           text: "Remove",
//           style: "destructive", // Makes the button red on iOS
//           onPress: () => {
//             setLoading(true);
            
//             // Create a completely empty payload to overwrite the database
//             const emptyPayload = {
//               ...partition,
//               label: 'Unassigned',
//               medicineName: '',
//               illness: '',
//               pillCount: 0,
//               dosage: '',
//               start_date: '',
//               start_time: '',
//               schedule: [],
//               timesPerDay: 1,
//               selectedDays: [0, 1, 2, 3, 4, 5, 6],
//               duration_days: 0,
//             };

//             onSave(emptyPayload);
//             onClose();
//           }
//         }
//       ]
//     );
//   };

//   const handleFinalSave = async () => {
//     if (!medName.trim()) {
//       Alert.alert("Missing Information", "Please enter a medicine name.");
//       return;
//     }
//     if (pillCount <= 0) {
//       Alert.alert("Invalid Pill Count", "Please add at least 1 pill to the inventory before saving.");
//       return;
//     }

//     setLoading(true);

//     try {
//       const intervalHours = Math.floor(24 / Math.max(timesPerDay, 1));
//       const generatedTimes: string[] = [];
      
//       const startHour = firstDoseTime.getHours();
//       const startMinute = firstDoseTime.getMinutes();

//       for (let i = 0; i < timesPerDay; i++) {
//         let calcHour = (startHour + (intervalHours * i)) % 24;
//         let formattedHour = calcHour.toString().padStart(2, '0');
//         let formattedMinute = startMinute.toString().padStart(2, '0');
//         generatedTimes.push(`${formattedHour}:${formattedMinute}`);
//       }

//       const formattedStartDate = startDate.toISOString().split('T')[0];
//       const formattedStartTime = firstDoseTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

//       const uiPayload = {
//         ...partition,
//         label: medName,
//         medicineName: medName,
//         illness: illness,
//         pillCount: pillCount,
//         dosage: dosage,
//         start_date: formattedStartDate,
//         start_time: formattedStartTime, 
//         schedule: generatedTimes,
//         timesPerDay: timesPerDay,
//         selectedDays: selectedDays, 
//         duration_days: 365,
//       };

//       onSave(uiPayload);
//       onClose();

//     } catch (error) {
//       console.error("Config Error:", error);
//       Alert.alert("Error", "Could not configure the schedule.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const renderPicker = () => {
//     if (!showPicker) return null;
//     return (
//       <DateTimePicker
//         value={pickerMode === 'date' ? startDate : firstDoseTime}
//         mode={pickerMode}
//         display={Platform.OS === 'ios' ? 'spinner' : 'default'}
//         onChange={handleDateChange}
//         minimumDate={new Date()}
//         textColor="#0f172a"
//         themeVariant="light"
//       />
//     );
//   };

//   return (
//     <View style={styles.container}>
//       <SafeAreaView style={styles.safeArea}>
//         <View style={styles.header}>
//             <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
//                 <X size={24} color="#334155" />
//             </TouchableOpacity>
//             <View style={styles.headerTextContainer}>
//                 <Text style={styles.headerTitle}>Configure Slot</Text>
//                 <Text style={styles.headerSubtitle}>DIGITAL-PHYSICAL MAPPING</Text>
//             </View>
//             <View style={{width: 40}} />
//         </View>
//       </SafeAreaView>

//       <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
//         <ScrollView contentContainerStyle={styles.content}>

//             {/* ILLNESS */}
//             <View style={styles.inputGroup}>
//                 <Text style={styles.label}>ILLNESS / PURPOSE</Text>
//                 <TextInput style={styles.input} placeholder="e.g. Heart Condition" placeholderTextColor="#94a3b8" value={illness} onChangeText={setIllness} />
//             </View>

//             {/* MEDICINE */}
//             <View style={styles.inputGroup}>
//                 <Text style={styles.label}>MEDICINE NAME</Text>
//                 <TextInput style={[styles.input, styles.largeInput]} placeholder="e.g. Atorvastatin 20mg" placeholderTextColor="#94a3b8" value={medName} onChangeText={setMedName} />
//             </View>

//             {/* PILL COUNTER */}
//             <View style={styles.counterSection}>
//                 <Text style={styles.label}>TOTAL PILLS LOADED</Text>
//                 <View style={styles.counterRow}>
//                     <TouchableOpacity style={styles.counterBtn} onPress={() => setPillCount(Math.max(0, pillCount - 1))}>
//                         <Minus size={24} color="#64748b" />
//                     </TouchableOpacity>
//                     <View style={styles.countDisplay}>
//                         <Text style={[styles.countText, pillCount === 0 && styles.countTextZero]}>{pillCount}</Text>
//                         <Text style={styles.countLabel}>CURRENT INVENTORY</Text>
//                     </View>
//                     <TouchableOpacity style={styles.counterBtn} onPress={() => setPillCount(pillCount + 1)}>
//                         <Plus size={24} color="#64748b" />
//                     </TouchableOpacity>
//                 </View>
//                 {pillCount === 0 && <Text style={styles.errorText}>* Must be greater than 0</Text>}
//             </View>

//             {/* SCHEDULE CARD */}
//             <View style={styles.inputGroup}>
//                 <Text style={styles.label}>ALARM SCHEDULE</Text>
//                 {!isScheduleConfigured ? (
//                     <TouchableOpacity style={styles.createScheduleCard} onPress={() => setScheduleModalVisible(true)}>
//                         <View style={styles.blueIconBg}><Clock size={24} color="#fff" /></View>
//                         <View>
//                             <Text style={styles.cardTitle}>Create Schedule</Text>
//                             <Text style={styles.cardSubtitle}>Tap to set time & frequency</Text>
//                         </View>
//                     </TouchableOpacity>
//                 ) : (
//                     <TouchableOpacity style={styles.successScheduleCard} onPress={() => setScheduleModalVisible(true)}>
//                         <View style={styles.greenIconBg}><Check size={24} color="#fff" /></View>
//                         <View>
//                             <Text style={styles.successTitle}>Schedule Configured</Text>
//                             <Text style={styles.successSubtitle}>
//                                 {timesPerDay}x Daily • Starts {startDate.toLocaleDateString()}
//                             </Text>
//                         </View>
//                     </TouchableOpacity>
//                 )}
//             </View>
//         </ScrollView>
//       </KeyboardAvoidingView>

//       <View style={styles.footer}>
//         <TouchableOpacity style={[styles.finalSaveBtn, pillCount === 0 && styles.finalSaveBtnDisabled]} onPress={handleFinalSave} disabled={loading}>
//             {loading ? <Text style={styles.finalSaveText}>SAVING...</Text> : <Text style={styles.finalSaveText}>SAVE CHANGES</Text>}
//         </TouchableOpacity>

//         {/* --- NEW REMOVE BUTTON --- Only shows if the slot is currently occupied */}
//         {isEditMode && (
//           <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={loading}>
//             <Text style={styles.removeBtnText}>REMOVE MEDICATION</Text>
//           </TouchableOpacity>
//         )}
//       </View>

//       {/* --- MAINTENANCE SCHEDULE MODAL --- */}
//       <Modal visible={isScheduleModalVisible} animationType="slide" presentationStyle="pageSheet">
//         <SafeAreaView style={styles.modalContainer}>
//             <View style={styles.modalHeader}>
//                 <TouchableOpacity onPress={() => setScheduleModalVisible(false)}><Text style={styles.cancelText}>Back</Text></TouchableOpacity>
//                 <View style={styles.modalTitleContainer}>
//                     <LinkIcon size={16} color="#2563eb" style={{marginRight: 6}} />
//                     <Text style={styles.modalTitle}>Schedule Details</Text>
//                 </View>
//                 <View style={{width: 40}} />
//             </View>

//             <ScrollView contentContainerStyle={styles.modalContent}>
//                 {/* Row 1 */}
//                 <View style={styles.row}>
//                     <View style={[styles.col, {marginRight: 10}]}>
//                         <Text style={styles.modalLabel}>DOSAGE</Text>
//                         <TextInput style={styles.modalInput} placeholder="e.g. 500mg" value={dosage} onChangeText={setDosage} />
//                     </View>
//                     <View style={styles.col}>
//                         <Text style={styles.modalLabel}>START DATE</Text>
//                         <TouchableOpacity style={styles.modalInput} onPress={() => showDatePicker('date')}>
//                             <Text style={styles.modalInputValue}>{startDate.toLocaleDateString('en-GB')}</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>

//                 {/* SCHEDULE TYPE (Interactive Days) */}
//                 <View style={styles.inputGroup}>
//                     <Text style={styles.modalLabel}>
//                       SCHEDULE TYPE: {selectedDays.length === 7 ? 'Every Day' : 'Custom Days'}
//                     </Text>
//                     <View style={styles.daysRow}>
//                         {DAYS_OF_WEEK.map((day, idx) => {
//                             const isSelected = selectedDays.includes(idx);
//                             return (
//                                 <TouchableOpacity 
//                                   key={idx} 
//                                   onPress={() => toggleDay(idx)} 
//                                   style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
//                                 >
//                                     <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
//                                 </TouchableOpacity>
//                             );
//                         })}
//                     </View>
//                 </View>

//                 {/* Row 3 */}
//                 <View style={styles.row}>
//                     <View style={[styles.col, {marginRight: 10}]}>
//                         <Text style={styles.modalLabel}>TIMES PER DAY</Text>
//                         <TextInput style={styles.modalInput} value={String(timesPerDay)} keyboardType="number-pad" onChangeText={(t) => setTimesPerDay(Number(t))} />
//                     </View>
//                     <View style={styles.col}>
//                         <Text style={styles.modalLabel}>FIRST DOSE</Text>
//                         <TouchableOpacity style={styles.modalInput} onPress={() => showDatePicker('time')}>
//                             <Text style={styles.modalInputValue}>{firstDoseTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>

//                 {Platform.OS === 'ios' && showPicker && (
//                     <View style={styles.pickerWrapper}>
//                          {renderPicker()}
//                          <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.pickerDone}><Text style={{color: '#2563eb', fontWeight: 'bold'}}>Done</Text></TouchableOpacity>
//                     </View>
//                 )}
//             </ScrollView>

//             <View style={styles.modalFooter}>
//                 <TouchableOpacity style={styles.saveScheduleBtn} onPress={confirmScheduleConfig}>
//                     <Text style={styles.saveScheduleText}>Save Schedule</Text>
//                     <Check color="#fff" size={18} />
//                 </TouchableOpacity>
//             </View>
//             {Platform.OS === 'android' && renderPicker()}
//         </SafeAreaView>
//       </Modal>
//     </View>
//   );
// };

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: '#f8fafc' },
//   safeArea: { backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 40 : 0 },
//   header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f1f5f9' },
//   headerTextContainer: { alignItems: 'center' },
//   headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
//   headerSubtitle: { fontSize: 10, color: '#94a3b8', fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
//   closeBtn: { padding: 8 },
//   content: { padding: 24 },
//   inputGroup: { marginBottom: 24 },
//   label: { fontSize: 12, fontWeight: '700', color: '#94a3b8', marginBottom: 10, letterSpacing: 0.5 },
//   input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a', fontWeight: '500' },
//   largeInput: { fontSize: 18, fontWeight: '600' },
//   counterSection: { marginBottom: 24 },
//   counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
//   counterBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
//   countDisplay: { alignItems: 'center' },
//   countText: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
//   countTextZero: { color: '#ef4444' }, 
//   countLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8', marginTop: 4 },
//   errorText: { color: '#ef4444', fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },
//   createScheduleCard: { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', gap: 12 },
//   blueIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
//   cardTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
//   cardSubtitle: { fontSize: 14, color: '#64748b' },
//   successScheduleCard: { backgroundColor: '#f0fdf4', borderRadius: 20, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#bbf7d0', gap: 12 },
//   greenIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
//   successTitle: { fontSize: 18, fontWeight: '700', color: '#15803d' },
//   successSubtitle: { fontSize: 14, color: '#166534' },
//   footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 48 : 34 },
//   finalSaveBtn: { backgroundColor: '#2563eb', borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
//   finalSaveBtnDisabled: { backgroundColor: '#94a3b8' },
//   finalSaveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  
//   // --- NEW REMOVE BUTTON STYLES ---
//   removeBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
//   removeBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },

//   modalContainer: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 20 : 0 },
//   modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
//   cancelText: { color: '#64748b', fontSize: 16 },
//   modalTitleContainer: { flexDirection: 'row', alignItems: 'center' },
//   modalTitle: { fontWeight: '700', fontSize: 16, color: '#0f172a', marginRight: 8 },
//   modalContent: { padding: 20 },
//   row: { flexDirection: 'row', marginBottom: 20 },
//   col: { flex: 1 },
//   modalLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
//   modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', fontWeight: '500' },
//   modalInputValue: { fontSize: 15, color: '#0f172a' },

//   daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
//   dayCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
//   dayCircleActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
//   dayText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
//   dayTextActive: { color: '#ffffff' },

//   modalFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 34 : 24 },
//   saveScheduleBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
//   saveScheduleText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
//   pickerWrapper: { backgroundColor: '#f1f5f9', marginTop: 16, borderRadius: 12, overflow: 'hidden' },
//   pickerDone: { alignItems: 'flex-end', padding: 12, backgroundColor: '#e2e8f0' }
// });

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
  Alert
} from 'react-native';
import {
  X,
  Clock,
  Check,
  Plus,
  Minus,
  Link as LinkIcon
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

// --- TYPES ---
interface Partition {
  id: number;
  label: string;
  medicineName: string;
  pillCount: number;
  duration_days?: number;
  dosage?: string;
  start_date?: string;
  start_time?: string;
  schedule?: string[];
  illness?: string;
  timesPerDay?: number;
  selectedDays?: number[];
}

interface PartitionConfigProps {
  partition: Partition;
  onSave: (data: any) => void;
  onClose: () => void;
}

const DAYS_OF_WEEK = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const PartitionConfig: React.FC<PartitionConfigProps> = ({ partition, onSave, onClose }) => {
  const isEditMode = partition.label !== 'Unassigned' && partition.medicineName !== '';

  // --- STATE INITIALIZATION ---
  const [illness, setIllness] = useState(partition.illness || '');
  const [medName, setMedName] = useState(partition.medicineName || '');
  const [pillCount, setPillCount] = useState(partition.pillCount || 0);
  const [dosage, setDosage] = useState(partition.dosage || '');

  // Schedule Details
  const [timesPerDay, setTimesPerDay] = useState(() => {
    if (partition.timesPerDay) return partition.timesPerDay;
    if (partition.schedule && partition.schedule.length > 0) return partition.schedule.length;
    return 1;
  });

  // Selected Days Array (0 = Sunday, 6 = Saturday)
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    return partition.selectedDays && partition.selectedDays.length > 0
      ? partition.selectedDays
      : [0, 1, 2, 3, 4, 5, 6];
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

  const toggleDay = (index: number) => {
    if (selectedDays.includes(index)) {
      if (selectedDays.length > 1) { 
        setSelectedDays(selectedDays.filter(d => d !== index));
      } else {
        Alert.alert("Invalid Selection", "You must select at least one day.");
      }
    } else {
      setSelectedDays([...selectedDays, index].sort());
    }
  };

  const confirmScheduleConfig = () => {
    setIsScheduleConfigured(true);
    setScheduleModalVisible(false);
  };

  // --- REMOVE MEDICATION HANDLER ---
  const handleRemove = () => {
    Alert.alert(
      "Remove Medication",
      "Are you sure you want to delete this medication? This will clear the slot and delete its schedule.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive", 
          onPress: () => {
            setLoading(true);
            const emptyPayload = {
              ...partition,
              label: 'Unassigned',
              medicineName: '',
              illness: '',
              pillCount: 0,
              dosage: '',
              start_date: '',
              start_time: '',
              schedule: [],
              timesPerDay: 1,
              selectedDays: [0, 1, 2, 3, 4, 5, 6],
              duration_days: 0,
            };
            onSave(emptyPayload);
            onClose();
          }
        }
      ]
    );
  };

  const handleFinalSave = async () => {
    if (!medName.trim()) {
      Alert.alert("Missing Information", "Please enter a medicine name.");
      return;
    }
    if (pillCount <= 0) {
      Alert.alert("Invalid Pill Count", "Please add at least 1 pill to the inventory before saving.");
      return;
    }

    setLoading(true);

    try {
      const intervalHours = Math.floor(24 / Math.max(timesPerDay, 1));
      const generatedTimes: string[] = [];
      
      const startHour = firstDoseTime.getHours();
      const startMinute = firstDoseTime.getMinutes();

      for (let i = 0; i < timesPerDay; i++) {
        let calcHour = (startHour + (intervalHours * i)) % 24;
        let formattedHour = calcHour.toString().padStart(2, '0');
        let formattedMinute = startMinute.toString().padStart(2, '0');
        generatedTimes.push(`${formattedHour}:${formattedMinute}`);
      }

      // --- CRITICAL FIX: STRICT LOCAL DATE/TIME FORMATTING ---
      // This forces exact local YYYY-MM-DD instead of UTC to fix the timezone bug
      const year = startDate.getFullYear();
      const month = String(startDate.getMonth() + 1).padStart(2, '0');
      const day = String(startDate.getDate()).padStart(2, '0');
      const formattedStartDate = `${year}-${month}-${day}`;

      // This forces exact 24-hour HH:MM format
      const formattedStartTime = `${String(firstDoseTime.getHours()).padStart(2, '0')}:${String(firstDoseTime.getMinutes()).padStart(2, '0')}`;

      const uiPayload = {
        ...partition,
        label: illness || medName || 'Unassigned', // Shows illness on the box first!
        medicineName: medName,
        illness: illness,
        pillCount: pillCount,
        dosage: dosage,
        start_date: formattedStartDate,
        start_time: formattedStartTime, 
        schedule: generatedTimes,
        timesPerDay: timesPerDay,
        selectedDays: selectedDays, 
        duration_days: 365,
      };

      onSave(uiPayload);
      onClose();

    } catch (error) {
      console.error("Config Error:", error);
      Alert.alert("Error", "Could not configure the schedule.");
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
        textColor="#0f172a"
        themeVariant="light"
      />
    );
  };

  return (
    <View style={styles.container}>
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
                <TextInput style={styles.input} placeholder="e.g. Heart Condition" placeholderTextColor="#94a3b8" value={illness} onChangeText={setIllness} />
            </View>

            {/* MEDICINE */}
            <View style={styles.inputGroup}>
                <Text style={styles.label}>MEDICINE NAME</Text>
                <TextInput style={[styles.input, styles.largeInput]} placeholder="e.g. Atorvastatin 20mg" placeholderTextColor="#94a3b8" value={medName} onChangeText={setMedName} />
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
                {pillCount === 0 && <Text style={styles.errorText}>* Must be greater than 0</Text>}
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
        <TouchableOpacity style={[styles.finalSaveBtn, pillCount === 0 && styles.finalSaveBtnDisabled]} onPress={handleFinalSave} disabled={loading}>
            {loading ? <Text style={styles.finalSaveText}>SAVING...</Text> : <Text style={styles.finalSaveText}>SAVE CHANGES</Text>}
        </TouchableOpacity>

        {isEditMode && (
          <TouchableOpacity style={styles.removeBtn} onPress={handleRemove} disabled={loading}>
            <Text style={styles.removeBtnText}>REMOVE MEDICATION</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- MAINTENANCE SCHEDULE MODAL --- */}
      <Modal visible={isScheduleModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setScheduleModalVisible(false)}><Text style={styles.cancelText}>Back</Text></TouchableOpacity>
                <View style={styles.modalTitleContainer}>
                    <LinkIcon size={16} color="#2563eb" style={{marginRight: 6}} />
                    <Text style={styles.modalTitle}>Schedule Details</Text>
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

                {/* SCHEDULE TYPE */}
                <View style={styles.inputGroup}>
                    <Text style={styles.modalLabel}>
                      SCHEDULE TYPE: {selectedDays.length === 7 ? 'Every Day' : 'Custom Days'}
                    </Text>
                    <View style={styles.daysRow}>
                        {DAYS_OF_WEEK.map((day, idx) => {
                            const isSelected = selectedDays.includes(idx);
                            return (
                                <TouchableOpacity 
                                  key={idx} 
                                  onPress={() => toggleDay(idx)} 
                                  style={[styles.dayCircle, isSelected && styles.dayCircleActive]}
                                >
                                    <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                                </TouchableOpacity>
                            );
                        })}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  safeArea: { backgroundColor: '#fff', paddingTop: Platform.OS === 'android' ? 40 : 0 },
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
  counterSection: { marginBottom: 24 },
  counterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  counterBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  countDisplay: { alignItems: 'center' },
  countText: { fontSize: 32, fontWeight: '800', color: '#0f172a' },
  countTextZero: { color: '#ef4444' }, 
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
  footer: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 48 : 34 },
  finalSaveBtn: { backgroundColor: '#2563eb', borderRadius: 14, height: 56, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  finalSaveBtnDisabled: { backgroundColor: '#94a3b8' },
  finalSaveText: { color: '#fff', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  removeBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 12 },
  removeBtnText: { color: '#ef4444', fontWeight: 'bold', fontSize: 14, letterSpacing: 0.5 },
  modalContainer: { flex: 1, backgroundColor: '#f8fafc', paddingTop: Platform.OS === 'android' ? 20 : 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  cancelText: { color: '#64748b', fontSize: 16 },
  modalTitleContainer: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { fontWeight: '700', fontSize: 16, color: '#0f172a', marginRight: 8 },
  modalContent: { padding: 20 },
  row: { flexDirection: 'row', marginBottom: 20 },
  col: { flex: 1 },
  modalLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 8, textTransform: 'uppercase' },
  modalInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 15, color: '#0f172a', fontWeight: '500' },
  modalInputValue: { fontSize: 15, color: '#0f172a' },
  daysRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  dayCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  dayCircleActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
  dayText: { fontSize: 14, fontWeight: '700', color: '#64748b' },
  dayTextActive: { color: '#ffffff' },
  modalFooter: { padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderColor: '#f1f5f9', paddingBottom: Platform.OS === 'ios' ? 34 : 24 },
  saveScheduleBtn: { backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveScheduleText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  pickerWrapper: { backgroundColor: '#f1f5f9', marginTop: 16, borderRadius: 12, overflow: 'hidden' },
  pickerDone: { alignItems: 'flex-end', padding: 12, backgroundColor: '#e2e8f0' }
});

export default PartitionConfig;