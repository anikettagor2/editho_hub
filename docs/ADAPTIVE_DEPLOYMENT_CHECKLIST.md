# Adaptive Video Quality System - Deployment Checklist

## Pre-Deployment Verification

### ✅ Code Files Created

- [ ] `/src/lib/video/qualityDetector.ts` - Bandwidth detection and quality recommendation
- [ ] `/src/lib/firebase/adaptiveVideoLoader.ts` - Adaptive quality URL selection
- [ ] `/functions/src/video-encoding.ts` - Cloud Function for video encoding
- [ ] `/src/hooks/useAdaptiveVideo.ts` - React hook for adaptive loading
- [ ] `/src/components/AdaptiveVideoPlayer.tsx` - Video player component with quality UI

**Verify all files exist:**

```bash
ls -la src/lib/video/
ls -la src/lib/firebase/
ls -la src/hooks/
ls -la src/components/
ls -la functions/src/
```

### ✅ Dependencies Installed

```bash
# In project root (Next.js side)
npm install hls.js uuid ts-node
npm install --save-dev @types/hls.js

# In functions directory
cd functions
npm install firebase-functions firebase-admin fluent-ffmpeg uuid
npm install --save-dev @types/fluent-ffmpeg
cd ..
```

### ✅ TypeScript Compilation

```bash
# Check for type errors
npx tsc --noEmit

# Check functions folder
cd functions && npx tsc --noEmit && cd ..
```

## Firebase Configuration

### ✅ Firebase Project Setup

- [ ] Firebase project created and configured
- [ ] Storage bucket created
- [ ] Firestore database initialized
- [ ] Service account credentials available

**Verify Firebase config**: `src/lib/firebase/config.ts`

### ✅ Update firebase.json

Add Cloud Function configuration:

```json
{
  "functions": {
    "source": "functions",
    "runtime": "nodejs20",
    "codebase": "default"
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  }
}
```

### ✅ Update Firestore Security Rules

Add rules for video encoding:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Videos collection
    match /videos/{videoId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
      allow delete: if request.auth.uid == resource.data.createdBy;
    }
  }
}
```

### ✅ Update Storage Security Rules

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Original uploads
    match /videos/original/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // Encoded videos (Cloud Function writes)
    match /videos/quality-{quality}/{allPaths=**} {
      allow read: if request.auth != null;
    }
  }
}
```

## Deployment Steps

### Step 1: Verify Environment

```bash
# Check Node version (need 18+)
node --version

# Check Firebase CLI installed
firebase --version

# Verify authenticated
firebase auth:list
```

### Step 2: Deploy Cloud Function

```bash
# From project root
firebase deploy --only functions:encodeUploadedVideo

# Or deploy all functions
firebase deploy --only functions
```

**Expected output:**

```
✓ functions: Deployed successfully
Function URL: https://region-projectid.cloudfunctions.net/encodeUploadedVideo
```

### Step 3: Update Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Step 4: Update Storage Rules

```bash
firebase deploy --only storage
```

### Step 5: Verify Deployment

```bash
# Check function status
firebase functions:list

# Check function logs
firebase functions:log
```

## Integration Steps

### ✅ Update Video Upload Handler

In your video upload component, add Firestore metadata creation:

```typescript
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

async function uploadVideo(file: File, metadata: VideoMetadata) {
  // 1. Upload to Storage
  const storageRef = ref(storage, `videos/original/${file.name}`);
  await uploadBytes(storageRef, file);

  // 2. Create Firestore document (triggers encoding)
  const videoDoc = await addDoc(collection(db, "videos"), {
    title: metadata.title,
    description: metadata.description,
    storagePath: `videos/original/${file.name}`,
    duration: metadata.duration,
    fileSize: file.size,
    encodingStatus: "pending", // Cloud Function will update this
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return videoDoc.id;
}
```

### ✅ Update Video Display Component

Replace old video players with `AdaptiveVideoPlayer`:

```tsx
// OLD
import VideoPlayer from "@/components/VideoPlayer";
<VideoPlayer src={videoUrl} />;

// NEW
import AdaptiveVideoPlayer from "@/components/AdaptiveVideoPlayer";
<AdaptiveVideoPlayer
  storagePath={video.storagePath}
  videoId={video.id}
  title={video.title}
  duration={video.duration}
  fileSize={video.fileSize}
  useAdaptiveQuality={true}
  showQualitySelector={true}
/>;
```

### ✅ Update Video Feed/Gallery

If you have a video grid or feed, update it to use batch loading:

```tsx
import { getMultipleAdaptiveVideoUrls } from "@/lib/firebase/adaptiveVideoLoader";

// Load URLs for all videos efficiently
const videoUrls = await getMultipleAdaptiveVideoUrls(videos, {
  detectBandwidth: true, // Only detect once for all videos
});
```

## Testing Checklist

### ✅ Unit Tests

