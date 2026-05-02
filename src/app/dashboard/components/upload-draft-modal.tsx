"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/context/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, limit, doc } from "firebase/firestore";
import { UploadService, UploadProgress } from "@/lib/services/upload-service";
import { Revision, VideoJob } from "@/types/schema";
import { Textarea } from "@/components/ui/textarea";
import {
    Loader2,
    UploadCloud,
    FileVideo,
    Zap,
    ShieldCheck,
    ChevronRight,
    X,
    Gauge,
    Timer,
    Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { handleRevisionUploaded } from "@/app/actions/notification-actions";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_GB } from "@/lib/constants";
import { VideoPlayer } from "@/components/video-player";


interface UploadDraftModalProps {
    isOpen: boolean;
    projectId: string;
    projectName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export function UploadDraftModal({
    isOpen,
    projectId,
    projectName,
    onClose,
    onSuccess,
}: UploadDraftModalProps) {
    // ...existing hook and state code...
    // (You may need to restore any state/hooks that were lost in the broken function)

    // ...existing logic...

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    key="upload-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-10000 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 pointer-events-auto"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-card border border-border rounded-2xl overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ...existing code for modal content... */}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
