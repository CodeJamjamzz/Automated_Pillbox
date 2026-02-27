import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock, Calendar, Bell } from 'lucide-react-native';

// 1. Define the shape of a single Dose object
interface Dose {
    id: string;
    medName: string;
    time: string; // e.g., "18:30"
    status: string; // Kept in interface to prevent breaking Dashboard props, but ignored in UI
    partitionId: number;
}

// 2. Define the simplified props
interface DailyScheduleProps {
    todayDoses: Dose[];
    isNewDevice: boolean;
}

const DailySchedule: React.FC<DailyScheduleProps> = ({ todayDoses, isNewDevice }) => {

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
                <Text style={styles.scheduleTitle}>Today's Set Schedule</Text>
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
                <View style={styles.listContainer}>
                    {todayDoses.map((dose, index) => {
                        return (
                            <View key={`${dose.id}-${index}`} style={styles.logCard}>
                                <View style={styles.logLeft}>
                                    <View style={styles.iconContainer}>
                                        <Bell size={20} color="#2563eb" />
                                    </View>
                                    <View style={styles.logDetails}>
                                        <Text style={styles.logTime}>
                                            {formatTime(dose.time)}
                                        </Text>
                                        <Text style={styles.logMedName}>
                                            {dose.medName}
                                        </Text>
                                    </View>
                                </View>
                                
                                <View style={styles.slotBadge}>
                                    <Text style={styles.slotText}>
                                        SLOT {dose.partitionId}
                                    </Text>
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
    scheduleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
    scheduleTitle: { fontSize: 20, fontWeight: 'bold', color: '#1e293b' },
    
    emptyState: { padding: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderColor: '#eff6ff', borderStyle: 'dashed' },
    emptyIconBg: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    emptyStateTitle: { fontSize: 16, fontWeight: '900', color: '#1e293b', marginBottom: 4 },
    emptyStateText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, maxWidth: 220, lineHeight: 20 },
    
    listContainer: { gap: 12 },
    
    logCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 8,
        elevation: 1,
    },
    logLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    logDetails: {
        justifyContent: 'center'
    },
    logTime: {
        fontSize: 12,
        fontWeight: '900',
        color: '#2563eb',
        marginBottom: 2
    },
    logMedName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
    },
    slotBadge: {
        backgroundColor: '#eff6ff',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bfdbfe'
    },
    slotText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#2563eb'
    }
});

export default DailySchedule;