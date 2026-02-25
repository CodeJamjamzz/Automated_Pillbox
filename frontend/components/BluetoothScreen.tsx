import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Platform, PermissionsAndroid, Alert } from 'react-native';
import { Bluetooth, RefreshCw, Cpu, ChevronRight, MapPin } from 'lucide-react-native';
import {bleManager} from '@/app/utils/BleService'
import {Device} from "react-native-ble-plx";
import AsyncStorage from '@react-native-async-storage/async-storage'; // <-- NEW
import base64 from 'react-native-base64'; // <-- NEW

// --- IMPORTS ---
import LocationRequestModal from './LocationRequestModal';
import WifiSetupModal from './WifiSetupModal';

const SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E";
const WIFI_STATUS_CHAR_UUID = "6E400005-B5A3-F393-E0A9-E50E24DCCA9E";

interface BluetoothScreenProps {
  onConnect: (device: Device) => void;
}

interface SavedDevice {
  id: string;
  name: string;
}

const BluetoothScreen: React.FC<BluetoothScreenProps> = ({ onConnect }) => {
    // --- NEW STATE VARIABLES ---
  const [activeTab, setActiveTab] = useState<'available' | 'saved'>('available');
  const [savedDevices, setSavedDevices] = useState<SavedDevice[]>([]);
  // Scanning State
  const [isScanning, setIsScanning] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const foundDeviceIds = useRef<Set<string>>(new Set());

  // Modal State
  const [isLocateModalVisible, setLocateModalVisible] = useState(false);
  const [isWifiModalVisible, setWifiModalVisible] = useState(false);

  // Connection State
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    loadSavedDevices();
    requestPermissionsAndScan();
    return () => {
      bleManager.stopDeviceScan();
    };
  }, []);

  // --- NEW: STORAGE LOGIC ---
    const loadSavedDevices = async () => {
      try {
        const stored = await AsyncStorage.getItem('@saved_medboxes');
        if (stored) setSavedDevices(JSON.parse(stored));
      } catch (e) { console.error("Failed to load devices", e); }
    };

    const saveDeviceToMemory = async (device: Device) => {
      try {
        const newDevice = { id: device.id, name: device.name || "MedBox" };
        const exists = savedDevices.find(d => d.id === newDevice.id);
        if (!exists) {
          const updated = [...savedDevices, newDevice];
          setSavedDevices(updated);
          await AsyncStorage.setItem('@saved_medboxes', JSON.stringify(updated));
        }
      } catch (e) { console.error("Failed to save device", e); }
    };

  // --- 1. PERMISSIONS & SCANNING ---
  const requestPermissionsAndScan = async () => {
    if (Platform.OS === 'android') {
      const grantedScan = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN
      );
      const grantedConnect = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT
      );
      const grantedLocation = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (grantedScan === PermissionsAndroid.RESULTS.GRANTED &&
          grantedConnect === PermissionsAndroid.RESULTS.GRANTED &&
          grantedLocation === PermissionsAndroid.RESULTS.GRANTED) {
        startScanning();
      } else {
        Alert.alert("Permission Error", "Bluetooth permissions are required.");
        setIsScanning(false);
      }
    } else {
      startScanning(); // iOS handles permissions automatically via Info.plist
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setDevices([]);
    foundDeviceIds.current.clear();

    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        return;
      }

      // Filter: Only show unique devices with names
      if (device && device.name && !foundDeviceIds.current.has(device.id)) {
        foundDeviceIds.current.add(device.id);
        setDevices(prev => [...prev, device]);
      }
    });

    // Stop scanning after 10s to save battery
    setTimeout(() => {
      bleManager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  // --- 2. HANDLE CONNECTION ---
//   const handleConnect = async (device: Device ) => {
//     if (isConnecting) return;
//
//     setIsConnecting(true);
//     bleManager.stopDeviceScan();
//
//     try {
//       // A. Connect
//       const connectedDevice = await device.connect();
//       if (Platform.OS === 'android') {
//         await connectedDevice.requestMTU(512);
//       }
//       // B. Discover Services (Crucial for reading Sensors/Writing Wi-Fi)
//       await connectedDevice.discoverAllServicesAndCharacteristics();
//
//       setSelectedDevice(connectedDevice);
//
//       // C. Open Wi-Fi Modal
//       setWifiModalVisible(true);
//
//     } catch (error) {
//       Alert.alert("Connection Failed", "Could not pair with device. Ensure it is powered on.");
//       console.log(error);
//     } finally {
//       setIsConnecting(false);
//     }
//   };

  // --- UPDATED: HANDLE CONNECTION (The Smart Handshake) ---
    const handleConnect = async (deviceData: Device | SavedDevice, isSavedFlow: boolean) => {
      if (isConnecting) return;
      setIsConnecting(true);
      bleManager.stopDeviceScan();

      try {
        let connectedDevice: Device;

        // 1. Connect (Handle full Device object vs just an ID from storage)
        if ('connect' in deviceData) {
          connectedDevice = await (deviceData as Device).connect();
        } else {
          connectedDevice = await bleManager.connectToDevice(deviceData.id);
        }

        if (Platform.OS === 'android') { await connectedDevice.requestMTU(512); }
        await connectedDevice.discoverAllServicesAndCharacteristics();
        setSelectedDevice(connectedDevice);

        // 2. Save to memory if it's a new setup
        if (!isSavedFlow) {
          await saveDeviceToMemory(connectedDevice);
          setWifiModalVisible(true); // Always show WiFi modal for first-time pairing
          setIsConnecting(false);
          return;
        }

        // 3. SMART HANDSHAKE (Only for previously saved devices)
        try {
          const statusChar = await connectedDevice.readCharacteristicForService(SERVICE_UUID, WIFI_STATUS_CHAR_UUID);
          const wifiStatus = base64.decode(statusChar.value);

          if (wifiStatus === "1") {
              // Wi-Fi is connected! Skip the modal completely.
              onConnect(connectedDevice);
          } else {
              // Wi-Fi is disconnected (ESP32 replied "0")
              Alert.alert(
                  "MedBox Offline",
                  "Your MedBox is not connected to a Wi-Fi network. The password may have changed or it is out of range.",
                  [{ text: "Update Wi-Fi", onPress: () => setWifiModalVisible(true) }]
              );
          }
        } catch (err) {
            // Fallback if read fails
            setWifiModalVisible(true);
        }

      } catch (error) {
        Alert.alert("Connection Failed", "Could not pair. Ensure MedBox is powered on and nearby.");
      } finally {
        setIsConnecting(false);
      }
    };

  const handleRefresh = () => {
    bleManager.stopDeviceScan();
    startScanning();
  };

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pair Your Device</Text>
          <Text style={styles.subtitle}>Connect to your physical MedBox IoT device via Bluetooth.</Text>
        </View>

      <View style={styles.listSection}>
          {/* --- NEW: TAB NAVIGATION --- */}
                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'available' && styles.activeTab]}
                    onPress={() => setActiveTab('available')}
                  >
                    <Text style={[styles.tabText, activeTab === 'available' && styles.activeTabText]}>AVAILABLE</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tab, activeTab === 'saved' && styles.activeTab]}
                    onPress={() => setActiveTab('saved')}
                  >
                    <Text style={[styles.tabText, activeTab === 'saved' && styles.activeTabText]}>SAVED DEVICES</Text>
                  </TouchableOpacity>
                </View>

                {/* --- TAB CONTENT --- */}
                {activeTab === 'available' ? (
                  /* AVAILABLE DEVICES LIST */
                  <>
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>NEARBY DEVICES</Text>
                      <TouchableOpacity onPress={handleRefresh} disabled={isScanning}>
                        {isScanning ? <ActivityIndicator size="small" color="#2563eb" /> : <RefreshCw size={18} stroke="#2563eb" />}
                      </TouchableOpacity>
                    </View>

                    {devices.length === 0 && isScanning ? (
                        <View style={styles.scanningContainer}>
                          <View style={styles.bluetoothIconContainer}>
                            <Bluetooth size={32} stroke="#2563eb" />
                          </View>
                          <Text style={styles.scanningText}>SCANNING FOR SIGNAL...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={devices}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={() => handleConnect(item, false)} // <-- FIXED: Added 'false' for new flow
                                    disabled={isConnecting}
                                    style={[styles.deviceItem, isConnecting && selectedDevice?.id === item.id && styles.deviceItemActive]}
                                >
                                  <View style={styles.deviceIcon}>
                                    <Cpu size={24} stroke="#94a3b8" />
                                  </View>
                                  <View style={styles.deviceInfo}>
                                    <Text style={styles.deviceName}>{item.name || "Unknown Device"}</Text>
                                    <Text style={styles.signalText}>ID: {item.id}</Text>
                                  </View>

                                  {isConnecting && selectedDevice?.id === item.id ? (
                                      <ActivityIndicator size="small" color="#2563eb" />
                                  ) : (
                                      <ChevronRight size={20} stroke="#cbd5e1" />
                                  )}
                                </TouchableOpacity>
                            )}
                            contentContainerStyle={styles.deviceList}
                            ListEmptyComponent={
                              !isScanning ? (
                                  <Text style={{textAlign:'center', color:'#94a3b8', marginTop: 20}}>
                                    No devices found. Ensure MedBox is on.
                                  </Text>
                              ) : null
                            }
                        />
                    )}
                  </>
                ) : (
                  /* SAVED DEVICES LIST */
                  <>
                    <View style={styles.listHeader}>
                      <Text style={styles.listTitle}>PREVIOUSLY CONNECTED</Text>
                    </View>

                    <FlatList
                        data={savedDevices}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => handleConnect(item, true)} // <-- FIXED: Added 'true' for saved flow
                                disabled={isConnecting}
                                style={[styles.deviceItem, isConnecting && selectedDevice?.id === item.id && styles.deviceItemActive]}
                            >
                              <View style={styles.deviceIcon}>
                                <Bluetooth size={24} stroke="#2563eb" />
                              </View>
                              <View style={styles.deviceInfo}>
                                <Text style={styles.deviceName}>{item.name}</Text>
                                <Text style={styles.signalText}>Saved Device</Text>
                              </View>

                              {isConnecting && selectedDevice?.id === item.id ? (
                                  <ActivityIndicator size="small" color="#2563eb" />
                              ) : (
                                  <Text style={{color: '#2563eb', fontWeight: 'bold', fontSize: 12}}>CONNECT</Text>
                              )}
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.deviceList}
                        ListEmptyComponent={
                            <Text style={{textAlign:'center', color:'#94a3b8', marginTop: 20}}>
                              No saved devices found.
                            </Text>
                        }
                    />
                  </>
                )}
              </View>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.locationButton} onPress={() => setLocateModalVisible(true)}>
            <MapPin size={20} stroke="#ffffff" />
            <Text style={styles.locationButtonText}>REQUEST DEVICE LOCATION</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            Ensure your MedBox is powered on and within 10 meters of your phone.
          </Text>
        </View>

        {/* --- MODALS --- */}

        {/* 1. Location Request (SMS) */}
        <LocationRequestModal
            isVisible={isLocateModalVisible}
            onClose={() => setLocateModalVisible(false)}
            deviceSimNumber="09171234567"
        />

        {/* 2. Wi-Fi Setup (BLE) */}
        <WifiSetupModal
            visible={isWifiModalVisible}
            device={selectedDevice}
            onClose={() => setWifiModalVisible(false)}
            onSuccess={() => {
              setWifiModalVisible(false);

              if (selectedDevice) {
                // Trigger the callback to swap to the Dashboard phase in index.tsx!
                onConnect(selectedDevice);
              }
            }}
        />

      </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 24 },
  header: { marginTop: 48, gap: 8 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 16, color: '#64748b', fontWeight: '500' },
  listSection: { flex: 1, marginTop: 48 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  listTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 2 },
  scanningContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  bluetoothIconContainer: { padding: 24, backgroundColor: '#eff6ff', borderRadius: 100 },
  scanningText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5 },
  deviceList: { paddingBottom: 20 },
  deviceItem: { backgroundColor: '#fff', padding: 16, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  deviceItemActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  deviceIcon: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 16 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  signalText: { fontSize: 10, fontWeight: '900', color: '#0d9488', marginTop: 2 },
  footer: { paddingBottom: 24 },
  footerText: { textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  locationButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 20,
    marginBottom: 20,
    gap: 10,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  locationButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  // --- ADD THESE NEW TAB STYLES ---
    tabContainer: {
      flexDirection: 'row',
      backgroundColor: '#e2e8f0',
      borderRadius: 12,
      padding: 4,
      marginBottom: 24,
    },
    tab: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: '#ffffff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    tabText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: '#64748b',
      letterSpacing: 1,
    },
    activeTabText: {
      color: '#2563eb',
    },
});

export default BluetoothScreen;