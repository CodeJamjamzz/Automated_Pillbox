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
import { Wifi, Lock, Check, Eye, EyeOff, X } from 'lucide-react-native';
import { Device } from 'react-native-ble-plx';
import base64 from 'react-native-base64'; // Ensure this package is installed: npm install react-native-base64

// UUIDs (Must match the ESP32 Firmware)
// 0001: Service
// 0002: WiFi Config (Write)
// 0003: Schedule (Write)
// 0004: Notify (Read)
const SERVICE_UUID   = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const WIFI_CHAR_UUID = "6E400002-B5A3-F393-E0A9-E50E24DCCA9E";

interface WifiSetupModalProps {
    visible: boolean;
    onClose: () => void;
    device: Device | null;
    onSuccess: () => void;
}

const WifiSetupModal: React.FC<WifiSetupModalProps> = ({ visible, onClose, device, onSuccess }) => {
    const [ssid, setSsid] = useState('');
    const [password, setPassword] = useState('');
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [status, setStatus] = useState<'idle' | 'sending' | 'success'>('idle');

    // Helper: Wait function to let Bluetooth stack settle
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    const handleSendCredentials = async () => {
        // 1. Basic Validation
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
            // 2. CHECK CONNECTION STATUS
            const isConnected = await device.isConnected();
            if (!isConnected) {
                Alert.alert("Disconnected", "Device connection lost. Please reconnect.");
                setStatus('idle');
                return;
            }

            // 3. WARM UP BLUETOOTH (CRITICAL FOR ANDROID)
            // This forces the phone to re-map the device services
            await device.discoverAllServicesAndCharacteristics();

            // 4. REQUEST MTU (CRITICAL FOR ANDROID)
            // Increases packet size so long passwords don't get cut off
            if (Platform.OS === 'android') {
                await device.requestMTU(512);
                await delay(200); // Give the OS time to apply the MTU
            }

            // 5. PREPARE PAYLOAD
            // Format: "SSID:PASSWORD" (Colon separator matches firmware)
            const payload = `${ssid}:${password}`;
            const base64Data = base64.encode(payload);

            console.log("Writing to:", WIFI_CHAR_UUID);
            console.log("Payload:", payload);

            // 6. WRITE TO DEVICE
            await device.writeCharacteristicWithResponseForService(
                SERVICE_UUID,
                WIFI_CHAR_UUID,
                base64Data
            );

            // 7. SUCCESS HANDLING
            setStatus('success');
            setTimeout(() => {
                setStatus('idle');
                onSuccess(); // Triggers parent callback (close modal, maybe show toast)
            }, 2000);

        } catch (error: any) {
            console.error("WiFi Setup Error:", error);
            setStatus('idle');

            // User-friendly error message
            Alert.alert(
                "Setup Failed",
                "Could not send credentials. Ensure the device is powered on and within range."
            );
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'center' }}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.innerContainer}>
                            <View style={styles.card}>

                                {/* HEADER */}
                                <View style={styles.header}>
                                    <View style={styles.iconBg}>
                                        <Wifi size={24} stroke="#2563eb" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.title}>Connect to Wi-Fi</Text>
                                        <Text style={styles.deviceLabel}>Target: {device?.name || "MedBox"}</Text>
                                    </View>
                                    <TouchableOpacity onPress={onClose}>
                                        <X size={24} stroke="#94a3b8" />
                                    </TouchableOpacity>
                                </View>

                                <Text style={styles.subtitle}>
                                    Enter your 2.4GHz Wi-Fi details so the MedBox can sync time and alarms.
                                </Text>

                                {/* SSID INPUT */}
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>WI-FI NAME (SSID)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="e.g. MyHomeWifi"
                                        placeholderTextColor="#94a3b8"
                                        value={ssid}
                                        onChangeText={setSsid}
                                        autoCapitalize="none"
                                        editable={status !== 'sending'}
                                    />
                                </View>

                                {/* PASSWORD INPUT */}
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
                                            secureTextEntry={!isPasswordVisible}
                                            editable={status !== 'sending'}
                                        />
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

                                {/* FOOTER ACTIONS */}
                                <View style={styles.footer}>
                                    <TouchableOpacity
                                        onPress={onClose}
                                        style={styles.cancelBtn}
                                        disabled={status === 'sending'}
                                    >
                                        <Text style={styles.cancelText}>Cancel</Text>
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
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.7)' },
    innerContainer: { padding: 24 },
    card: { backgroundColor: '#fff', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
    iconBg: { padding: 12, backgroundColor: '#eff6ff', borderRadius: 16 },
    title: { fontSize: 20, fontWeight: '800', color: '#0f172a' },
    deviceLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    subtitle: { fontSize: 14, color: '#64748b', marginBottom: 24, lineHeight: 22 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 11, fontWeight: '800', color: '#94a3b8', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, padding: 16, fontSize: 16, color: '#0f172a' },

    passwordRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingLeft: 16,
        paddingRight: 8
    },
    passwordInput: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: '#0f172a'
    },
    eyeButton: {
        padding: 8
    },

    footer: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: { flex: 1, padding: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: '#f1f5f9' },
    cancelText: { fontWeight: '700', color: '#64748b' },
    sendBtn: { flex: 2, backgroundColor: '#2563eb', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    successBtn: { backgroundColor: '#22c55e' },
    loadingBtn: { backgroundColor: '#60a5fa' },
    btnText: { fontWeight: 'bold', color: '#fff', fontSize: 16 },
});

export default WifiSetupModal;