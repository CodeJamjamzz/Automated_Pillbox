import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Clock, PlusCircle } from 'lucide-react-native';

// 1. Import the Partition interface
import { Partition } from '../types';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 76) / 2;

// 2. Define what props this component accepts
interface DeviceLayoutProps {
    partitions: Partition[];
    onPartitionSelect: (partition: Partition) => void;
}

// 3. Apply the interface to the component definition
const DeviceLayout: React.FC<DeviceLayoutProps> = ({ partitions, onPartitionSelect }) => {

    // Helper: Convert array of military times ["18:30", "02:30"] into "6:30 PM • 2:30 AM"
    const formatAlarmTimes = (schedule: string[]) => {
        if (!schedule || schedule.length === 0) return 'No Alarms Set';

        return schedule.map(timeStr => {
            const [h, m] = timeStr.split(':');
            const hour = parseInt(h, 10);
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${m} ${ampm}`;
        }).join(' • '); // Bullet point separator for a clean UI look
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>DEVICE LAYOUT</Text>
            <View style={styles.grid}>
                {partitions.map((partition) => {
                    const isUnassigned = !partition.label || partition.label === 'Unassigned';
                    
                    // Standard blue for active slots, gray for empty ones (since color picker is removed)
                    const activeColor = isUnassigned ? '#cbd5e1' : '#2563eb';

                    return (
                        <TouchableOpacity
                            key={partition.id}
                            onPress={() => onPartitionSelect(partition)}
                            style={[
                                styles.gridItem,
                                !isUnassigned ? { borderColor: activeColor, borderWidth: 3 } : styles.inactiveItem
                            ]}
                        >
                            {/* Slot Header */}
                            <View style={styles.itemHeader}>
                                <View style={[styles.slotBadge, !isUnassigned ? { backgroundColor: activeColor } : styles.slotBadgeInactive]}>
                                    <Text style={[styles.slotBadgeText, !isUnassigned ? styles.slotTextActive : styles.slotTextInactive]}>
                                        SLOT {partition.id}
                                    </Text>
                                </View>
                                <Text style={styles.itemLabel} numberOfLines={1}>
                                    {partition.label || 'Empty'}
                                </Text>
                                {!isUnassigned && (
                                    <Text style={styles.medicineName} numberOfLines={1}>{partition.medicineName}</Text>
                                )}
                            </View>

                            {/* Slot Footer */}
                            <View style={styles.itemFooter}>
                                {!isUnassigned ? (
                                    <>
                                        <View style={styles.pillCountContainer}>
                                            <Text style={[styles.pillCount, { color: activeColor }]}>{partition.pillCount}</Text>
                                            <Text style={[styles.pillLabel, { color: activeColor }]}>PILLS LEFT</Text>
                                        </View>
                                        <View style={[styles.scheduleBadge, { borderColor: activeColor + '40', backgroundColor: activeColor + '10' }]}>
                                            <Clock size={10} stroke={activeColor} style={{ marginTop: 1 }} />
                                            {/* numberOfLines={2} allows long schedules to wrap neatly */}
                                            <Text style={[styles.scheduleText, { color: activeColor }]} numberOfLines={2}>
                                                {formatAlarmTimes(partition.schedule)}
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={styles.setupContainer}>
                                        <PlusCircle size={20} stroke="#94a3b8" />
                                        <Text style={styles.setupText}>TAP TO ADD</Text>
                                    </View>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontWeight: '900', color: '#64748b', letterSpacing: 1.5, marginBottom: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, backgroundColor: '#f1f5f9', padding: 12, borderRadius: 32 },
    gridItem: { width: ITEM_WIDTH, height: 160, backgroundColor: '#fff', borderRadius: 24, padding: 12, justifyContent: 'space-between', borderWidth: 3 },
    inactiveItem: { borderColor: '#fff', borderStyle: 'solid', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    itemHeader: { gap: 4 },
    slotBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    slotBadgeInactive: { backgroundColor: '#f1f5f9' },
    slotBadgeText: { fontSize: 8, fontWeight: '900' },
    slotTextActive: { color: '#fff' },
    slotTextInactive: { color: '#94a3b8' },
    itemLabel: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
    medicineName: { fontSize: 10, color: '#94a3b8', fontWeight: '500' },
    itemFooter: { gap: 6 },
    pillCountContainer: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    pillCount: { fontSize: 20, fontWeight: '900' },
    pillLabel: { fontSize: 8, fontWeight: '900' },
    scheduleBadge: { flexDirection: 'row', alignItems: 'flex-start', padding: 6, borderRadius: 8, gap: 4, borderWidth: 1 },
    scheduleText: { fontSize: 10, fontWeight: '800', flexShrink: 1, lineHeight: 14 },
    setupContainer: { alignItems: 'center', justifyContent: 'center', opacity: 0.4, gap: 4 },
    setupText: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },
});

export default DeviceLayout;