```bash
# Test quality detection
npm test -- qualityDetector.test.ts

# Test adaptive loader
npm test -- adaptiveVideoLoader.test.ts
```

### ✅ Manual Testing

1. **Upload Test**
   - [ ] Upload video to Firebase Storage
   - [ ] Check Cloud Function logs for encoding progress
   - [ ] Verify encoded versions created (quality-360p/, etc.)
   - [ ] Check Firestore has `encodedQualities` field

2. **Bandwidth Detection Test**
   - [ ] Open DevTools Network tab
   - [ ] Load video player
   - [ ] Verify bandwidth test request sent (~1MB)
   - [ ] Check console logs for detected Mbps
   - [ ] Verify correct quality selected

3. **Quality Loading Test**
   - [ ] Video loads with selected quality
   - [ ] Check Network tab for quality URL
   - [ ] Verify quality matches recommendation
   - [ ] Check performance (should be fast with 360p)

4. **Quality Upgrade Test**
   - [ ] Play video from 360p
   - [ ] Wait for preload of next quality
   - [ ] Click "Upgrade HD" button
   - [ ] Video upgrades to better quality
   - [ ] Check Network tab for upgrade request

5. **Error Handling Test**
   - [ ] Load non-existent video → error message displayed
   - [ ] Disable internet → retry button appears
   - [ ] Test on slow network → correct quality selected

6. **Mobile/Tablet Test**
   - [ ] Open on iPhone/iPad → max 720p
   - [ ] Open on Android → max 720p
   - [ ] Check touch handling

### ✅ Performance Testing

```bash
# Check initial load time
# Should be 5-10 seconds with 360p (vs 30-60 with full quality)

# Monitor bandwidth
# Check Network tab for total transferred bytes
# Should be ~50-100MB vs 500MB+ for full quality
```

### ✅ Cloud Function Testing

```bash
# Test function locally
firebase emulators:start --only functions

# Upload test video to emulator storage
# Check function executes
# Verify output
```

## Production Deployment Checklist

### Pre-Launch

- [ ] All files created and compiled without errors
- [ ] Cloud Function deployed and tested
- [ ] Firestore and Storage rules updated
- [ ] Video upload handler updated to create Firestore docs
- [ ] At least 5 test videos uploaded and encoded successfully
- [ ] AdaptiveVideoPlayer component integrated in at least one page
- [ ] Performance benchmarks taken
- [ ] Error handling tested

### Launch

- [ ] Replace old video players gradually (1 page at a time)
- [ ] Monitor Cloud Function logs for errors
- [ ] Monitor Firebase Storage usage
- [ ] Track user feedback on video quality

### Post-Launch

- [ ] Check analytics for quality distribution
- [ ] Monitor encoding times (should be < 5 minutes per video)
- [ ] Track user upgrade click-through rate
- [ ] Adjust quality presets if needed based on data

## Monitoring

### Cloud Function Health

```bash
# View logs
firebase functions:log

# Or in Firebase Console:
# Functions > encodeUploadedVideo > Logs
```

**Monitor for:**

- Encoding failures (check FFmpeg errors)
- Upload failures (check permissions)
- Timeout issues (videos taking too long)

### Firestore Metrics

**Check in Firebase Console:**

- Document reads/writes per day
- Storage size (should grow as encoded versions stored)
- Queries per second (should be low)

### Storage Metrics

**Check in Firebase Console:**

- Total storage used
- Breakdown by folder (original vs quality-X)
- Bandwidth usage

## Rollback Plan

If issues occur:

1. **Stop encoding new videos**

   ```bash
   firebase deploy --only functions --remove encodeUploadedVideo
   ```

2. **Revert to old video players**
   - Replace `AdaptiveVideoPlayer` with `VideoPlayer`
   - Use original video URL instead of adaptive

3. **Keep existing encoded videos as backup**
   - Disable function but keep files in Storage
   - Can re-enable later if issues fixed

## Support Contacts

- **FFmpeg Issues**: FFmpeg community docs
- **Firebase Issues**: Firebase support
- **Network Issues**: CDN support

## Cost Breakdown

**Monthly estimates (based on 100 videos, 1GB average):**

| Item                            | Cost                  |
| ------------------------------- | --------------------- |
| Cloud Function (100 videos)     | $0.40                 |
| Storage (original + 3 versions) | $0.30                 |
| Bandwidth (playback)            | $0.20/GB              |
| Firestore                       | $0.06                 |
| **Total**                       | **~$1.00 + $0.20/GB** |

## Additional Resources

- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Firebase Storage Docs](https://firebase.google.com/docs/storage)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [Adaptive Video Implementation Guide](./ADAPTIVE_VIDEO_QUALITY_GUIDE.md)

---

**Status**: Ready for Deployment ✅  
**Last Updated**: April 2026  
**Deployment Version**: 1.0
