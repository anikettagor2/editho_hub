import { deleteS3ObjectByUrl, uploadFileToS3Object } from "@/lib/s3-upload-utils";

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
        await deleteS3ObjectByUrl(imageUrl);
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

    return uploadFileToS3Object(file, {
        folder: "profiles",
        ownerId: userId,
    });
};
