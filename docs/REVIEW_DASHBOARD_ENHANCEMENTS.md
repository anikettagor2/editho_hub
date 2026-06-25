# Enhanced Review Dashboard - Feature Documentation

## Overview

The review dashboard has been significantly enhanced to support threaded conversations, image uploads, and direct user-to-user connections without timeline constraints.

---

## ✨ New Features Implemented

### 1. **Comment Threading & Replies**

Every user can now reply to any comment with full threaded conversation support.

**Features:**

- Click "Reply" button on any comment to start a thread
- Nested comment visibility with proper indentation
- Reply metadata shows user name, role, and timestamp
- Cancel reply functionality
- Full conversation history preserved

**Use Case:**

- Client asks a question → Editor provides feedback → Client follows up
- Multiple editors can discuss specific feedback points
- Maintains context without cluttering main comment stream

---

### 2. **Image Upload Support in Comments**

Users can attach images directly to both timeline and direct connection comments.

**How to Use:**

1. Click the **"IMAGE"** button in the comment input section
2. Select an image file (JPEG, PNG, WebP, GIF)
3. Preview appears automatically below the textarea
4. Click the **"X"** button to remove the selected image
5. Submit the comment - image uploads automatically to Firebase Storage

**Specifications:**

- Maximum file size: **5MB**
- Supported formats: JPEG, PNG, WebP, GIF
- Images are stored in Firebase Storage at: `comments/{projectId}/{revisionId}/{timestamp}_filename`
- Image previews render in comments at max height of 128px

**Features:**

- Real-time preview of selected image
- Easy removal before submission
- Supports image-only comments (no text required)
- Images persist with comment history

---

### 3. **Direct Connections (No Timeline Required)**

Users can now establish direct conversations without being tied to specific video timestamps.

**How to Use:**

1. Navigate to the **"Direct Connect"** tab in the comments panel
2. Write a message or upload an image
3. Click **"Send"** (instead of "Comment @timestamp")
4. Message appears in Direct Connections tab

**Key Differences from Timeline Comments:**
| Feature | Timeline | Direct Connect |
|---------|----------|---|
| Timestamp | Yes (linked to video) | No |
| Use Case | Feedback on specific video moments | General discussion/connection |
| Visibility | Timeline comments only | Direct connections only |
| Playback Link | Click to seek video | N/A |

**Benefits:**

- Establish connections for future projects
- General feedback not tied to specific frames
- Portfolio sharing and collaboration discussions
- Off-topic conversations don't clutter timelines

---

### 4. **Enhanced Comment Display**

#### Timeline Comments Tab

- Shows all timestamped comments linked to video playback
- Timestamp appears as clickable button → seeks video to that moment
- User name, role, and deletion option visible
- Image previews inline
- Click "Reply" to add threaded responses

#### Direct Connections Tab

- Shows all non-timestamped user connections
- Displays user name and date sent
- No playback seeking capability
- Full reply threading support
- Perfect for networking and follow-up communication

---

## 🎯 User Interface Changes

### Comment Input Section

**Old:**

```
[Textarea]
[Comment @timestamp Button]
```

**New:**

```
[Textarea]
[Image Preview if selected]
[Image Button] [Send Button with dynamic label]
- Dynamic label shows timestamp for timeline mode
- Dynamic label shows "Send" for direct mode
```

### Tab Navigation

```
┌─ Timeline Comments (N) ─┬─ Direct Connections (N) ─┐
│ Shows all timestamped   │  Shows all non-timestamped
│ comments with video seek│  comments for networking
└─────────────────────────┴────────────────────────────┘
```

### Comment Card Layout

