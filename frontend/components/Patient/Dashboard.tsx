import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Platform, PermissionsAndroid, Alert } from 'react-native';
import { Bluetooth, RefreshCw, Cpu, ChevronRight, MapPin } from 'lucide-react-native';
import { BleManager, Device } from 'react-native-ble-plx';
import * as Location from 'expo-location';

// --- IMPORT THE MODAL ---
import LocationRequestModal from '../LocationRequestModal';

interface BluetoothScreenProps {
  onConnect: (device: Device) => void; // UPDATED: Pass the full Device object, not just a string name
}

// Initialize BLE Manager outside component to avoid re-creation
const manager = new BleManager();

const BluetoothScreen: React.FC<BluetoothScreenProps> = ({ onConnect }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLocateModalVisible, setLocateModalVisible] = useState(false);

  // Use a Ref to keep track of devices we've already found to avoid duplicates
  const foundDeviceIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestPermissionsAndScan();

    // Cleanup scanning when screen closes
    return () => {
      manager.stopDeviceScan();
    };
  }, []);

  const requestPermissionsAndScan = async () => {
    if (Platform.OS === 'android') {
      // 1. Request Android 12+ Bluetooth Permissions
      const bluetoothScanPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          { title: "Scan Permission", message: "App needs access to find MedBox", buttonPositive: "OK" }
      );
      const bluetoothConnectPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          { title: "Connect Permission", message: "App needs access to connect to MedBox", buttonPositive: "OK" }
      );
      const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          { title: "Location Permission", message: "Bluetooth Low Energy requires location access", buttonPositive: "OK" }
      );

      if (bluetoothScanPermission === PermissionsAndroid.RESULTS.GRANTED &&
          bluetoothConnectPermission === PermissionsAndroid.RESULTS.GRANTED &&
          locationPermission === PermissionsAndroid.RESULTS.GRANTED) {
        startScanning();
      } else {
        Alert.alert("Permission Denied", "Bluetooth permissions are required to connect.");
        setIsScanning(false);
      }
    } else {
      // iOS usually handles this via Info.plist, just start scanning
      startScanning();
    }
  };

  const startScanning = () => {
    setIsScanning(true);
    setDevices([]);
    foundDeviceIds.current.clear();

    manager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        console.log("Scan error:", error);
        setIsScanning(false);
        return;
      }

      // FILTER: Only show devices with names (or specifically your MedBox)
      if (device && device.name && !foundDeviceIds.current.has(device.id)) {
        // Optional: strict filter for your device name
        // if (device.name === 'MedBox Device') { ... }

        foundDeviceIds.current.add(device.id);
        setDevices(prev => [...prev, device]);
      }
    });

    // Optional: Stop scanning after 10 seconds to save battery
    setTimeout(() => {
      manager.stopDeviceScan();
      setIsScanning(false);
    }, 10000);
  };

  const handleRefresh = () => {
    manager.stopDeviceScan();
    startScanning();
  };

  const connectToDevice = (device: Device) => {
    manager.stopDeviceScan(); // Stop scanning before connecting
    onConnect(device); // Pass the real device object up to the parent
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
            <TouchableOpacity onPress={handleRefresh}>
              <RefreshCw size={18} stroke="#2563eb" />
            </TouchableOpacity>
          </View>

          {isScanning && devices.length === 0 ? (
              <View style={styles.scanningContainer}>
                <View style={styles.bluetoothIconContainer}>
                  <Bluetooth size={32} stroke="#2563eb" />
                </View>
                <Text style={styles.scanningText}>SCANNING FOR SIGNAL...</Text>
                <ActivityIndicator color="#2563eb" size="small" />
              </View>
          ) : (
              <FlatList
                  data={devices}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                      <TouchableOpacity
                          onPress={() => connectToDevice(item)}
                          style={styles.deviceItem}
                      >
                        <View style={styles.deviceIcon}>
                          <Cpu size={24} stroke="#94a3b8" />
                        </View>
                        <View style={styles.deviceInfo}>
                          <Text style={styles.deviceName}>{item.name || "Unknown Device"}</Text>
                          <Text style={styles.signalText}>ID: {item.id}</Text>
                        </View>
                        <ChevronRight size={20} stroke="#cbd5e1" />
                      </TouchableOpacity>
                  )}
                  contentContainerStyle={styles.deviceList}
                  ListEmptyComponent={
                    <Text style={{textAlign:'center', color:'#94a3b8', marginTop: 20}}>No devices found. Pull to refresh.</Text>
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

        <LocationRequestModal
            isVisible={isLocateModalVisible}
            onClose={() => setLocateModalVisible(false)}
            deviceSimNumber="09171234567"
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
  deviceIcon: { padding: 12, backgroundColor: '#f1f5f9', borderRadius: 16 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#1e293b' },
  signalText: { fontSize: 10, fontWeight: '900', color: '#0d9488', marginTop: 2 },
  footer: { paddingBottom: 24 },
  footerText: { textAlign: 'center', fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  locationButton: {
    backgroundColor: '#2563eb', // Primary Blue
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
    elevation: 5, // Android Shadow
  },
  locationButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  }
});

export default BluetoothScreen;