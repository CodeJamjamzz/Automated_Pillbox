import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Calendar, Check, Lock } from 'lucide-react-native';

// 1. Define the shape of a single Dose object (based on your Dashboard logic)
interface Dose {
  id: string;
  medName: string;
  time: string; // ISO date string
  status: string; // 'taken' | 'pending'
  partitionId: number;
}

// 2. Define the props for this component
interface DailyScheduleProps {
  todayDoses: Dose[];
  currentTime: Date;
  onDoseAction: (dose: Dose) => void;
  isNewDevice: boolean;
}

// 3. Apply the interface to the component
const DailySchedule: React.FC<DailyScheduleProps> = ({ todayDoses, currentTime, onDoseAction, isNewDevice }) => {
  
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <View style={styles.section}>
      <View style={styles.scheduleHeader}>
        <Clock size={20} stroke="#2563eb" />
        <Text style={styles.scheduleTitle}>Today's Schedule</Text>
      </View>

      {isNewDevice || todayDoses.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBg}>
            <Calendar size={32} stroke="#3b82f6" />
          </View>
          <Text style={styles.emptyStateTitle}>No Alarms Set</Text>
          <Text style={styles.emptyStateText}>
            Tap any "Empty" slot above to set up your first medication reminder.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineContainer}>
          <View style={styles.timelineLine} />
          {todayDoses.map((dose) => {
            const doseTime = new Date(dose.time);
            const isTimeNotReached = doseTime > currentTime;
            const isButtonDisabled = isTimeNotReached && dose.status !== 'taken';

            return (
              <View key={dose.id} style={styles.doseRow}>
                <View style={[styles.timeDot, dose.status === 'taken' ? styles.timeDotTaken : styles.timeDotPending]}>
                  {dose.status === 'taken' && <Check size={12} stroke="#fff" />}
                </View>
                <View style={[styles.doseCard, dose.status === 'taken' && styles.doseCardTaken]}>
                  <View>
                    <Text style={styles.doseTime}>{formatTime(dose.time)}</Text>
                    <Text style={[styles.doseMedName, dose.status === 'taken' && styles.textTaken]}>
                      {dose.medName}
                    </Text>
                  </View>
                  
                  <TouchableOpacity 
                    onPress={() => onDoseAction(dose)}
                    disabled={isButtonDisabled} 
                    style={[
                      styles.actionBtn, 
                      dose.status === 'taken' ? styles.actionBtnTaken : styles.actionBtnPending,
                      isButtonDisabled ? styles.actionBtnDisabled : {}
                    ]}
                  >
                    {isButtonDisabled ? (
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                        <Lock size={10} stroke="#94a3b8" />
                        <Text style={styles.actionTextDisabled}>Wait</Text>
                      </View>
                    ) : (
                      <Text style={[styles.actionBtnText, dose.status === 'taken' ? styles.actionTextTaken : styles.actionTextPending]}>
                        {dose.status === 'taken' ? 'Done' : 'Take'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  scheduleTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
  emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#eff6ff', borderStyle: 'dashed' },
  emptyIconBg: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyStateTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 4 },
  emptyStateText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, maxWidth: 220, lineHeight: 20 },
  timelineContainer: { position: 'relative', paddingLeft: 20 },
  timelineLine: { position: 'absolute', left: 9, top: 0, bottom: 0, width: 2, backgroundColor: '#e2e8f0' },
  doseRow: { marginBottom: 16, paddingLeft: 24, position: 'relative' },
  timeDot: { position: 'absolute', left: -18, top: 20, width: 20, height: 20, borderRadius: 10, borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  timeDotTaken: { backgroundColor: '#10b981' },
  timeDotPending: { backgroundColor: '#cbd5e1' },
  doseCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  doseCardTaken: { opacity: 0.6, backgroundColor: '#f8fafc' },
  doseTime: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
  doseMedName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  textTaken: { textDecorationLine: 'line-through', color: '#94a3b8' },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 60, alignItems: 'center' },
  actionBtnTaken: { borderColor: 'transparent', backgroundColor: 'transparent' },
  actionBtnPending: { borderColor: '#e2e8f0', backgroundColor: '#fff' },
  actionBtnDisabled: { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' }, 
  actionBtnText: { fontSize: 12, fontWeight: 'bold' },
  actionTextTaken: { color: '#64748b' },
  actionTextPending: { color: '#2563eb' },
  actionTextDisabled: { color: '#94a3b8', fontSize: 10 }, 
});

export default DailySchedule;