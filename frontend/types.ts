export interface Partition {
  id: number;
  label: string;
  medicineName: string;
  pillCount: number;
  schedule: string[];
  isBlinking: boolean;

  adherenceRate: number;
  history: any[]; // Changed from boolean[] to any[] for more flexibility

  // --- ADD THESE TO FIX THE ERRORS ---
  color_code: number;
  dosage: string;
  duration_days: number;
  start_date: string;
  start_time: string;

  // These appear in your error logs as well
  isShortTerm?: boolean;
  selectedDays?: number[];
  timesPerDay?: number;
}
export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  partitions: Partition[];
  lastLocation: { lat: number; lng: number };
  riskScore: number;
}

export enum AppPhase {
  SPLASH = 'SPLASH',
  BLUETOOTH = 'BLUETOOTH',
  HOME = 'HOME'
}