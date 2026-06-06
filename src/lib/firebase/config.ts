import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    initializeFirestore,
    getFirestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBnrX9Q1wxDitXOT37_ftMN3rQWsOY6Ikk",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "studio-4633365007-23d80.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "studio-4633365007-23d80",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "707194789184",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:707194789184:web:0908252c6107bd67432ea5"
};

// Initialize Firebase (singleton pattern)
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure Auth persistence to be persistent across browser restarts (Standard for web apps)
import { setPersistence, browserLocalPersistence } from "firebase/auth";
setPersistence(auth, browserLocalPersistence).catch(err => {
    console.error("Critical: Failed to set Auth persistence:", err);
});


// Initialize Firestore with memory cache and safer browser transport settings.
// Avoid persistent local cache here: Firebase 12 can hit internal watch-state
// assertions (ca9/b815) during HMR, multi-tab use, or failed listeners.
let dbInstance;
try {
    dbInstance = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true,
    });
} catch (e) {
    dbInstance = getFirestore(app);
}

export const db = dbInstance;

export const functions = getFunctions(app);
