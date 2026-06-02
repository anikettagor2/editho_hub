export async function uploadFileToS3Object(file: File | Blob, options: {
  folder: string;
  ownerId: string;
  fileName?: string;
}): Promise<string> {
  const uploadFile = file instanceof File
    ? file
    : new File([file], options.fileName || "upload", { type: file.type || "application/octet-stream" });

  const formData = new FormData();
  formData.append("file", uploadFile);
  formData.append("folder", options.folder);
  formData.append("ownerId", options.ownerId);

  const response = await fetch("/api/upload/s3/object", {
    method: "POST",
    body: formData,
  });

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || !result?.url) {
    throw new Error(result?.error || "Failed to upload file to S3");
  }

  return result.url;
}

export async function deleteS3ObjectByUrl(url: string): Promise<void> {
  if (!url) return;

  const response = await fetch("/api/storage/s3", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "Failed to delete S3 file");
  }
}
