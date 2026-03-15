// Firebase Configuration
import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBK02dnpfz0AWbri0ZAAKGZ1m6iJs9oVTo",
  authDomain: "quiz-game-6f2f3.firebaseapp.com",
  databaseURL: "https://quiz-game-6f2f3-default-rtdb.firebaseio.com",
  projectId: "quiz-game-6f2f3",
  storageBucket: "quiz-game-6f2f3.firebasestorage.app",
  messagingSenderId: "1090746137951",
  appId: "1:1090746137951:web:fec4d81e63fc35e9c9caea",
  measurementId: "G-C0VL0YKP1H"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
