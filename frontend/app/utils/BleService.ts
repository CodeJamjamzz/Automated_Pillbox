import { BleManager } from 'react-native-ble-plx';

// We create the instance HERE.
// This ensures it is only created once for the entire lifetime of the app.
export const bleManager = new BleManager();