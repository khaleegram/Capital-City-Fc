// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC9alUkqtvrjudCzE3xFkUsHw8kqK_8w64",
  authDomain: "capital-city-app.firebaseapp.com",
  projectId: "capital-city-app",
  storageBucket: "capital-city-app.appspot.com",
  messagingSenderId: "883323125833",
  appId: "1:883323125833:web:8641022c00620f6928bf98",
  measurementId: "G-C1ST753CL3"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export { app };
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
