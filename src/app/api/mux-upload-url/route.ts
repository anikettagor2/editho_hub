import { NextResponse } from 'next/server';
import { video } from '@/lib/mux';

export async function POST(req: Request) {
    try {
        const { projectId, revisionId, filename } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
        }

        const passthroughData = {
            projectId,
            revisionId,
            filename
        };

        const assetSettings: any = {
            playback_policy: ["public"],
            static_renditions: "standard",
            passthrough: JSON.stringify(passthroughData),
        };

        const upload = await video.uploads.create({
            new_asset_settings: assetSettings,
            cors_origin: "*",
        });

        return NextResponse.json({
            id: upload.id,
            url: upload.url,
        });
    } catch (error: any) {
        console.error("[Mux Upload URL Error]:", error);
        return NextResponse.json({ 
            error: "Failed to create upload URL",
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
