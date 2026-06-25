
# EditHub Implementation Plan & TODOs

## 🚀 Current Progress
- **Infrastructure**: Next.js 15, Tailwind v4, Firebase Configured.
- **Authentication**: Auth Context, Protected Routes, Login Page (Google/Email UI).
- **Core Feature**: Video Review Interface (Player, Timestamped Comments, Threads).
- **Dashboard**: Layout, Sidebar, Overview Page.

## 📝 TODO List for Production

### 1. Database & Backend
- [ ] **Data Seeding**: Create a script to seed initial Projects and Users in Firestore if using the emulator.
- [x] **Security Rules**: Implement `firestore.rules` to strictly enforce Role-Based Access Control (RBAC).
    - Only `admin`/`manager` can create projects.
    - `clients` can only view assigned projects.
- [x] **Storage Rules**: Restrict video uploads to authenticated users.

### 2. Video Review Polish
- [x] **Real-time Sync**: Hook up `onSnapshot` in `ReviewPage` to listen for new comments in real-time.
- [ ] **Canvas Drawing**: Add ability to draw on the video frame using HTML5 Canvas overlay (Frame.io feature).
- [x] **Optimistic UI**: instantly update UI while waiting for Firestore write.

### 3. File Uploads
- [x] Implement `upload` page using `firebase/storage`.
- [x] Add Resumable Uploads for large video files.
- [ ] integrate a Transcoding service (FFmpeg on Cloud Run or similar) if raw formats are uploaded.

### 4. Client & Guest Access
- [ ] Implement `GuestIdentityModal` properly to capture guest name before allowing them to view/comment if public link is used.
- [ ] Create simple "Share Link" generator that creates a unique permission token.

### 5. Admin Features
- [ ] Create User Management table.
- [ ] Implement Audit Logs viewer.

### 6. Deployment
- [ ] Set up Vercel Envrionment Variables.
- [ ] Deploy Cloud Functions (`firebase deploy --only functions`).