```
Timeline Comment:
┌─ [Timestamp] • [User Name] ─────── [Delete] ─┐
│                                                  │
│ Comment text here...                            │
│ [Image preview if attached]                     │
│                                                  │
│ [Reply Button]                                   │
│ └─ [Expanded Replies Zone if clicked]          │
└──────────────────────────────────────────────────┘

Direct Connection:
┌─ [User Name] ─────────────── [Delete] ─┐
│ [Date Sent]                              │
│                                          │
│ Connection message here...               │
│ [Image preview if attached]              │
│                                          │
│ [Reply Button]                           │
│ └─ [Expanded Replies Zone if clicked]   │
└──────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### File Changes

#### 1. **[src/lib/firebase/storage-utils.ts](src/lib/firebase/storage-utils.ts)** (NEW)

Utility functions for image handling:

- `uploadCommentImage(file, projectId, revisionId)` - Uploads comment images
- `deleteCommentImage(imageUrl)` - Removes images from Firebase Storage
- `uploadProfileImage(file, userId)` - For future profile pictures

```typescript
// Usage:
const imageUrl = await uploadCommentImage(file, projectId, revisionId);
```

#### 2. **[src/app/dashboard/components/review-system-modal.tsx](src/app/dashboard/components/review-system-modal.tsx)** (ENHANCED)

**New Type Definitions:**

```typescript
type ReplyDoc = {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  content: string;
  imageUrl?: string;
  createdAt: number;
};

