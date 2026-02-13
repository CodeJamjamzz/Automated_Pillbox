import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { Wifi, Lock, Check, X } from 'lucide-react-native';
import { Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64';

// UUID defined in your ESP32 Code
const WIFI_CHAR_UUID = "6E400004-B5A3-F393-E0A9-E50E24DCCA9E";
const SERVICE_UUID   = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";

interface WifiSetupModalProps {
    visible: boolean;
    onClose: () => void;
    device: Device | null;
}

const WifiSetupModal: React.FC<WifiSetupModalProps> = ({ visible, onClose, device }) => {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    const handleSendCredentials = async () => {
        if (!device || !ssid || !password) {
            Alert.alert("Error", "Please enter both Wi-Fi Name and Password.");
            return;
        }

        setStatus('sending');

        try {
            // 1. Format: "SSID,PASSWORD"
            const payload = `${ssid},${password}`;

            // 2. Encode to Base64 (Required for BLE)
            const base64Data = base64.encode(payload);

            // 3. Write to ESP32
            await device.writeCharacteristicWithResponseForService(
                SERVICE_UUID,
                WIFI_CHAR_UUID,
                base64Data
            );

            setStatus('success');
            setTimeout(() => {
                onClose();
                setStatus('idle');
                Alert.alert("Success", "Credentials sent! The device will now reboot and connect.");
            }, 1500);

        } catch (error) {
            console.log("BLE Write Error:", error);
            Alert.alert("Transfer Failed", "Could not send data to the device. Ensure it is still connected.");
            setStatus('idle');
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.card}>
                    <View style={styles.header}>
                        <View style={styles.iconBg}>
                            <Wifi size={24} stroke="#2563eb" />
                        </View>
                        <Text style={styles.title}>Connect Device to Wi-Fi</Text>
                    </View>

                    <Text style={styles.subtitle}>
                        Enter your home Wi-Fi details so the MedBox can sync with the cloud.
                    </Text>

                    {/* INPUTS */}
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>WI-FI NAME (SSID)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. MyHomeWifi"
                            value={ssid}
                            onChangeText={setSsid}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>PASSWORD</Text>
                        <View style={styles.passwordRow}>
                            <Lock size={16} stroke="#94a3b8" />
                            <TextInput
                                style={[styles.input, { flex: 1, borderWidth: 0, marginTop: 0 }]}
                                placeholder="Enter password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                            />
                        </View>
                    </View>

                    {/* ACTIONS */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSendCredentials}
                            disabled={status !== 'idle'}
                            style={[styles.sendBtn, status === 'success' && styles.successBtn]}
                        >
                            {status === 'sending' ? (
                                <ActivityIndicator color="#fff" />
                            ) : status === 'success' ? (
                                <>
                                    <Check size={20} stroke="#fff" />
                                    <Text style={styles.sendText}>Sent!</Text>
                                </>
                            ) : (
                                <Text style={styles.sendText}>Send to Device</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    iconBg: { padding: 10, backgroundColor: '#eff6ff', borderRadius: 12 },
    title: { fontSize: 20, fontWeight: '900', color: '#1e293b' },
    subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 20 },
    inputContainer: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '900', color: '#94a3b8', marginBottom: 8, letterSpacing: 0.5 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 14, fontSize: 16, color: '#1e293b', fontWeight: '600' },
    passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 14 },
    footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
    cancelText: { fontWeight: 'bold', color: '#64748b' },
    sendBtn: { flex: 2, backgroundColor: '#2563eb', padding: 16, alignItems: 'center', borderRadius: 12, justifyContent: 'center', flexDirection: 'row', gap: 8 },
    successBtn: { backgroundColor: '#22c55e' },
    sendText: { fontWeight: 'bold', color: '#fff', fontSize: 16 },
});

export default WifiSetupModal;