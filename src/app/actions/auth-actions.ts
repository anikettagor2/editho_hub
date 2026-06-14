'use server';

import { adminDb } from "@/lib/firebase/admin";

/**
 * Checks if a phone number is already registered in Firestore.
 * Bypasses client-side Firestore rules (runs with admin privileges on the server).
 */
export async function isPhoneNumberRegistered(phoneNumber: string): Promise<boolean> {
    try {
        const trimmedPhone = phoneNumber.trim();
        const usersSnap = await adminDb.collection("users")
            .where("phoneNumber", "==", trimmedPhone)
            .limit(1)
            .get();
        return !usersSnap.empty;
    } catch (error) {
        console.error("[isPhoneNumberRegistered] Error checking phone number:", error);
        throw error;
    }
}
