// types.ts

export enum AppPhase {
  SPLASH = 'SPLASH',
  BLUETOOTH = 'BLUETOOTH',
  HOME = 'HOME'
}

export interface Partition {
  id: number;
  label: string; // e.g. "Morning Meds" or "Diabetes"
  medicineName: string;
  pillCount: number;
  schedule: string[]; // ISO Date strings or time strings
  isBlinking: boolean;
  adherenceRate: number;
  history: boolean[];

  // Optional Config Fields
  isShortTerm?: boolean;
  durationDays?: number;
  frequencyType?: 'daily' | 'weekly';
  selectedDays?: number[]; // 0=Sun, 1=Mon, etc.
  timesPerDay?: number;
  dosage?: string;
  colorTheme?: string; // Renamed from color_code to match your request
}

export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  partitions: Partition[];
  lastLocation: { lat: number; lng: number };
  riskScore: number;
}