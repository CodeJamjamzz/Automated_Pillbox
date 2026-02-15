import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, Easing } from 'react-native';
import { Check, Volume2, VolumeX, Pill, AlertTriangle, Clock } from 'lucide-react-native';
import { Partition } from '../../types';

interface AlarmModalProps {
  partition: Partition;
  onConfirm: () => void;
  onClose: () => void;
}

enum AlarmStep {
  RINGING = 'RINGING',
  CONFIRMING = 'CONFIRMING',
  SUCCESS = 'SUCCESS'
}

const AlarmModal: React.FC<AlarmModalProps> = ({ partition, onConfirm, onClose }) => {
  const [step, setStep] = useState<AlarmStep>(AlarmStep.RINGING);
  const [manualTurnOff, setManualTurnOff] = useState(false);

  const pingAnim = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (step === AlarmStep.RINGING) {
      // Animation Loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pingAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pingAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          })
        ])
      ).start();

      // Auto-stop ringing after 60 seconds and move to confirmation check
      timeoutRef.current = setTimeout(() => {
        handleAutoTimeout();
      }, 60000);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [step]);

  const handleAutoTimeout = () => {
    setManualTurnOff(false);
    setStep(AlarmStep.CONFIRMING);
  };

  const handleTurnOffAlarm = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setManualTurnOff(true);
    setStep(AlarmStep.CONFIRMING);
  };

  const handleConfirmIntake = () => {
    setStep(AlarmStep.SUCCESS);
    // Wait 1.5s to show success state before closing and updating Dashboard
    setTimeout(() => {
        onConfirm();
    }, 1500);
  };

  const scale = pingAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });

  const opacity = pingAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.5, 0.2, 0],
  });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {step === AlarmStep.RINGING && (
          <View style={styles.pingContainer}>
            <Animated.View style={[styles.pingCircle, { transform: [{ scale }], opacity }]} />
          </View>
        )}

        <View style={styles.card}>
          {step === AlarmStep.RINGING && (
            <View style={styles.content}>
              <View style={styles.alarmIconContainer}>
                 <Volume2 size={48} stroke="#fff" />
              </View>
              <Text style={styles.title}>ALARM RINGING</Text>
              <View style={styles.slotBadge}>
                 <Text style={styles.slotBadgeText}>SLOT {partition.id} • {partition.medicineName}</Text>
              </View>

              <View style={styles.instructions}>
                <Text style={styles.instructionText}>
                  Your MedBox device is ringing. Deactivate the physical buzzer to proceed.
                </Text>
                <TouchableOpacity onPress={handleTurnOffAlarm} style={styles.actionButton}>
                  <VolumeX size={28} stroke="#fff" />
                  <Text style={styles.actionButtonText}>TURN OFF ALARM</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.footerInfo}>
                 <Clock size={12} stroke="#94a3b8" />
                 <Text style={styles.footerText}>AUTO-STOPS IN 1 MINUTE</Text>
              </View>
            </View>
          )}

          {step === AlarmStep.CONFIRMING && (
            <View style={styles.content}>
              <View style={[styles.statusIcon, manualTurnOff ? styles.bgGreen : styles.bgAmber]}>
                {manualTurnOff ? <Pill size={40} stroke="#16a34a" /> : <AlertTriangle size={40} stroke="#d97706" />}
              </View>

              <Text style={styles.confirmTitle}>
                {manualTurnOff ? "Alarm Deactivated." : "Buzzer Timed Out."}{"\n"}
                <Text style={manualTurnOff ? styles.textGreen : styles.textAmber}>Did you take your meds?</Text>
              </Text>

              <View style={styles.clarificationBox}>
                <Text style={styles.clarificationText}>
                  {manualTurnOff
                    ? `Thank you for turning off the alarm. Please confirm you took your ${partition.medicineName}.`
                    : `The alarm stopped after 1 minute. We need to verify: did you take your ${partition.medicineName}?`}
                </Text>
              </View>

              <TouchableOpacity
                onPress={handleConfirmIntake}
                style={[styles.confirmButton, manualTurnOff ? styles.bgGreenSolid : styles.bgAmberSolid]}
              >
                <Check size={28} stroke="#fff" />
                <Text style={styles.confirmButtonText}>YES, I TOOK IT</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>NOT YET</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === AlarmStep.SUCCESS && (
            <View style={styles.successContent}>
              <View style={styles.successIcon}>
                 <Check size={60} stroke="#16a34a" strokeWidth={3} />
              </View>
              <Text style={styles.successTitle}>Confirmed!</Text>
              <Text style={styles.successSubtitle}>Syncing with Cloud...</Text>
              <View style={styles.inventoryBadge}>
                 <Text style={styles.inventoryText}>INVENTORY UPDATED</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pingContainer: { position: 'absolute', width: 400, height: 400, justifyContent: 'center', alignItems: 'center' },
  pingCircle: { width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(37, 99, 235, 0.5)' },
  card: { width: '100%', backgroundColor: '#fff', borderRadius: 40, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  content: { width: '100%', alignItems: 'center' },
  alarmIconContainer: { padding: 24, backgroundColor: '#2563eb', borderRadius: 32, marginBottom: 20 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 8 },
  slotBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#dbeafe' },
  slotBadgeText: { fontSize: 10, fontWeight: '900', color: '#2563eb' },
  instructions: { width: '100%', marginTop: 32, backgroundColor: '#f8fafc', padding: 20, borderRadius: 32, borderWidth: 1, borderColor: '#eff6ff' },
  instructionText: { textAlign: 'center', color: '#475569', fontWeight: 'bold', marginBottom: 20, lineHeight: 20 },
  actionButton: { width: '100%', backgroundColor: '#2563eb', paddingVertical: 18, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  actionButtonText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  footerInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20 },
  footerText: { fontSize: 10, fontWeight: '900', color: '#94a3b8' },
  statusIcon: { padding: 20, borderRadius: 100, marginBottom: 16 },
  bgGreen: { backgroundColor: '#f0fdf4' },
  bgAmber: { backgroundColor: '#fffbeb' },
  confirmTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 12 },
  textGreen: { color: '#16a34a' },
  textAmber: { color: '#d97706' },
  clarificationBox: { backgroundColor: '#f8fafc', padding: 16, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  clarificationText: { color: '#475569', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  confirmButton: { width: '100%', paddingVertical: 20, borderRadius: 24, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  bgGreenSolid: { backgroundColor: '#22c55e' },
  bgAmberSolid: { backgroundColor: '#f59e0b' },
  confirmButtonText: { color: '#fff', fontSize: 20, fontWeight: '900' },
  skipButton: { marginTop: 12, paddingVertical: 12 },
  skipButtonText: { color: '#94a3b8', fontSize: 18, fontWeight: 'bold' },
  successContent: { paddingVertical: 40, alignItems: 'center' },
  successIcon: { width: 100, height: 100, backgroundColor: '#f0fdf4', borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  successTitle: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
  successSubtitle: { fontSize: 18, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
  inventoryBadge: { marginTop: 24, backgroundColor: '#f1f5f9', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  inventoryText: { fontSize: 11, fontWeight: '900', color: '#64748b' }
});

export default AlarmModal;