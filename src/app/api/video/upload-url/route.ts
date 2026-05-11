import { NextResponse } from 'next/server';
import { video } from '@/lib/mux';

export async function POST(req: Request) {
  try {
    const { filename, passthrough } = await req.json();

    const upload = await video.uploads.create({
      new_asset_settings: {
        playback_policy: ['public'],
        passthrough: passthrough || undefined,
        mp4_support: 'none',
      },
      cors_origin: '*', // In production, this should be your domain
    });

    return NextResponse.json({
      id: upload.id,
      url: upload.url,
    });
  } catch (error) {
    console.error("Mux Upload Error:", error);
    return NextResponse.json({ 
      error: 'Failed to create upload URL',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
