"use server";

import { adminDb } from "@/lib/firebase/admin";
import { RazorpayX } from "@/lib/razorpay-x";
import { User, Project } from "@/types/schema";
import { revalidatePath } from "next/cache";

/**
 * Updates bank or UPI details for an editor.
 */
export async function updateEditorPayoutDetails(
    userId: string, 
    details: { 
        bankDetails?: { accountHolderName: string; accountNumber: string; ifscCode: string };
        upiDetails?: { vpa: string };
    }
) {
    try {
        const userRef = adminDb.collection("users").doc(userId);
        const userDoc = await userRef.get();
        
        if (!userDoc.exists) {
            return { success: false, error: "User not found" };
        }

        const userData = userDoc.data() as User;
        
        // Update Firestore
        await userRef.update({
            ...details,
            "payoutDetails.payoutStatus": "pending"
        });

        // We'll sync with RazorpayX just-in-time during payout to keep it simple,
        // but we could also do it here to validate the details.
        
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error: any) {
        console.error("Error updating payout details:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Initiates a payout for a completed project.
 * Only callable by Admin.
 */
export async function initiateEditorPayout(projectId: string) {
    try {
        const projectRef = adminDb.collection("projects").doc(projectId);
        const projectDoc = await projectRef.get();
        
        if (!projectDoc.exists) {
            return { success: false, error: "Project not found" };
        }

        const project = projectDoc.data() as Project;
        
        if (project.status !== 'completed' && project.status !== 'approved' && project.status !== 'completed_pending_payment') {
            return { success: false, error: "Project is not in a payable state" };
        }

        if (project.editorPaid) {
            return { success: false, error: "Editor already paid for this project" };
        }

        const editorId = project.assignedEditorId;
        if (!editorId) {
            return { success: false, error: "No editor assigned to this project" };
        }

        const editorRef = adminDb.collection("users").doc(editorId);
        const editorDoc = await editorRef.get();
        const editor = editorDoc.data() as User;

        if (!editor) {
            return { success: false, error: "Editor user not found" };
        }

        // 1. Ensure Contact exists in RazorpayX
        let contactId = editor.payoutDetails?.razorpayContactId;
        if (!contactId) {
            const contact = await RazorpayX.createContact(
                editor.displayName || editor.email || 'Editor',
                editor.email || '',
                editorId
            );
            contactId = contact.id;
            if (!contactId) {
                return { success: false, error: "Failed to create Razorpay contact" };
            }
            await editorRef.update({ "payoutDetails.razorpayContactId": contactId });
        }

        // 2. Ensure Fund Account exists
        let fundAccountId = editor.payoutDetails?.razorpayFundAccountId;
        
        // If details changed or no fund account, create new one
        // For simplicity, we create a new one if it doesn't exist.
        // In a real app, we might want to check if the stored bank details match the fund account.
        if (!fundAccountId) {
            if (editor.bankDetails) {
                const fa = await RazorpayX.createBankFundAccount(
                    contactId,
                    editor.bankDetails.accountHolderName,
                    editor.bankDetails.accountNumber,
                    editor.bankDetails.ifscCode
                );
                fundAccountId = fa.id;
            } else if (editor.upiDetails) {
                const fa = await RazorpayX.createUPIFundAccount(contactId, editor.upiDetails.vpa);
                fundAccountId = fa.id;
            } else {
                return { success: false, error: "Editor has no bank or UPI details set" };
            }
            await editorRef.update({ "payoutDetails.razorpayFundAccountId": fundAccountId });
        }

        // 3. Create Payout
        const amount = (project.editorPrice || 0) * 100; // to paise
        if (amount <= 0) {
            return { success: false, error: "Payout amount must be greater than zero" };
        }

        const payout = await RazorpayX.createPayout({
            fundAccountId: fundAccountId!,
            amount,
            currency: 'INR',
            mode: editor.upiDetails ? 'UPI' : 'IMPS',
            purpose: 'payout',
            referenceId: projectId,
            narration: `Payout for ${project.name}`,
        });

        // 4. Update Project status
        await projectRef.update({
            editorPaid: true,
            editorPaidAt: Date.now(),
            payoutId: payout.id, // Store Razorpay payout ID
            payoutStatus: payout.status, // e.g., 'processing', 'processed'
        });

        // Update Editor's last payout
        await editorRef.update({
            "payoutDetails.lastPayoutAt": Date.now(),
            "payoutDetails.payoutStatus": "active"
        });

        revalidatePath("/dashboard");
        return { success: true, payoutId: payout.id, payout };
    } catch (error: any) {
        console.error("Payout initiation failed:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Initiates multiple payouts for an editor's completed projects.
 */
export async function bulkInitiateEditorPayouts(projectIds: string[]) {
    const results = [];
    for (const projectId of projectIds) {
        try {
            const res = await initiateEditorPayout(projectId);
            results.push({ projectId, ...res });
        } catch (error: any) {
            results.push({ projectId, success: false, error: error.message });
        }
    }
    
    revalidatePath("/dashboard");
    const successCount = results.filter(r => r.success).length;
    return { 
        success: successCount > 0, 
        results, 
        message: `Successfully initiated ${successCount} of ${projectIds.length} payouts.` 
    };
}

