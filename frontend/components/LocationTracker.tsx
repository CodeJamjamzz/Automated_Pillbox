import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MapPin, Maximize2, MapPinOff, RefreshCw, Volume2 } from 'lucide-react-native';
import MapView, { Marker, Region } from 'react-native-maps';

// 1. Define the props interface
interface LocationTrackerProps {
  permissionStatus: 'undetermined' | 'granted' | 'denied';
  userLocation: Region | null; // or any type if using a custom location object, but Region is standard for maps
  kitLocation: { latitude: number; longitude: number } | null;
  onRequestPermission: () => void;
  onShowFullMap: () => void;
}

// 2. Apply the interface
const LocationTracker: React.FC<LocationTrackerProps> = ({ 
  permissionStatus, 
  userLocation, 
  kitLocation, 
  onRequestPermission, 
  onShowFullMap 
}) => {
  return (
    <View style={styles.trackerSection}>
      <View style={styles.trackerHeader}>
        <View style={styles.trackerTitleContainer}>
          <View style={styles.iconBg}>
            <MapPin size={20} stroke="#f43f5e" />
          </View>
          <Text style={styles.trackerTitle}>Live Tracker</Text>
        </View>
        {permissionStatus === 'granted' && (
          <TouchableOpacity onPress={onShowFullMap} style={styles.focusButton}>
            <Maximize2 size={12} stroke="#2563eb" />
            <Text style={styles.focusButtonText}>FULL MAP</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity 
        onPress={() => permissionStatus === 'granted' && onShowFullMap()} 
        activeOpacity={permissionStatus === 'granted' ? 0.7 : 1}
        style={styles.mapContainer}
      >
        {permissionStatus === 'denied' ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconBg}>
              <MapPinOff size={24} stroke="#ef4444" />
            </View>
            <Text style={styles.errorTitle}>Location Required</Text>
            <Text style={styles.errorText}>Please enable location services</Text>
            
            <TouchableOpacity onPress={onRequestPermission} style={styles.retryButton}>
              <RefreshCw size={14} stroke="#fff" />
              <Text style={styles.retryButtonText}>RETRY CONNECTION</Text>
            </TouchableOpacity>
          </View>

        ) : permissionStatus === 'granted' && userLocation ? (
          <>
            <MapView 
              style={styles.map}
              initialRegion={userLocation}
              showsUserLocation={true}
              pointerEvents="none" // Disable interaction for preview
            >
              {kitLocation && (
                <Marker 
                  coordinate={kitLocation} 
                  title="My MedBox" 
                  pinColor="red"
                />
              )}
            </MapView>
            
            <View style={styles.mapStatus}>
              <View style={styles.statusRow}>
                  <View style={styles.blueDot} />
                  <Text style={styles.statusText}>Phone</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.statusRow}>
                  <View style={styles.redDot} />
                  <Text style={styles.statusText}>Kit (45m away)</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.loadingText}>Locating Devices...</Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.locateButton}>
        <Volume2 size={18} stroke="#475569" />
        <Text style={styles.locateButtonText}>PING PHYSICAL BOX</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  trackerSection: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#f1f5f9' },
  trackerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  trackerTitleContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBg: { padding: 8, backgroundColor: '#fff1f2', borderRadius: 12 },
  trackerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1e293b' },
  focusButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  focusButtonText: { fontSize: 10, fontWeight: '900', color: '#2563eb' },
  mapContainer: { height: 170, backgroundColor: '#e2e8f0', borderRadius: 16, overflow: 'hidden', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  map: { width: '100%', height: '100%' },
  loadingContainer: { height: 160, backgroundColor: '#e2e8f0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  errorContainer: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#fef2f2' },
  errorIconBg: { marginBottom: 12, padding: 12, backgroundColor: '#fee2e2', borderRadius: 50 },
  errorTitle: { fontSize: 16, fontWeight: 'bold', color: '#991b1b', marginBottom: 4 },
  errorText: { fontSize: 12, color: '#b91c1c', textAlign: 'center', marginBottom: 16 },
  retryButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, gap: 6 },
  retryButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 10 },
  mapStatus: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(255,255,255,0.95)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 12, backgroundColor: '#cbd5e1' },
  blueDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2563eb' },
  redDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444' },
  statusText: { fontSize: 10, fontWeight: '700', color: '#1e293b' },
  locateButton: { marginTop: 16, backgroundColor: '#f1f5f9', paddingVertical: 14, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  locateButtonText: { fontSize: 12, fontWeight: '900', color: '#475569' },
});

export default LocationTracker;