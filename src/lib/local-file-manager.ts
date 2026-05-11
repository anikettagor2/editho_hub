
/**
 * A simple global registry to store raw File objects in memory.
 * This allows "Local Buffer Downloads" without re-fetching from S3/Mux.
 * Note: This registry is cleared on page refresh.
 */

class LocalFileManager {
    private files: Map<string, File> = new Map();

    /**
     * Stores a file in the registry.
     * @param id The ID (e.g., revisionId or assetId) to associate with the file.
     * @param file The raw File object.
     */
    registerFile(id: string, file: File) {
        if (!id || !file) return;
        this.files.set(id, file);
        console.log(`[LocalFileManager] Registered file for ID: ${id} (${file.name}, ${file.size} bytes)`);
    }

    /**
     * Retrieves a file from the registry.
     * @param id The ID to look up.
     */
    getFile(id: string): File | undefined {
        return this.files.get(id);
    }

    /**
     * Checks if a file exists in the registry.
     * @param id The ID to check.
     */
    hasFile(id: string): boolean {
        return this.files.has(id);
    }

    /**
     * Clears a specific file from the registry to free up memory.
     * @param id The ID to clear.
     */
    clearFile(id: string) {
        this.files.delete(id);
    }

    /**
     * Returns all registered IDs.
     */
    getAllIds(): string[] {
        return Array.from(this.files.keys());
    }
}

// Export a singleton instance
export const localFileManager = new LocalFileManager();
