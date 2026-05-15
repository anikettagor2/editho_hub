"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { QRCodeSVG } from "qrcode.react";
import {
    CheckCircle2,
    Copy,
    ShieldCheck,
    Banknote,
    Loader2,
    AlertCircle,
    Smartphone,
    Building2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ─── Legacy QRPaymentModal (Client-facing UPI QR for client payments) ─────────

interface QRPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    amount: number;
    projectId: string;
    projectName: string;
}

/**
 * @deprecated Use PaymentButton which opens Razorpay Checkout instead.
 * Kept for backward compatibility with any legacy entry points.
 */
export function QRPaymentModal({
    isOpen,
    onClose,
    amount,
    projectId,
    projectName,
}: QRPaymentModalProps) {
    const upiId = process.env.NEXT_PUBLIC_UPI_ID || "editohub@upi";
    const payeeName = "EditoHub Studio";
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Payment for ${projectName}`)}`;

    const handleCopyUpi = () => {
        navigator.clipboard.writeText(upiId);
        toast.success("UPI ID copied to clipboard!");
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Pay with UPI" maxWidth="max-w-md">
            <div className="p-6 flex flex-col items-center text-center space-y-6">
                <div className="bg-primary/10 p-4 rounded-full">
                    <ShieldCheck className="w-10 h-10 text-primary" />
                </div>

                <div>
                    <h3 className="text-2xl font-bold text-foreground">
                        ₹{amount.toLocaleString("en-IN")}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Payment for {projectName}
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl border-2 border-primary/20 shadow-sm">
                    <QRCodeSVG
                        value={upiUri}
                        size={200}
                        level="H"
                        includeMargin={true}
                    />
                </div>

                <div className="w-full space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                        Or pay to UPI ID:
                    </p>
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                        <span className="font-mono text-sm">{upiId}</span>
                        <button
                            onClick={handleCopyUpi}
                            className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
                            title="Copy UPI ID"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="w-full pt-4 border-t border-border space-y-3">
                    <Button onClick={onClose} className="w-full" variant="outline">
                        Close
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// ─── EditorSettlementModal (Admin-only: pay editor via UPI → mark as paid) ────

interface EditorSettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    projectName: string;
    /** Amount owed to the editor */
    editorAmount: number;
    /** Editor's UPI ID from their payout settings */
    editorUpiId?: string;
    /** Editor's display name */
    editorName?: string;
    /** Editor's bank account details */
    editorBankDetails?: {
        accountNumber?: string;
        ifsc?: string;
        bankName?: string;
        accountHolderName?: string;
    };
    /** Server action to mark payment as done */
    onMarkAsPaid: () => Promise<void>;
    /** Whether the editor has already been paid */
    alreadyPaid?: boolean;
}

export function EditorSettlementModal({
    isOpen,
    onClose,
    projectId,
    projectName,
    editorAmount,
    editorUpiId,
    editorName = "Editor",
    editorBankDetails,
    onMarkAsPaid,
    alreadyPaid = false,
}: EditorSettlementModalProps) {
    const [marking, setMarking] = useState(false);
    const [confirmed, setConfirmed] = useState(false);

    const hasUpi = Boolean(editorUpiId);
    const hasBank = Boolean(editorBankDetails?.accountNumber);

    // UPI URI for editor payment (admin scans this to pay the editor)
    const upiUri = hasUpi
        ? `upi://pay?pa=${editorUpiId}&pn=${encodeURIComponent(editorName)}&am=${editorAmount}&cu=INR&tn=${encodeURIComponent(`Payment for ${projectName}`)}`
        : "";

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied!`);
    };

    const handleMarkAsPaid = async () => {
        if (!confirmed) {
            toast.warning(
                "Please confirm that you have transferred the payment before marking as paid."
            );
            return;
        }
        setMarking(true);
        try {
            await onMarkAsPaid();
            toast.success(`Editor payment for ${projectName} marked as settled!`);
            onClose();
        } catch (err: any) {
            toast.error(err?.message || "Failed to mark payment as done.");
        } finally {
            setMarking(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Settle Editor Payment"
            maxWidth="max-w-lg"
        >
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                    <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                        <Banknote className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                            Settlement Amount
                        </p>
                        <p className="text-2xl font-black text-foreground tracking-tight">
                            ₹{editorAmount.toLocaleString("en-IN")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            {projectName} · {editorName}
                        </p>
                    </div>
                </div>

                {alreadyPaid ? (
                    <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        <p className="text-sm font-semibold text-emerald-500">
                            This editor has already been paid for this project.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* UPI Section */}
                        {hasUpi && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Smartphone className="h-4 w-4 text-primary" />
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                        Pay via UPI
                                    </h4>
                                </div>
                                <div className="flex flex-col items-center gap-4">
                                    <div className="bg-white p-4 rounded-xl border-2 border-primary/20 shadow-sm">
                                        <QRCodeSVG
                                            value={upiUri}
                                            size={180}
                                            level="H"
                                            includeMargin={true}
                                        />
                                    </div>
                                    <div className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
                                        <div>
                                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                                UPI ID
                                            </p>
                                            <span className="font-mono text-sm font-semibold text-foreground">
                                                {editorUpiId}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() =>
                                                copyToClipboard(
                                                    editorUpiId!,
                                                    "UPI ID"
                                                )
                                            }
                                            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bank Transfer Section */}
                        {hasBank && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-primary" />
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
                                        Bank Transfer (NEFT/IMPS)
                                    </h4>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {editorBankDetails?.accountHolderName && (
                                        <BankField
                                            label="Account Holder"
                                            value={editorBankDetails.accountHolderName}
                                            onCopy={() =>
                                                copyToClipboard(
                                                    editorBankDetails!.accountHolderName!,
                                                    "Account holder name"
                                                )
                                            }
                                        />
                                    )}
                                    {editorBankDetails?.bankName && (
                                        <BankField
                                            label="Bank"
                                            value={editorBankDetails.bankName}
                                            onCopy={() =>
                                                copyToClipboard(
                                                    editorBankDetails!.bankName!,
                                                    "Bank name"
                                                )
                                            }
                                        />
                                    )}
                                    {editorBankDetails?.accountNumber && (
                                        <BankField
                                            label="Account Number"
                                            value={editorBankDetails.accountNumber}
                                            onCopy={() =>
                                                copyToClipboard(
                                                    editorBankDetails!.accountNumber!,
                                                    "Account number"
                                                )
                                            }
                                            mono
                                        />
                                    )}
                                    {editorBankDetails?.ifsc && (
                                        <BankField
                                            label="IFSC Code"
                                            value={editorBankDetails.ifsc}
                                            onCopy={() =>
                                                copyToClipboard(
                                                    editorBankDetails!.ifsc!,
                                                    "IFSC code"
                                                )
                                            }
                                            mono
                                        />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* No payment details warning */}
                        {!hasUpi && !hasBank && (
                            <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                                        No payment details on file
                                    </p>
                                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                                        The editor has not added their UPI or bank details yet.
                                        Coordinate via email or phone.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Confirmation Checkbox */}
                        <div className="pt-2 border-t border-border">
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={confirmed}
                                    onChange={(e) =>
                                        setConfirmed(e.target.checked)
                                    }
                                    className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                                />
                                <span className="text-xs text-muted-foreground leading-relaxed group-hover:text-foreground transition-colors">
                                    I confirm that I have transferred{" "}
                                    <strong className="text-foreground">
                                        ₹{editorAmount.toLocaleString("en-IN")}
                                    </strong>{" "}
                                    to {editorName} and want to mark this
                                    payment as settled in the system.
                                </span>
                            </label>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            <Button
                                onClick={onClose}
                                variant="outline"
                                className="flex-1"
                                disabled={marking}
                            >
                                Cancel
                            </Button>
                            <button
                                onClick={handleMarkAsPaid}
                                disabled={marking || !confirmed}
                                className="flex-1 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                            >
                                {marking ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        Mark as Paid
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
}

// ─── Helper subcomponent ──────────────────────────────────────────────────────

function BankField({
    label,
    value,
    onCopy,
    mono = false,
}: {
    label: string;
    value: string;
    onCopy: () => void;
    mono?: boolean;
}) {
    return (
        <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                {label}
            </p>
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`text-sm font-semibold text-foreground truncate ${
                        mono ? "font-mono" : ""
                    }`}
                >
                    {value}
                </span>
                <button
                    onClick={onCopy}
                    className="p-1 shrink-0 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
                >
                    <Copy className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}