type CommentDoc = {
  // ... existing fields
  imageUrl?: string; // NEW: Comment image URL
  replies?: ReplyDoc[]; // NEW: Nested replies
  isDirectConnection?: boolean; // NEW: Flag for direct vs timeline
};
```

**New State Variables:**

```typescript
const [activeTab, setActiveTab] = useState<"timeline" | "direct">("timeline");
const [directConnections, setDirectConnections] = useState<CommentDoc[]>([]);
const [selectedImage, setSelectedImage] = useState<File | null>(null);
const [selectedImagePreview, setSelectedImagePreview] = useState<string>("");
const [expandedReplies, setExpandedReplies] = useState<{
  [commentId: string]: boolean;
}>({});
const [replyingTo, setReplyingTo] = useState<string | null>(null);
```

**New Handler Functions:**

```typescript
handleImageSelect(); // File input handler
clearImageSelection(); // Remove selected image
handleAddComment(); // Enhanced with image upload
handleAddReply(commentId); // Add nested replies
handleDeleteComment(commentId); // Delete comments/replies
```

**New useEffect Hook:**

```typescript
// Separate timeline comments from direct connections
useEffect(() => {
  const timelineComments = allComments.filter((c) => !c.isDirectConnection);
  const directConnectionComments = allComments.filter(
    (c) => c.isDirectConnection,
  );
  setComments(timelineComments);
  setDirectConnections(directConnectionComments);
}, [selectedRevisionId]);
```

---

## 📊 Firestore Schema

### Comments Collection

**Document Structure:**

```json
{
  "projectId": "project123",
  "revisionId": "revision456",
  "userId": "user789",
  "userName": "John Doe",
  "userRole": "editor",
  "content": "Great work on the transitions!",
  "imageUrl": "gs://bucket/comments/project123/revision456/time_image.jpg",
  "timestamp": 35.5,
  "createdAt": 1710954600000,
  "isDirectConnection": false,
  "replies": [
    {
      "id": "reply_1710954700000",
      "userId": "client123",
      "userName": "Mary Smith",
      "userRole": "client",
      "content": "Thanks! Can we adjust the speed?",
      "imageUrl": null,
      "createdAt": 1710954700000
    }
  ]
}
```

**Indexes Required:**

```
Collection: comments
Index 1: projectId (Ascending), revisionId (Ascending)
Index 2: revisionId (Ascending), isDirectConnection (Ascending)
```

---

## 🎨 Styling & Interactions

### Image Preview

- Size: max-height 128px for comments
- Border: 1px border with theme colors
- Rounded corners: 6px
- Hover effect: None (static display)
- Remove button: X icon top-right corner

### Reply Section

- Indented by 8px from parent comment
- Border-top separator between main comment and replies
- Background color: Slight tint difference
- Font size: 10px for replies vs 12px for main

### Tab Navigation

- Two equal-width buttons
- Active tab: Primary color with text contrast
- Inactive tab: Muted background with hover state
- Smooth transition on click

### Action Buttons

- Delete: Only visible for comment author
- Reply: Visible when not already replying
- Dark destructive color: Red (#dc2626)
- Confirmation required before deletion

---

## 🔐 Security & Permissions

### Access Control

- **Delete Comments:** Only the comment author can delete their own comments
- **File Upload:** Authenticated users only, validated on server
- **File Storage:** Private path structure prevents unauthorized access

### File Validation

- Client-side: Size check (5MB max), type check
- Server-side: Re-validated during upload
- Storage path: Includes `projectId` and `revisionId` for isolation

---

## 🚀 Future Enhancements

Potential additions (if needed):

1. **Edit Comments** - Allow users to modify existing comments
2. **React with Emoji** - Add emoji reactions to comments
3. **@Mentions** - Tag specific users in replies
4. **Comment Search** - Find comments across all projects
5. **Bulk Download** - Export all project comments as PDF
6. **Notification System** - Alert users of new replies
7. **Video Annotations** - Draw highlights on video frames
8. **Comment Pinning** - Pin important feedback to top

---

## ✅ Testing Checklist

- [x] Comment submission with text only
- [x] Comment submission with image only
- [x] Comment submission with text + image
- [x] Image preview displays correctly
- [x] Remove image before submission
- [x] Reply to timeline comments
- [x] Reply to direct connections
- [x] Delete own comments
- [x] Timeline tab shows only timestamped comments
- [x] Direct tab shows only non-timestamped messages
- [x] Timestamp click seeks video to correct position
- [x] Tab switching preserves scroll position
- [x] All images upload to correct Firebase Storage path
- [x] Build passes TypeScript strict mode
- [x] All routes compile successfully

---

## 📝 Usage Examples

### Comment with Image (Client Feedback)

1. Timeline tab is active
2. Client watches video and pauses at 2:35
3. Sees timestamp shows as "2:35" in comment box
4. Types: "Please redo this transition"
5. Clicks Image button, selects screenshot.png
6. Clicks "Comment @2:35"
7. Image uploads, comment appears on timeline
8. Editor sees comment and reply button

### Direct Connection (Proposal)

1. Producer switches to Direct Connect tab
2. Types: "Love your work! Want to collaborate on my next project?"
3. Uploads portfolio image
4. Clicks "Send"
5. Message appears in Direct Connect section
6. Producer can now follow up on this project later

### Reply Thread (Feedback Loop)

1. Editor adds timeline comment: "Adjust color grading"
2. With color reference image
3. Client replies: "What about this?"
4. Attaches edited frame
5. Editor replies in thread: "Perfect!"
6. Full conversation preserved in nested thread

---

## 🎯 Video Timeline Reference

Comments are visually represented on the timeline:

- **Positions:** Calculated as `(timestamp / duration) * 100%`
- **Dots:** Primary colored dots show comment positions
- **Current Position:** Emerald line shows playback position
- **Click:** Clicking dots or timeline seeks video to that timestamp

---

## 💾 Data Storage

### Firebase Components

- **Realtime Database:** Live state for payment/feedback (existing)
- **Cloud Storage:** Comment images in `comments/{projectId}/{revisionId}/`
- **Firestore:** Comments collection with replies subdocuments

### Volume Estimates

- Image size: ~100KB-500KB per image (compressed)
- Comment metadata: ~200 bytes per reply
- Timeline indicator: ~20 bytes per comment position

---

## 🆘 Troubleshooting

| Issue                     | Solution                                                       |
| ------------------------- | -------------------------------------------------------------- |
| Image upload fails        | Check file size < 5MB, format is JPEG/PNG/WebP/GIF             |
| Comments not appearing    | Ensure Firestore rules allow read/write, check projectId match |
| Timeline dots not visible | Ensure `duration > 0`, video metadata loaded                   |
| Replies not showing       | Refresh page, check scroll position in comment area            |
| Delete button not visible | Verify `userId` matches comment author, check permissions      |

---

## 📞 Support

For issues or questions:

1. Check console for errors: `F12 → Console`
2. Verify Firestore rules in Firebase Console
3. Check Storage bucket permissions
4. Verify user authentication context

---

**Last Updated:** March 20, 2026  
**Version:** 2.0 (Threaded Comments & Direct Connections)  
**Status:** Production Ready ✅
