import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { MapPin, X, CheckCircle2, AlertTriangle, Send, Phone, Signal, Banknote } from 'lucide-react-native';
import * as SMS from 'expo-sms';

interface LocationRequestModalProps {
  isVisible: boolean;
  onClose: () => void;
  deviceSimNumber: string; // The SIM number INSIDE your MedBox
}

const LocationRequestModal: React.FC<LocationRequestModalProps> = ({ isVisible, onClose, deviceSimNumber }) => {
  const [targetNumber, setTargetNumber] = useState('');

  const handleSendRequest = async () => {
    // 1. Validation: Ensure a number is entered
    if (!targetNumber || targetNumber.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid mobile number for the device to reply to.");
      return;
    }

    const isAvailable = await SMS.isAvailableAsync();

    if (isAvailable) {
      // 2. Construct the Command
      // The format is KEYWORD:PHONENUMBER so the device knows where to reply
      const commandBody = `LOCATE:${targetNumber}\nCOMMAND:CMD_LOCATE`;

      // 3. Open SMS Composer
      const { result } = await SMS.sendSMSAsync(
        [deviceSimNumber], 
        commandBody
      );

      if (result === 'sent') {
        onClose(); // Close modal on success
        Alert.alert("Request Sent", "If the device has signal and battery, you will receive a location link shortly.");
      } 
    } else {
      Alert.alert("Error", "SMS is not available on this device.");
    }
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          
          {/* --- HEADER --- */}
          <View style={styles.header}>
            <View style={styles.iconBg}>
              <MapPin size={24} stroke="#2563eb" />
            </View>
            <View>
              <Text style={styles.title}>Locate Device</Text>
              <Text style={styles.subtitle}>Remote SMS Request</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} stroke="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* --- REQUIREMENTS LIST --- */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PREREQUISITES</Text>
            
            <View style={styles.reqItem}>
              <Banknote size={16} stroke="#10b981" />
              <Text style={styles.reqText}>Ensure you have mobile load (Standard SMS rates apply)</Text>
            </View>
            
            <View style={styles.reqItem}>
              <Signal size={16} stroke="#10b981" />
              <Text style={styles.reqText}>Ensure your phone has good signal</Text>
            </View>
          </View>

          {/* --- INSTRUCTIONS --- */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              1. Enter the number you want the location sent to.{'\n'}
              2. Press <Text style={{fontWeight:'bold'}}>Draft SMS</Text> below.{'\n'}
              3. Press <Text style={{fontWeight:'bold'}}>SEND</Text> in your messaging app.
            </Text>
          </View>

          {/* --- INPUT FIELD --- */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>REPLY LOCATION TO:</Text>
            <View style={styles.inputWrapper}>
              <Phone size={20} stroke="#64748b" />
              <TextInput 
                style={styles.textInput}
                placeholder="e.g. 09171234567"
                placeholderTextColor="#cbd5e1"
                keyboardType="phone-pad"
                value={targetNumber}
                onChangeText={setTargetNumber}
              />
            </View>
          </View>

          {/* --- WARNING NOTE --- */}
          <View style={styles.warningBox}>
            <AlertTriangle size={18} stroke="#b45309" />
            <View style={{flex: 1}}>
              <Text style={styles.warningTitle}>Troubleshooting</Text>
              <Text style={styles.warningText}>
                If you do not receive a reply, the device may have low battery or no signal connectivity.
              </Text>
            </View>
          </View>

          {/* --- FOOTER BUTTONS --- */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleSendRequest} style={styles.sendBtn}>
              <Send size={16} stroke="#fff" />
              <Text style={styles.sendBtnText}>Draft SMS</Text>
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)', // Darkened background
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  iconBg: {
    backgroundColor: '#eff6ff',
    padding: 12,
    borderRadius: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  section: {
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 1,
    marginBottom: 4,
  },
  reqItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reqText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  infoBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 22,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#64748b',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    gap: 10,
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    fontWeight: '600',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffbeb', // Light yellow/orange
    padding: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  warningTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400e',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#b45309',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748b',
  },
  sendBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  }
});

export default LocationRequestModal;