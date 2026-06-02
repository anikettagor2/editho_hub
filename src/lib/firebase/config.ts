import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
    initializeFirestore,
    getFirestore,
    persistentLocalCache,
    persistentMultipleTabManager
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


// Initialize Firestore with specialized settings for better connectivity and offline support
let dbInstance;
try {
    // If it's already initialized, just get it
    dbInstance = getFirestore(app);
} catch (e) {
    // Determine persistence type based on environment
    // Multiple tabs in development can sometimes trigger 'Unexpected state (ID: ca9)' due to HMR
    const isDev = process.env.NODE_ENV === 'development';
    
    dbInstance = initializeFirestore(app, {
        localCache: persistentLocalCache({
            tabManager: isDev 
                ? undefined // Default to single tab in dev to avoid 'ca9' race conditions
                : persistentMultipleTabManager()
        })
    });
}

export const db = dbInstance;

export const functions = getFunctions(app);
