"use client";

import { useState } from "react";
import { Loader2, CreditCard, Zap } from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaymentButtonProps {
    projectId: string;
    projectName?: string;
    user?: any | null;
    /** Razorpay-facing amount (includes GST, charged to customer) */
    amount: number;
    /** Accounting ledger amount (GST-exclusive, stored in Firestore) */
    accountingAmount?: number;
    taxRate?: number;
    description: string;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    /** paymentType passed to /api/verify-payment ('initial' | 'final') */
    paymentType?: "initial" | "final";
    onSuccess?: () => void;
    className?: string;
    allowPayLaterBypass?: boolean;
}

// ─── Helper: load Razorpay script dynamically ─────────────────────────────────

function loadRazorpayScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if ((window as any).Razorpay) {
            resolve(true);
            return;
        }
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentButton({
    projectId,
    projectName = "Project",
    user,
    amount,
    accountingAmount,
    taxRate = 18,
    description,
    prefill,
    paymentType = "final",
    onSuccess,
    className,
    allowPayLaterBypass = true,
}: PaymentButtonProps) {
    const [loading, setLoading] = useState(false);

    // ─── Pay Later bypass ───────────────────────────────────────────────────
    if (allowPayLaterBypass && user?.payLater) {
        return (
            <div
                className={`p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-center ${
                    className || ""
                }`}
            >
                <p className="text-sm font-medium text-blue-400 mb-1">
                    Pay Later Enabled
                </p>
                <p className="text-xs text-zinc-400">
                    Please contact your Project Manager to settle payment.
                    Downloads will be unlocked manually after verification.
                </p>
            </div>
        );
    }

    // ─── Main payment handler ────────────────────────────────────────────────
    const handlePayment = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (amount < 1) {
            toast.error("Amount must be at least ₹1");
            return;
        }

        setLoading(true);

        try {
            // 1. Load Razorpay SDK
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                toast.error(
                    "Payment gateway could not load. Please check your internet connection."
                );
                return;
            }

            // 2. Create order on server
            const orderRes = await fetch("/api/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, projectId }),
            });

            const orderData = await orderRes.json();

            if (!orderRes.ok) {
                toast.error(
                    orderData?.error || "Failed to create payment order"
                );
                return;
            }

            const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
            if (!keyId) {
                toast.error("Payment gateway is not configured.");
                return;
            }

            // 3. Open Razorpay Checkout
            const razorpayOptions: any = {
                key: keyId,
                amount: orderData.amount, // in paise from server
                currency: orderData.currency || "INR",
                name: "EditoHub Studio",
                description: description,
                order_id: orderData.id,
                prefill: {
                    name: prefill?.name || user?.displayName || "",
                    email: prefill?.email || user?.email || "",
                    contact: prefill?.contact || "",
                },
                theme: {
                    color: "#6366f1",
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                        toast.info("Payment cancelled.");
                    },
                },
                handler: async (response: any) => {
                    // 4. Verify payment on server
                    try {
                        const verifyRes = await fetch("/api/verify-payment", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id:
                                    response.razorpay_payment_id,
                                razorpay_signature:
                                    response.razorpay_signature,
                                projectId,
                                amount,
                                accountingAmount: accountingAmount ?? amount,
                                taxRate,
                                paymentType,
                            }),
                        });

                        const verifyData = await verifyRes.json();

                        if (verifyRes.ok && verifyData.success) {
                            toast.success("Payment successful! 🎉");
                            onSuccess?.();
                        } else {
                            toast.error(
                                verifyData?.error ||
                                    "Payment verification failed. Please contact support."
                            );
                        }
                    } catch (err) {
                        console.error("Verification error:", err);
                        toast.error(
                            "Verification error. Please contact support."
                        );
                    } finally {
                        setLoading(false);
                    }
                },
            };

            const rzp = new (window as any).Razorpay(razorpayOptions);

            rzp.on("payment.failed", (response: any) => {
                console.error("Payment failed:", response.error);
                toast.error(
                    `Payment failed: ${
                        response.error?.description || "Unknown error"
                    }`
                );
                setLoading(false);
            });

            rzp.open();
        } catch (err: any) {
            console.error("Payment error:", err);
            toast.error(err?.message || "An error occurred. Please try again.");
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handlePayment}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary/90 px-6 py-3 text-sm font-bold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20 ${
                className || "w-full h-12"
            }`}
        >
            {loading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing…
                </>
            ) : (
                <>
                    <CreditCard className="h-4 w-4" />
                    Pay ₹{amount.toLocaleString("en-IN")}
                    <Zap className="h-3.5 w-3.5 opacity-70" />
                </>
            )}
        </button>
    );
}
