import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Bluetooth, RefreshCw, Cpu, ChevronRight, MapPin } from 'lucide-react-native';

// --- 1. IMPORT THE MODAL COMPONENT ---
// Make sure you saved the previous code as LocationRequestModal.tsx in the same folder
import LocationRequestModal from './LocationRequestModal'; 

interface BluetoothScreenProps {
  onConnect: (deviceName: string) => void;
}

const BluetoothScreen: React.FC<BluetoothScreenProps> = ({ onConnect }) => {
  const [isScanning, setIsScanning] = useState(true);
  const [devices, setDevices] = useState<{id: string, name: string}[]>([]);
  
  // --- 2. ADD STATE FOR MODAL VISIBILITY ---
  const [isLocateModalVisible, setLocateModalVisible] = useState(false);

  useEffect(() => {
    const scanTimer = setTimeout(() => {
      setDevices([
        { id: '1', name: 'MedBox-Pro-v2.1' },
        { id: '2', name: 'SmartKit_X800' }
      ]);
      setIsScanning(false);
    }, 2000);
    return () => clearTimeout(scanTimer);
  }, []);

  const handleRefresh = () => {
    setIsScanning(true);
    setDevices([]);
    setTimeout(() => {
      setDevices([
        { id: '1', name: 'MedBox-Pro-v2.1' },
        { id: '2', name: 'SmartKit_X800' },
        { id: '3', name: 'Unknown Device' }
      ]);
      setIsScanning(false);
    }, 1500);
  };

  // --- 3. UPDATE THE HANDLER TO OPEN MODAL ---
  const handleRequestLocation = () => {
    setLocateModalVisible(true);
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

        {isScanning ? (
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
                       onPress={() => onConnect(item.name)}
                       style={styles.deviceItem}
                   >
                       <View style={styles.deviceIcon}>
                           <Cpu size={24} stroke="#94a3b8" />
                       </View>
                       <View style={styles.deviceInfo}>
                           <Text style={styles.deviceName}>{item.name}</Text>
                           <Text style={styles.signalText}>STRONG SIGNAL</Text>
                       </View>
                       <ChevronRight size={20} stroke="#cbd5e1" />
                   </TouchableOpacity>
               )}
               contentContainerStyle={styles.deviceList}
           />
        )}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.locationButton} onPress={handleRequestLocation}>
           <MapPin size={20} stroke="#ffffff" />
           <Text style={styles.locationButtonText}>REQUEST DEVICE LOCATION</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Ensure your MedBox is powered on and within 10 meters of your phone.
        </Text>
      </View>

      {/* --- 4. RENDER THE MODAL HERE --- */}
      <LocationRequestModal 
        isVisible={isLocateModalVisible}
        onClose={() => setLocateModalVisible(false)}
        deviceSimNumber="09171234567" // <--- REPLACE THIS WITH YOUR MEDBOX SIM NUMBER
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