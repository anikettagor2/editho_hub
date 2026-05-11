import { NextResponse } from 'next/server';
import { video } from '@/lib/mux';

export async function POST(req: Request) {
  const { url, passthrough } = await req.json();

  try {
    const asset = await video.assets.create({
      input: [{ url }],
      playback_policy: ['public'],
      passthrough: passthrough || undefined,
      mp4_support: 'none',
    } as any);

    return NextResponse.json({
      id: asset.id,
      playbackId: asset.playback_ids?.[0]?.id,
    });
  } catch (error) {
    console.error("Mux Ingest Error:", error);
    return NextResponse.json({ 
      error: String(error), 
      details: error instanceof Error ? error.message : error 
    }, { status: 500 });
  }
}
