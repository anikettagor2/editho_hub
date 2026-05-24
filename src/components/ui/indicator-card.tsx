"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface IndicatorCardProps {
    label: string;
    value: string | number;
    subtext?: string;
    trend?: string;
    trendUp?: boolean;
    alert?: boolean;
    icon?: ReactNode;
    className?: string;
}

export function IndicatorCard({ 
    label, 
    value, 
    subtext, 
    trend, 
    trendUp, 
    alert, 
    icon, 
    className 
}: IndicatorCardProps) {
    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className={cn(
                "group relative bg-card border border-border/50 rounded-xl p-3 sm:p-4 transition-all duration-300 shadow-md shadow-black/5 overflow-hidden flex items-center justify-between gap-4",
                alert && "after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-primary/30 after:animate-pulse",
                className
            )}
        >
            <div className="flex items-center gap-3 min-w-0">
                {/* Icon Container */}
                <div className={cn(
                    "h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:border-primary/20 transition-all duration-300 [&>svg]:h-4 [&>svg]:w-4 sm:[&>svg]:h-[18px] sm:[&>svg]:w-[18px] shrink-0",
                    alert && "bg-primary/5 border-primary/20 text-primary"
                )}>
                    {icon}
                </div>

                {/* Text Labels */}
                <div className="min-w-0">
                    <span className="text-[9px] sm:text-[10px] uppercase font-black tracking-widest text-muted-foreground group-hover:text-foreground transition-colors truncate block">
                        {label}
                    </span>
                    {(subtext || trend) && (
                        <span className="text-muted-foreground/60 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider truncate block mt-0.5">
                            {trend ? `${trend} • ` : ""}{subtext}
                        </span>
                    )}
                </div>
            </div>

            {/* Numeric Value & Alert Ping */}
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading tabular-nums">
                    {value}
                </span>
                {alert && (
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.8)]" />
                )}
            </div>
        </motion.div>
    );
}
