import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const videoPath = request.nextUrl.searchParams.get("path");

  if (!videoPath) {
    return new NextResponse("Missing video path", { status: 400 });
  }

  try {
    const parsed = new URL(videoPath, request.nextUrl.origin);
    if (parsed.pathname === "/api/storage/s3") {
      parsed.searchParams.set("download", "0");
      return NextResponse.redirect(parsed, { status: 302 });
    }

    if (parsed.hostname.includes("amazonaws.com") || parsed.hostname.includes(".s3.")) {
      return NextResponse.redirect(videoPath, { status: 302 });
    }

    // Legacy Firebase URL support for old records only. New uploads are S3-backed.
    if (parsed.hostname.includes("firebasestorage.googleapis.com") || parsed.hostname.includes("firebasestorage.app")) {
      return NextResponse.redirect(videoPath, { status: 302 });
    }

    return NextResponse.redirect(parsed, { status: 302 });
  } catch {
    return new NextResponse("Invalid video path", { status: 400 });
  }
}
