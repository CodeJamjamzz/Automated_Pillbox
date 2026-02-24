export interface Partition {
  id: number;
  label: string;
  medicineName: string;
  pillCount: number;
  schedule: string[]; 
  isBlinking: boolean;
  adherenceRate: number;
  // Note: changed from boolean[] to any[] to allow empty arrays [] from your INITIAL_PATIENT state
  history: any[];

  // --- NEW FIELDS WE ADDED FOR FIREBASE ---
  illness?: string;

  // --- ADD THESE TO FIX THE ERRORS ---
  dosage: string;
  duration_days?: number;
  start_date?: string;
  start_time?: string;

  // These appear in your error logs as well
  isShortTerm?: boolean;
  selectedDays?: number[];
  timesPerDay?: number;
  frequencyType?: 'daily' | 'weekly';
  colorTheme?: string;
  
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