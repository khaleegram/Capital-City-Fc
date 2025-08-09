// Import the functions you need from the SDKs you need
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

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
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const auth = getAuth(app);
