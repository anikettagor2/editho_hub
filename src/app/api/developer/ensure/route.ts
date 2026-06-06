import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export async function POST() {
  try {
    const email = "dev@gmail.com";
    const displayName = "Developer";
    const password = "Dev@2004";

    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (error: any) {
      if (error.code !== "auth/user-not-found") throw error;
    }

    if (userRecord) {
      await adminAuth.updateUser(userRecord.uid, {
        password,
        displayName,
        disabled: false,
      });
    } else {
      userRecord = await adminAuth.createUser({
        email,
        password,
        displayName,
      });
    }

    await adminAuth.setCustomUserClaims(userRecord.uid, { role: "developer" });
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid: userRecord.uid,
      email,
      displayName,
      role: "developer",
      photoURL: null,
      status: "active",
      onboardingStatus: "approved",
      createdAt: Date.now(),
      initialPassword: password,
    }, { merge: true });

    return NextResponse.json({ success: true, message: "Developer account ensured." });
  } catch (error: any) {
    console.error("Failed to ensure developer account:", error);
    return NextResponse.json({ error: error.message || "Failed to ensure developer account" }, { status: 500 });
  }
}
