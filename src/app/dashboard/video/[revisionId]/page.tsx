"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { Loader2, ShieldAlert } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/context/auth-context";
import { ReviewSystemModal } from "@/app/dashboard/components/review-system-modal";
import { Project, Revision } from "@/types/schema";

type RevisionDoc = Revision & {
    id: string;
};

type ProjectDoc = Project & {
    id: string;
};

export default function DashboardVideoRevisionPage() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const revisionId = (Array.isArray(params?.revisionId) ? params.revisionId[0] : params?.revisionId) as string;

    const [revision, setRevision] = useState<RevisionDoc | null>(null);
    const [project, setProject] = useState<ProjectDoc | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        if (!revisionId) return;

        let unsubProject: (() => void) | null = null;

        const unsubRevision = onSnapshot(
            doc(db, "revisions", revisionId),
            (revisionSnap) => {
                if (!revisionSnap.exists()) {
                    setRevision(null);
                    setProject(null);
                    setNotFound(true);
                    setLoading(false);
                    if (unsubProject) {
                        unsubProject();
                        unsubProject = null;
                    }
                    return;
                }

                const revisionData = { id: revisionSnap.id, ...revisionSnap.data() } as RevisionDoc;
                setRevision(revisionData);
                setNotFound(false);

                if (unsubProject) {
                    unsubProject();
                    unsubProject = null;
                }

                unsubProject = onSnapshot(
                    doc(db, "projects", revisionData.projectId),
                    (projectSnap) => {
                        if (!projectSnap.exists()) {
                            setProject(null);
                            setNotFound(true);
                        } else {
                            setProject({ id: projectSnap.id, ...projectSnap.data() } as ProjectDoc);
                            setNotFound(false);
                        }
                        setLoading(false);
                    },
                    () => {
                        setProject(null);
                        setLoading(false);
                    }
                );
            },
            () => {
                setLoading(false);
                setNotFound(true);
            }
        );

        return () => {
            unsubRevision();
            if (unsubProject) unsubProject();
        };
    }, [revisionId]);

    const isClientOwner = Boolean(
        user &&
        project &&
        user.role === "client" &&
        (project.clientId === user.uid || project.ownerId === user.uid)
    );

    const isAllowed =
        !!user &&
        !!project &&
        (user.role !== "client" || isClientOwner);

    if (authLoading || loading) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Opening shared video dashboard...</p>
                </div>
            </div>
        );
    }

    if (notFound || !revision || !project) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center px-6">
                <div className="max-w-md space-y-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
                        <ShieldAlert className="h-7 w-7 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Video link not found</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        This direct video link is missing or no longer available.
                    </p>
                </div>
            </div>
        );
    }

    if (!isAllowed) {
        return (
            <div className="flex min-h-[70vh] items-center justify-center px-6">
                <div className="max-w-md space-y-4 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                        <ShieldAlert className="h-7 w-7 text-amber-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Access restricted</h1>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        This video belongs to a different client account.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <ReviewSystemModal
            isOpen={true}
            onClose={() => router.push(`/dashboard/projects/${project.id}`)}
            project={project}
            allowUploadDraft={Boolean(user && user.role !== "client")}
            defaultRevisionId={revisionId}
            clientAccess={isClientOwner}
        />
    );
}
