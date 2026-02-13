import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
    Keyboard
} from 'react-native';
import { Wifi, Lock, Check, Eye, EyeOff } from 'lucide-react-native'; // <--- Added Eye icons
import { Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64';

// UUID defined in your ESP32 Code
const WIFI_CHAR_UUID = "6E400004-B5A3-F393-E0A9-E50E24DCCA9E";
const SERVICE_UUID   = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";

interface WifiSetupModalProps {
    visible: boolean;
    onClose: () => void;
    device: Device | null;
    onSuccess: () => void;
}

const WifiSetupModal: React.FC<WifiSetupModalProps> = ({ visible, onClose, device, onSuccess }) => {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false); // <--- New State
    const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    const handleSendCredentials = async () => {
        if (!device) {
            Alert.alert("Error", "No device connected.");
            return;
        }
        if (!ssid || !password) {
            Alert.alert("Missing Info", "Please enter both Wi-Fi Name and Password.");
            return;
        }

        setStatus('sending');

        try {
            const payload = `${ssid},${password}`;
            const base64Data = base64.encode(payload);

            // 1. Try Safe Write (No Response)
            // This is faster and usually prevents the disconnect crash
            try {
                await device.writeCharacteristicWithoutResponseForService(
                    SERVICE_UUID,
                    WIFI_CHAR_UUID,
                    base64Data
                );
            } catch (innerError) {
                console.log("WriteNoResponse failed, trying standard Write...");
                // 2. Fallback to Standard Write if the first one failed
                await device.writeCharacteristicWithResponseForService(
                    SERVICE_UUID,
                    WIFI_CHAR_UUID,
                    base64Data
                );
            }

            setStatus('success');

            setTimeout(() => {
                setStatus('idle');
                onSuccess();
            }, 4000);

        } catch (error) {
            console.log("CRITICAL WRITE ERROR:", error);
            Alert.alert("Connection Error", "Could not send data. Please restart the MedBox and try again.");
            setStatus('idle');
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.innerContainer}>
                        <View style={styles.card}>
                            {/* HEADER */}
                            <View style={styles.header}>
                                <View style={styles.iconBg}>
                                    <Wifi size={24} stroke="#2563eb" />
                                </View>
                                <View>
                                    <Text style={styles.title}>Connect to Wi-Fi</Text>
                                    <Text style={styles.deviceLabel}>Target: {device?.name || "MedBox"}</Text>
                                </View>
                            </View>

                            <Text style={styles.subtitle}>
                                Enter your 2.4GHz Wi-Fi details so the MedBox can sync with the cloud.
                            </Text>

                            {/* INPUTS */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>WI-FI NAME (SSID)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. MyHomeWifi"
                                    placeholderTextColor="#94a3b8"
                                    value={ssid}
                                    onChangeText={setSsid}
                                    autoCapitalize="none"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PASSWORD</Text>
                                <View style={styles.passwordRow}>
                                    <Lock size={16} stroke="#94a3b8" style={{ marginRight: 8 }} />

                                    <TextInput
                                        style={styles.passwordInput}
                                        placeholder="Enter password"
                                        placeholderTextColor="#94a3b8"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!isPasswordVisible} // <--- Toggles visibility
                                    />

                                    {/* TOGGLE BUTTON */}
                                    <TouchableOpacity
                                        onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                        style={styles.eyeButton}
                                    >
                                        {isPasswordVisible ? (
                                            <EyeOff size={20} stroke="#94a3b8" />
                                        ) : (
                                            <Eye size={20} stroke="#94a3b8" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ACTIONS */}
                            <View style={styles.footer}>
                                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                                    <Text style={styles.cancelText}>Skip / Cancel</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={handleSendCredentials}
                                    disabled={status !== 'idle'}
                                    style={[
                                        styles.sendBtn,
                                        status === 'success' && styles.successBtn,
                                        status === 'sending' && styles.loadingBtn
                                    ]}
                                >
                                    {status === 'sending' ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : status === 'success' ? (
                                        <>
                                            <Check size={20} stroke="#fff" />
                                            <Text style={styles.btnText}>Sent!</Text>
                                        </>
                                    ) : (
                                        <Text style={styles.btnText}>Send to Device</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
    innerContainer: { flex: 1, justifyContent: 'center', padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    iconBg: { padding: 12, backgroundColor: '#eff6ff', borderRadius: 16 },
    title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    deviceLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 22 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a' },

    // Updated Password Row Styles
    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingLeft: 16,
        paddingRight: 8 // Less padding on right for the button
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#0f172a'
    },
    eyeButton: {
        padding: 8 // Touch target area
    },

    footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center' },
    cancelText: { fontWeight: '700', color: '#64748b' },
    sendBtn: { flex: 2, backgroundColor: '#2563eb', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    successBtn: { backgroundColor: '#22c55e' },
    loadingBtn: { backgroundColor: '#60a5fa' },
    btnText: { fontWeight: 'bold', color: '#fff', fontSize: 16 },
});

export default WifiSetupModal;