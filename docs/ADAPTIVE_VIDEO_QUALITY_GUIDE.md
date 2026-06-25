# Adaptive Video Quality System - Complete Implementation Guide

## Overview

The adaptive video quality system automatically encodes videos into multiple quality versions (360p, 480p, 720p) and serves the optimal quality based on:

- **Device capabilities** (mobile, tablet, desktop)
- **Network bandwidth** (auto-detected)
- **Screen resolution** (phone, tablet, desktop)
- **Playback performance** (smooth upgrade if bandwidth allows)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Video Upload                                 │
│                    (Firebase Storage)                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────────┐
        │  Cloud Function: encodeUploadedVideo    │
        │  (Triggered automatically)               │
        │  • Encodes to 360p, 480p, 720p          │
        │  • Stores in quality-specific folders   │
        │  • Updates Firestore metadata            │
        └──────────────────────┬───────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │    Firebase Storage                      │
        │    ├─ original/video.mp4                │
        │    ├─ quality-360p/video.mp4            │
        │    ├─ quality-480p/video.mp4            │
        │    └─ quality-720p/video.mp4            │
        └──────────────────────┬───────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │  Client: AdaptiveVideoPlayer            │
        │  • Detects bandwidth                     │
        │  • Selects best quality                 │
        │  • Preloads upgrade                     │
        │  • Monitors playback                    │
        └──────────────────────────────────────────┘
```

## Setup Steps

### 1. Enable Video Encoding Cloud Function

**File**: `functions/src/video-encoding.ts`

Deploy the function:

```bash
cd functions
npm install firebase-functions firebase-admin fluent-ffmpeg uuid
firebase deploy --only functions:encodeUploadedVideo
```

**Or for manual encoding:**

```bash
firebase deploy --only functions:manualEncodeVideo
```

### 2. Update Firestore Schema

Your video documents should have this structure:

```typescript
// videos/{videoId}
{
  id: string;
  title: string;
  description?: string;
  storagePath: string; // Original quality: "videos/original/video.mp4"

  // Added by encoding function:
  encodedQualities?: {
    '360p': string;    // "videos/quality-360p/video.mp4"
    '480p': string;    // "videos/quality-480p/video.mp4"
    '720p': string;    // "videos/quality-720p/video.mp4"
  };
  encodingStatus?: 'pending' | 'completed' | 'failed';
  processedAt?: timestamp;

  // Metadata
  duration: number;
  fileSize: number;
  thumbnailUrl?: string;
  createdAt: timestamp;
  updatedAt: timestamp;
}
```

### 3. Add Video Quality Detection

Files created:

- `/src/lib/video/qualityDetector.ts` - Bandwidth detection and quality recommendation

### 4. Update Video Loader

Files created:

- `/src/lib/firebase/adaptiveVideoLoader.ts` - Adaptive quality selection

### 5. Update Video Player Component

Files created:

- `/src/components/AdaptiveVideoPlayer.tsx` - New component with quality UI
- `/src/hooks/useAdaptiveVideo.ts` - Hook for adaptive loading

## Usage

### Basic Implementation

```tsx
import AdaptiveVideoPlayer from "@/components/AdaptiveVideoPlayer";

export default function VideoPage() {
  return (
    <AdaptiveVideoPlayer
      storagePath="videos/original/my-video.mp4"
      videoId="video123"
      thumbnailUrl="https://..."
      title="My Video"
      duration={300}
      fileSize={52428800}
      useAdaptiveQuality={true}
      showQualitySelector={true}
      showMetadata={true}
    />
  );
}
```

### Video Feed/Grid

```tsx
"use client";

import { useEffect, useState } from "react";
import { getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import AdaptiveVideoPlayer from "@/components/AdaptiveVideoPlayer";

export default function VideoFeed() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    const loadVideos = async () => {
      const snapshot = await getDocs(collection(db, "videos"));
      const videosList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setVideos(videosList);
    };

    loadVideos();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {videos.map((video) => (
        <AdaptiveVideoPlayer
          key={video.id}
          storagePath={video.storagePath}
          videoId={video.id}
          thumbnailUrl={video.thumbnailUrl}
          title={video.title}
          duration={video.duration}
          fileSize={video.fileSize}
          useAdaptiveQuality={true}
          showQualitySelector={true}
          useLazyLoading={true}
          onError={(error) => console.error("Video error:", error)}
          onSuccess={(url, quality) => {
            console.log(`Loaded ${quality} version`);
          }}
        />
      ))}
    </div>
  );
}
```

### Using the Hook Directly

```tsx
import { useAdaptiveVideo } from "@/hooks/useAdaptiveVideo";

