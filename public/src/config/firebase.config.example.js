// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC74-uNF6k5NyRYxr3koihs_F63nRmrz8g",
  authDomain: "muven-antiprocrastinacion.firebaseapp.com",
  projectId: "muven-antiprocrastinacion",
  storageBucket: "muven-antiprocrastinacion.firebasestorage.app",
  messagingSenderId: "128814084808",
  appId: "1:128814084808:web:ac7236f8efddd8c32b6bfd",
  measurementId: "G-CKJYYJ051N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);