import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBb6frNSSB91BMZDe2Kk4G-lUYeawjY5SY",
  authDomain: "eggcellent-database.firebaseapp.com",
  databaseURL: "https://eggcellent-database-default-rtdb.firebaseio.com",
  projectId: "eggcellent-database",
  storageBucket: "eggcellent-database.firebasestorage.app",
  messagingSenderId: "355913501299",
  appId: "1:355913501299:web:f5243e2b6281cc296c7806",
  measurementId: "G-S925Q3X0L3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);