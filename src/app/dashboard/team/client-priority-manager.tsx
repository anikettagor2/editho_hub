"use client";

import { useState, useMemo } from "react";
import { User } from "@/types/schema";
import { saveClientEditorPriority } from "@/app/actions/admin-actions";
import { toast } from "sonner";
import { Plus, X, GripVertical, Settings2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";

interface ClientPriorityManagerProps {
    clientId: string;
    clientName: string;
    assignedPriority: { editorId: string; priority: number; targetPrice?: number; editorFee?: number }[];
    editors: User[];
    defaultRate?: number;
    multiTierRates?: Record<string, { label?: string; price: number }[]>;
    customRates?: Record<string, number>;
    salesExecName?: string;
}

export function ClientPriorityManager({ 
    clientId, 
    clientName, 
    assignedPriority, 
    editors, 
    defaultRate = 50,
    multiTierRates,
    customRates,
    salesExecName
}: ClientPriorityManagerProps) {
    const [open, setOpen] = useState(false);
    const [priorities, setPriorities] = useState<{ editorId: string; priority: number; targetPrice?: number; editorFee?: number }[]>(
        [...(assignedPriority || [])].sort((a, b) => a.priority - b.priority)
    );
    const [editorRate, setEditorRate] = useState<number>(defaultRate);
    const [saving, setSaving] = useState(false);

    // Form state for adding new priority
    const [newEditorId, setNewEditorId] = useState("");
    const [newTargetPrice, setNewTargetPrice] = useState<number | "">("");
    const [newEditorFee, setNewEditorFee] = useState<number | "">("");

    const availablePrices = useMemo(() => {
        const prices = new Set<number>();
        if (multiTierRates) {
            Object.values(multiTierRates).forEach(tiers => {
                tiers.forEach(t => prices.add(t.price));
            });
        }
        if (customRates) {
            Object.values(customRates).forEach(p => prices.add(p));
        }
        return Array.from(prices).sort((a, b) => a - b);
    }, [multiTierRates, customRates]);

    const handleAddEditor = () => {
        if (!newEditorId || newTargetPrice === "" || newEditorFee === "") {
            toast.error("Please fill all fields for the priority entry.");
            return;
        }

        // Check if this editor already has a priority for this specific price
        if (priorities.find(p => p.editorId === newEditorId && p.targetPrice === newTargetPrice)) {
            toast.error("This editor already has a priority for this price.");
            return;
        }

        // Find current max priority for this specific price
        const samePricePriorities = priorities.filter(p => p.targetPrice === newTargetPrice);
        const nextPriority = samePricePriorities.length + 1;

        const newEntry = {
            editorId: newEditorId,
            priority: nextPriority,
            targetPrice: Number(newTargetPrice),
            editorFee: Number(newEditorFee)
        };

        setPriorities([...priorities, newEntry]);
        setNewEditorId("");
        setNewTargetPrice("");
        setNewEditorFee("");
    };

    const handleRemoveEditor = (editorId: string, targetPrice?: number) => {
        const updated = priorities
            .filter(p => !(p.editorId === editorId && p.targetPrice === targetPrice))
            // Re-normalize priorities within the same price group
            .map(p => p); 
        
        // Re-calculate priorities for each group
        const grouped: Record<number, typeof priorities> = {};
        updated.forEach(p => {
            const tp = p.targetPrice || 0;
            if (!grouped[tp]) grouped[tp] = [];
            grouped[tp].push(p);
        });

        const final: typeof priorities = [];
        Object.values(grouped).forEach(list => {
            list.sort((a, b) => a.priority - b.priority).forEach((p, idx) => {
                final.push({ ...p, priority: idx + 1 });
            });
        });

        setPriorities(final);
    };

    const handleMove = (index: number, direction: 'up' | 'down', targetPrice?: number) => {
        const samePriceIndices = priorities
            .map((p, i) => ({ p, i }))
            .filter(x => x.p.targetPrice === targetPrice)
            .sort((a, b) => a.p.priority - b.p.priority);

        const currentInGroupIdx = samePriceIndices.findIndex(x => x.i === index);
        if (currentInGroupIdx === -1) return;

        if (direction === 'up' && currentInGroupIdx > 0) {
            const swapIdx = samePriceIndices[currentInGroupIdx - 1].i;
            const newPriorities = [...priorities];
            [newPriorities[swapIdx].priority, newPriorities[index].priority] = [newPriorities[index].priority, newPriorities[swapIdx].priority];
            setPriorities(newPriorities.sort((a, b) => (a.targetPrice || 0) - (b.targetPrice || 0) || a.priority - b.priority));
        } else if (direction === 'down' && currentInGroupIdx < samePriceIndices.length - 1) {
            const swapIdx = samePriceIndices[currentInGroupIdx + 1].i;
            const newPriorities = [...priorities];
            [newPriorities[swapIdx].priority, newPriorities[index].priority] = [newPriorities[index].priority, newPriorities[swapIdx].priority];
            setPriorities(newPriorities.sort((a, b) => (a.targetPrice || 0) - (b.targetPrice || 0) || a.priority - b.priority));
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await saveClientEditorPriority(clientId, priorities, editorRate);
            if (!result.success) throw new Error(result.error || "Unknown error");
            toast.success("Settings saved successfully.");
            setOpen(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to save: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    // Group priorities by price for display
    const groupedPriorities = useMemo(() => {
        const groups: Record<string, typeof priorities> = {};
        priorities.forEach(p => {
            const key = p.targetPrice ? `₹${p.targetPrice.toLocaleString()}` : "General";
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        return groups;
    }, [priorities]);

    return (
        <>
            <button 
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-primary transition-colors bg-muted/50 px-3 py-1.5 rounded-md border border-border/50"
            >
                <Settings2 className="h-3.5 w-3.5" />
                Configure Auto-Assign
            </button>

            <Modal 
                isOpen={open} 
                onClose={() => setOpen(false)} 
                title={`Editor Priority for ${clientName}`}
                maxWidth="max-w-[600px]"
            >
                <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                    <p className="text-sm text-muted-foreground">
                        Set specific editors and their fees based on the project price. If no specific price match is found, the system falls back to the default rate.
                    </p>

                    {availablePrices.length === 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <p className="text-xs text-amber-600 font-semibold flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                Pricing not configured for this client.
                            </p>
                            <p className="text-[10px] text-amber-600/80 mt-1">
                                Please reach out to the Sales Executive <strong className="text-amber-700">{salesExecName || "assigned to this client"}</strong> to set the project rates before configuring auto-assignment.
                            </p>
                        </div>
                    )}

                    <div className="space-y-2 p-4 bg-muted/30 rounded-xl border border-border">
                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Add Priority Rule</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-bold">Project Price</label>
                                <select 
                                    className="w-full bg-background border border-input rounded-md text-sm px-3 py-2"
                                    value={newTargetPrice}
                                    onChange={(e) => {
                                        const price = Number(e.target.value);
                                        setNewTargetPrice(price);
                                        // Default editor fee to 50%
                                        setNewEditorFee(Math.round(price * (editorRate / 100)));
                                    }}
                                >
                                    <option value="" disabled>Select Price...</option>
                                    {availablePrices.length === 0 ? (
                                        <option disabled className="text-destructive font-bold">
                                            No prices set - Contact {salesExecName}
                                        </option>
                                    ) : (
                                        availablePrices.map(p => (
                                            <option key={p} value={p}>₹{p.toLocaleString()}</option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-bold">Editor</label>
                                <select 
                                    className="w-full bg-background border border-input rounded-md text-sm px-3 py-2"
                                    value={newEditorId}
                                    onChange={(e) => setNewEditorId(e.target.value)}
                                >
                                    <option value="" disabled>Select Editor...</option>
                                    {editors.map(e => (
                                        <option key={e.uid} value={e.uid}>{e.displayName || e.email}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] text-muted-foreground uppercase font-bold">Editor Fee (₹)</label>
                                <input 
                                    type="number" 
                                    className="w-full bg-background border border-input rounded-md text-sm px-3 py-2"
                                    value={newEditorFee}
                                    onChange={(e) => setNewEditorFee(Number(e.target.value))}
                                    placeholder="Amount to pay editor"
                                />
                            </div>
                            <div className="flex items-end">
                                <button 
                                    onClick={handleAddEditor}
                                    className="w-full bg-primary text-primary-foreground h-[38px] rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Plus className="h-4 w-4" /> Add Rule
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-border pb-2">
                            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Current Priority Rules</label>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] text-muted-foreground uppercase font-bold">Default Fallback:</label>
                                <input 
                                    type="number" 
                                    value={editorRate} 
                                    onChange={(e) => setEditorRate(Number(e.target.value))}
                                    className="w-12 bg-transparent border-none text-xs font-bold p-0 text-primary focus:ring-0"
                                    min="0"
                                    max="100"
                                />
                                <span className="text-[10px] text-primary font-bold">%</span>
                            </div>
                        </div>

                        {priorities.length === 0 ? (
                            <div className="text-sm text-muted-foreground italic p-8 bg-muted/30 border border-border border-dashed rounded-lg text-center">
                                No specific rules set. Using global fallback rate.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {Object.entries(groupedPriorities).map(([priceLabel, list]) => (
                                    <div key={priceLabel} className="space-y-2">
                                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-tighter flex items-center gap-2">
                                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">{priceLabel} Projects</span>
                                            <div className="h-px bg-border flex-1" />
                                        </div>
                                        <div className="space-y-2">
                                            {list.map((p, idx) => {
                                                const ed = editors.find(e => e.uid === p.editorId);
                                                const globalIdx = priorities.findIndex(x => x.editorId === p.editorId && x.targetPrice === p.targetPrice);
                                                return (
                                                    <div key={`${p.editorId}-${p.targetPrice}`} className="flex items-center justify-between gap-3 p-3 bg-card border border-border rounded-lg shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <button onClick={() => handleMove(globalIdx, 'up', p.targetPrice)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                                                                    <GripVertical className="h-3 w-3" />
                                                                </button>
                                                                <span className="text-[10px] font-bold text-muted-foreground w-4 text-center">{p.priority}</span>
                                                                <button onClick={() => handleMove(globalIdx, 'down', p.targetPrice)} disabled={idx === list.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
                                                                    <GripVertical className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                            <div>
                                                                <div className="font-medium text-sm text-foreground">{ed?.displayName || 'Unknown Editor'}</div>
                                                                <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                                                    <span className="font-bold text-emerald-500">Editor Fee: ₹{p.editorFee?.toLocaleString()}</span>
                                                                    <span>•</span>
                                                                    <span>{ed?.email}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button 
                                                            onClick={() => handleRemoveEditor(p.editorId, p.targetPrice)}
                                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border">
                        <button 
                            onClick={() => setOpen(false)}
                            className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded-md transition-colors"
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors shadow-lg shadow-primary/20"
                        >
                            {saving ? "Saving..." : "Save Configuration"}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
