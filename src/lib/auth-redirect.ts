"use client";

const POST_LOGIN_REDIRECT_KEY = "editohub:post-login-redirect";
const POST_LOGIN_REDIRECT_TTL_MS = 24 * 60 * 60 * 1000;

type StoredRedirect = {
    path: string;
    expiresAt: number;
};

function isClient() {
    return typeof window !== "undefined";
}

function isSafeRelativePath(path: string) {
    return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/login") && !path.startsWith("/signup");
}

export function rememberPostLoginRedirect(path?: string | null) {
    if (!isClient() || !path || !isSafeRelativePath(path)) return;

    const payload: StoredRedirect = {
        path,
        expiresAt: Date.now() + POST_LOGIN_REDIRECT_TTL_MS,
    };

    window.localStorage.setItem(POST_LOGIN_REDIRECT_KEY, JSON.stringify(payload));
}

export function consumePostLoginRedirect(fallback = "/dashboard") {
    if (!isClient()) return fallback;

    const raw = window.localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    if (!raw) return fallback;

    window.localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);

    try {
        const parsed = JSON.parse(raw) as StoredRedirect;
        if (!parsed?.path || !isSafeRelativePath(parsed.path)) return fallback;
        if (!parsed.expiresAt || parsed.expiresAt < Date.now()) return fallback;
        return parsed.path;
    } catch {
        return fallback;
    }
}
