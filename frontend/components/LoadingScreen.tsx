import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

const LoadingScreen = () => {
  return (
      <View style={styles.container}>
        {/* MedSync Brand Color: #007AFF (Standard Medical Blue) */}
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Syncing your data...</Text>
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff', // Clean white medical background
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#888888', // Subtle grey text
    fontWeight: '500',
  },
});

export default LoadingScreen;