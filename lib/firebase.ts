import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB7YsrzBbKdTWypDl0XHzMXqfNpXPbv0GI",
    authDomain: "new-project-6129f.firebaseapp.com",
    projectId: "new-project-6129f",
    storageBucket: "new-project-6129f.firebasestorage.app",
    messagingSenderId: "941325622333",
    appId: "1:941325622333:web:5b02bb12fa922f88391e54",
    measurementId: "G-ZXYS9DNWFW"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
