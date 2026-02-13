import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Platform, PermissionsAndroid, Alert } from 'react-native';
import { Bluetooth, RefreshCw, Cpu, ChevronRight, MapPin } from 'lucide-react-native';
import { BleManager, Device } from 'react-native-ble-plx';

// --- IMPORTS ---
import LocationRequestModal from './LocationRequestModal';
import WifiSetupModal from './WifiModal'; // <--- NEW IMPORT

interface BluetoothScreenProps {
  onConnect: (device: Device) => void; // UPDATED: Passes full device object now
}

// Initialize BLE Manager once
const manager = new BleManager();

const BluetoothScreen: React.FC<BluetoothScreenProps> = ({ onConnect }) => {
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
    requestPermissionsAndScan();
    return () => {
      manager.stopDeviceScan();
    };
  }, []);

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

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        // console.log("Scan error:", error); // Ignore trivial scan errors
        return;
      }

      // Filter: Only show unique devices with names
      if (device && device.name && !foundDeviceIds.current.has(device.id)) {
        // Optional: Only show "MedBox Device" to clean up list
        // if (device.name === 'MedBox Device') { ... }

        foundDeviceIds.current.add(device.id);
        setDevices(prev => [...prev, device]);
      }
    });

    // Stop scanning after 10s to save battery
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  // --- 2. HANDLE CONNECTION ---
  const handleConnect = async (device: Device) => {
    if (isConnecting) return;

    setIsConnecting(true);
    manager.stopDeviceScan();

    try {
      // A. Connect
      const connectedDevice = await device.connect();
      // B. Discover Services (Crucial for reading Sensors/Writing Wi-Fi)
      await connectedDevice.discoverAllServicesAndCharacteristics();

      setSelectedDevice(connectedDevice);

      // C. Open Wi-Fi Modal
      setWifiModalVisible(true);

      // D. Notify Parent (Dashboard)
      onConnect(connectedDevice);

    } catch (error) {
      Alert.alert("Connection Failed", "Could not pair with device. Ensure it is powered on.");
      console.log(error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleRefresh = () => {
    manager.stopDeviceScan();
    startScanning();
  };

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Pair Your Device</Text>
          <Text style={styles.subtitle}>Connect to your physical MedBox IoT device via Bluetooth.</Text>
        </View>

        <View style={styles.listSection}>
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
                          onPress={() => handleConnect(item)}
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
            onClose={() => setWifiModalVisible(false)}
            device={selectedDevice}
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
  }
});

export default BluetoothScreen;