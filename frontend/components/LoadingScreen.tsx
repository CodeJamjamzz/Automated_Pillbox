import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LoadingScreen from './components/LoadingScreen';
import MedicalDashboard from './components/MedicalDashboard';
import { fetchMedicalTips } from './services/geminiService';
import { LoadingTip } from './types';

const { width } = Dimensions.get('window');

const LoadingScreen: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [tips, setTips] = useState<LoadingTip[]>([]);

  useEffect(() => {
    const initializeApp = async () => {
      // 1. Fetch AI tips
      const tipsData = await fetchMedicalTips();
      setTips(tipsData.tips);

      // 2. Simulate native data synchronization
      await new Promise(resolve => setTimeout(resolve, 5500));

      setIsLoading(false);
    };

    initializeApp();
  }, []);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <LoadingScreen tips={tips} />
      ) : (
        <View style={styles.dashboardContainer}>
          <MedicalDashboard />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    // In a real native environment, this wouldn't have a max-width,
    // but for the web simulation, we constrain the viewport.
    alignSelf: 'center',
    width: width > 430 ? 430 : '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 50,
  },
  dashboardContainer: {
    flex: 1,
    // Add a simple fade-in effect via logic or animation if desired
  }
});

export default LoadingScreen;