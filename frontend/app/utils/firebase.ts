import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your verified MedSync configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHosz_umYrppdguHVExMkyqEuqMVLH7Ew",
  authDomain: "medsync-baef3.firebaseapp.com",
  databaseURL: "https://medsync-baef3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "medsync-baef3",
  storageBucket: "medsync-baef3.firebasestorage.app",
  messagingSenderId: "527425940030",
  appId: "1:527425940030:web:b4f2bdb053cb734f713f6f",
  measurementId: "G-6MWE9TNE2V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export services for use in your Dashboard and Config components
export const db = getFirestore(app);
export const auth = getAuth(app);