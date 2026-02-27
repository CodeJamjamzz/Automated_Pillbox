import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Clock, Calendar, Check, Lock } from 'lucide-react-native';

// 1. Define the shape of a single Dose object
interface Dose {
    id: string;
    medName: string;
    time: string; // Military time string, e.g., "18:30"
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

    // Helper: Converts "18:30" to "6:30 PM"
    const formatTime = (timeStr: string) => {
        if (!timeStr || !timeStr.includes(':')) return '--:--';
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${m} ${ampm}`;
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
                        // 1. Extract the scheduled hour and minute
                        const [doseHourStr, doseMinuteStr] = dose.time.split(':');
                        const doseHour = parseInt(doseHourStr, 10);
                        const doseMinute = parseInt(doseMinuteStr, 10);

                        // 2. Calculate the exact time purely in minutes from midnight
                        const doseMins = doseHour * 60 + doseMinute;
                        const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes();
                        
                        // Positive diff = in the future. Negative diff = in the past.
                        let diffMins = doseMins - currentMins;
                        
                        // Fix midnight wrap-around (e.g. Dose at 10 PM, Current Time is 2 AM next day)
                        if (diffMins < -720) diffMins += 1440;
                        if (diffMins > 720) diffMins -= 1440;

                        const isTaken = dose.status === 'taken';

                        // 3. Determine the 4 Strict UI States
                        // State 1: Future (More than 5 minutes away)
                        const isFuture = diffMins > 5;
                        
                        // State 2: Upcoming (Between 1 and 5 minutes away)
                        const isUpcomingSoon = diffMins > 0 && diffMins <= 5;
                        
                        // State 3: Ready (Exact time reached, and up to 60 minutes after)
                        const isReadyToTake = diffMins <= 0 && diffMins >= -60;

                        // State 4: Missed (More than 60 minutes in the past)
                        const isExpired = diffMins < -60;

                        // 4. Determine Card Highlighting
                        const shouldHighlightCard = !isTaken && (isUpcomingSoon || isReadyToTake);
                        const isGreyedOut = !isTaken && (isFuture || isExpired);

                        return (
                            <View key={dose.id} style={styles.doseRow}>
                                <View style={[styles.timeDot, isTaken ? styles.timeDotTaken : styles.timeDotPending]}>
                                    {isTaken && <Check size={12} stroke="#fff" />}
                                </View>
                                
                                <View style={[
                                    styles.doseCard, 
                                    isTaken && styles.doseCardTaken,
                                    isGreyedOut && styles.doseCardDisabled, // Greyed out future or missed
                                    shouldHighlightCard && styles.doseCardReady // Highlighted ready/upcoming
                                ]}>
                                    <View>
                                        <Text style={[styles.doseTime, shouldHighlightCard && styles.textReadyHighlight]}>
                                            {formatTime(dose.time)}
                                        </Text>
                                        <Text style={[styles.doseMedName, isTaken && styles.textTaken]}>
                                            {dose.medName}
                                        </Text>
                                    </View>

                                    {/* DYNAMIC BUTTON RENDER */}
                                    {isTaken ? (
                                        <View style={[styles.actionBtn, styles.actionBtnTaken]}>
                                            <Text style={[styles.actionBtnText, styles.actionTextTaken]}>Done</Text>
                                        </View>
                                    ) : isUpcomingSoon ? (
                                        <View style={[styles.actionBtn, styles.actionBtnUpcoming]}>
                                            <Text style={styles.actionTextUpcoming}>In {diffMins} min</Text>
                                        </View>
                                    ) : isReadyToTake ? (
                                        <TouchableOpacity
                                            onPress={() => onDoseAction(dose)}
                                            style={[styles.actionBtn, styles.actionBtnReady]}
                                        >
                                            <Text style={[styles.actionBtnText, styles.actionTextReady]}>Take</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        /* Future OR Expired State: Render the Disabled button */
                                        <View style={[styles.actionBtn, styles.actionBtnDisabled]}>
                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                                {!isExpired && <Lock size={10} stroke="#94a3b8" />}
                                                <Text style={styles.actionTextDisabled}>
                                                    {isExpired ? 'Missed' : 'Wait'}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                    
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
    
    // Card Styles
    doseCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
    doseCardTaken: { opacity: 0.6, backgroundColor: '#f8fafc' },
    doseCardDisabled: { opacity: 0.5, backgroundColor: '#f8fafc' }, 
    doseCardReady: { borderColor: '#bfdbfe', backgroundColor: '#eff6ff' }, 
    
    // Text Styles
    doseTime: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 0.5, marginBottom: 2 },
    textReadyHighlight: { color: '#2563eb' },
    doseMedName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    textTaken: { textDecorationLine: 'line-through', color: '#94a3b8' },
    
    // Action Area Styles
    actionBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, borderWidth: 1, minWidth: 60, alignItems: 'center' },
    actionBtnTaken: { borderColor: 'transparent', backgroundColor: 'transparent' },
    actionBtnDisabled: { borderColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    actionBtnUpcoming: { borderColor: '#bfdbfe', backgroundColor: '#e0f2fe' },
    actionBtnReady: { borderColor: '#2563eb', backgroundColor: '#2563eb', shadowColor: '#2563eb', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
    
    actionBtnText: { fontSize: 12, fontWeight: 'bold' },
    actionTextTaken: { color: '#64748b' },
    actionTextDisabled: { color: '#94a3b8', fontSize: 10 },
    actionTextUpcoming: { color: '#0ea5e9', fontSize: 12, fontWeight: '900' }, 
    actionTextReady: { color: '#ffffff' }, 
});

export default DailySchedule;