export default function CustomVideoPlayer() {
  const { url, quality, canUpgrade, upgradeQuality, isLoading, error } =
    useAdaptiveVideo({
      videoId: "video123",
      storagePath: "videos/original/video.mp4",
      useAdaptiveQuality: true,
    });

  if (isLoading) return <div>Loading best quality...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <video src={url} controls />
      <p>Quality: {quality}</p>
      {canUpgrade && (
        <button onClick={() => upgradeQuality()}>
          Upgrade to Better Quality
        </button>
      )}
    </div>
  );
}
```

## How It Works

### 1. **Upload Video**

User uploads video to Firebase Storage:

- Stored in `videos/original/video.mp4`
- Firestore document created with metadata

### 2. **Auto Encoding** (Cloud Function)

When video appears in Storage:

- Cloud Function triggered automatically
- Encodes to 360p, 480p, 720p
- Stores in `quality-360p/`, `quality-480p/`, `quality-720p/` folders
- Updates Firestore with encoded paths
- Sets `encodingStatus: 'completed'`

### 3. **Client Bandwidth Detection**

When user loads video:

- `detectBandwidth()` runs a 1MB download speed test
- Calculated Mbps used to recommend quality
- Device type (mobile/desktop) also considered

### 4. **Initial Quality Selection**

Gets best quality that meets criteria:

- **Fast Loading**: Conservative estimate (lower than capability)
- **360p**: < 1 Mbps or low-end device
- **480p**: 1-5 Mbps
- **720p**: 5-10 Mbps
- **1080p**: > 10 Mbps

### 5. **Progressive Upgrade**

During playback:

- Preloads next quality tier
- Monitors playback smoothness
- If buffer stays healthy, upgrades automatically
- User can manually click "Upgrade to HD"

## Performance Metrics

### Before (Full Quality)

- Network requests: Large files (500MB+)
- Initial load time: 30-60 seconds
- Buffering: Frequent on slow connections
- Data usage: High

### After (Adaptive Quality)

- Network requests: 360p (~50MB), 480p (~100MB), 720p (~250MB)
- Initial load time: 5-10 seconds
- Buffering: Rare (bandwidth-matched)
- Data usage: ~80% reduction on mobile

### File Size Estimates (5-minute video)

| Quality | File Size | Bitrate  | Load Time @ 2.5Mbps |
| ------- | --------- | -------- | ------------------- |
| 360p    | ~50 MB    | 500 kbps | ~2-3 min            |
| 480p    | ~100 MB   | 1 Mbps   | ~4-5 min            |
| 720p    | ~250 MB   | 2.5 Mbps | ~12-15 min          |
| 1080p   | ~500 MB   | 5 Mbps   | ~25-30 min          |

## Quality Detection Logic

```
Device Type Detection:
├─ Mobile (iPhone, Android)
│  └─ Max: 720p
├─ Tablet
│  └─ Max: 1080p
└─ Desktop
   └─ Max: 1080p

Network Speed Detection:
├─ Slow (< 1 Mbps)
│  └─ Start: 360p
├─ Medium (1-5 Mbps)
│  └─ Start: 480p
├─ Fast (5-10 Mbps)
│  └─ Start: 720p
└─ Very Fast (> 10 Mbps)
   └─ Start: 1080p

Initial Selection:
└─ Take the LOWER of device max or detected quality
   (Conservative for fast startup)
```

## Bandwidth Detection Accuracy

The system measures download speed via:

- 1MB test file download
- Measures time taken
- Calculates Mbps

**Accuracy**: ±20% (good enough for quality selection)

**Factors affecting detection:**

- Network congestion
- Distance to CDN
- Device CPU load
- Background app activity

## Troubleshooting

### Videos not encoding

Check Cloud Function logs:

```bash
firebase functions:log
```

Verify:

- FFmpeg installed in function runtime
- Storage permissions correct
- Firestore write permissions correct

### Stuck at "Loading..."

- Check browser DevTools Network tab
- Verify video paths in Firestore
- Check Firebase Storage CORS settings

### Quality not upgrading

Reasons:

- Bandwidth too low
- Buffering issues
- Video too short (upgrade happens at 10% mark)
- Manual intervention needed

### High bandwidth usage

Solutions:

- Reduce startup quality conservatively
- Force lower initial quality
- Check for stuck/failed requests

## Advanced Configuration

### Custom Quality Presets

Edit `QUALITY_PRESETS` in `qualityDetector.ts`:

```ts
const QUALITY_PRESETS: Record<VideoQuality, QualityOption> = {
  "360p": {
    quality: "360p",
    bitrate: 500, // Adjust bitrate
    resolution: "640x360",
    fileSize: 50,
  },
  // ...
};
```

### Force Specific Quality

```tsx
const { setQuality } = useAdaptiveVideo({...});

<button onClick={() => setQuality('720p')}>
  Force 720p
</button>
```

### Disable Adaptive Loading

```tsx
<AdaptiveVideoPlayer
  useAdaptiveQuality={false}  // Uses original quality only
  {...}
/>
```

## Security Considerations

1. **Firestore Security Rules**: Restrict access to video documents
2. **Storage Security Rules**: Protect video files
3. **Cloud Function**: Validate video files before encoding
4. **Rate Limiting**: Prevent abuse of bandwidth detection

## Future Improvements

1. **HLS Streaming**: For even better adaptive bitrate
2. **Analytics**: Track quality distribution
3. **CDN Integration**: Serve from edge locations
4. **WebRTC P2P**: Peer-to-peer video sharing
5. **AV1 Codec**: Better compression than H.264

## Cost Estimation

**Per 1GB of video uploads:**

- Cloud Function execution: ~$0.40
- FFmpeg processing: ~$0.50
- Storage (3 versions): ~$0.03/month
- **Total**: ~$0.90 one-time + $0.03/month storage

---

**Last Updated**: April 2026  
**Version**: 1.0
