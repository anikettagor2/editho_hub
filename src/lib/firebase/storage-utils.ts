import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./config";

export const uploadCommentAttachment = async (file: File, projectId: string, revisionId: string): Promise<string> => {
    if (!file) throw new Error("No file provided");

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
        throw new Error("File size must be less than 20MB");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);
    formData.append("revisionId", revisionId);

    const response = await fetch("/api/comments/attachments", {
        method: "POST",
        body: formData,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success || !result?.url) {
        throw new Error(result?.error || "Failed to upload comment attachment");
    }

    return result.url;
};

export const uploadCommentImage = async (file: File, projectId: string, revisionId: string): Promise<string> => {
    if (!file) throw new Error("No file provided");

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw new Error("File size must be less than 5MB");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPEG, PNG, WebP, and GIF images are allowed");
    }

    return uploadCommentAttachment(file, projectId, revisionId);
};

export const deleteCommentImage = async (imageUrl: string): Promise<void> => {
    try {
        const fileRef = ref(storage, imageUrl);
        await deleteObject(fileRef);
    } catch (error) {
        console.error("Failed to delete image:", error);
    }
};

export const uploadProfileImage = async (file: File, userId: string): Promise<string> => {
    if (!file) throw new Error("No file provided");

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        throw new Error("File size must be less than 5MB");
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
        throw new Error("Only JPEG, PNG, and WebP images are allowed");
    }

    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storageRef = ref(storage, `profiles/${userId}/${fileName}`);

    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);

    return downloadUrl;
};
