import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

const TARGET_ROLES = new Set(["admin", "project_manager", "editor", "client"]);

type DashboardPopupDocument = {
  targetRoles?: unknown;
  startAt?: number | null;
  endAt?: number | null;
  createdAt?: number;
};

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

async function getRequestUser(req: Request) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;

  const decoded = await adminAuth.verifyIdToken(token);
  const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
  const userData = userSnap.exists ? userSnap.data() : {};

  return {
    uid: decoded.uid,
    role: userData?.role || decoded.role,
    displayName: userData?.displayName || decoded.name || "User",
  };
}

function sanitizeTargetRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role) => typeof role === "string" && TARGET_ROLES.has(role));
}

function normalizeOptionalTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const timestamp = Number(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function GET(req: Request) {
  try {
    const requestUser = await getRequestUser(req);
    if (!requestUser) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const now = Date.now();

    if (requestUser.role === "developer") {
      const snap = await adminDb
        .collection("dashboardPopups")
        .orderBy("createdAt", "desc")
        .get();

      return NextResponse.json({
        success: true,
        popups: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      });
    }

    if (!TARGET_ROLES.has(requestUser.role)) {
      return NextResponse.json({ success: true, popups: [] });
    }

    const snap = await adminDb
      .collection("dashboardPopups")
      .where("active", "==", true)
      .get();

    const popups = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as DashboardPopupDocument & { id: string }))
      .filter((popup) => Array.isArray(popup.targetRoles) && popup.targetRoles.includes(requestUser.role))
      .filter((popup) => (!popup.startAt || popup.startAt <= now) && (!popup.endAt || popup.endAt >= now))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    return NextResponse.json({ success: true, popups });
  } catch (error: unknown) {
    console.error("[dashboard-popups] GET failed:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error, "Failed to load popups") }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const requestUser = await getRequestUser(req);
    if (!requestUser || requestUser.role !== "developer") {
      return NextResponse.json({ success: false, error: "Developer access required" }, { status: 403 });
    }

    const body = await req.json();
    const title = String(body?.title || "").trim();
    const message = String(body?.message || "").trim();
    const targetRoles = sanitizeTargetRoles(body?.targetRoles);
    const startAt = normalizeOptionalTimestamp(body?.startAt);
    const endAt = normalizeOptionalTimestamp(body?.endAt);

    if (!title || !message) {
      return NextResponse.json({ success: false, error: "Title and message are required" }, { status: 400 });
    }

    if (targetRoles.length === 0) {
      return NextResponse.json({ success: false, error: "Select at least one target user type" }, { status: 400 });
    }

    if (startAt && endAt && endAt < startAt) {
      return NextResponse.json({ success: false, error: "End date must be after start date" }, { status: 400 });
    }

    const now = Date.now();
    const popupRef = await adminDb.collection("dashboardPopups").add({
      title,
      message,
      targetRoles,
      active: body?.active === true,
      startAt,
      endAt,
      createdAt: now,
      updatedAt: now,
      createdBy: requestUser.uid,
      createdByName: requestUser.displayName || "Developer",
    });

    return NextResponse.json({ success: true, id: popupRef.id });
  } catch (error: unknown) {
    console.error("[dashboard-popups] POST failed:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error, "Failed to create popup") }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const requestUser = await getRequestUser(req);
    if (!requestUser || requestUser.role !== "developer") {
      return NextResponse.json({ success: false, error: "Developer access required" }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ success: false, error: "Popup id is required" }, { status: 400 });
    }

    await adminDb.collection("dashboardPopups").doc(id).update({
      active: body?.active === true,
      updatedAt: Date.now(),
      updatedBy: requestUser.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[dashboard-popups] PATCH failed:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error, "Failed to update popup") }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const requestUser = await getRequestUser(req);
    if (!requestUser || requestUser.role !== "developer") {
      return NextResponse.json({ success: false, error: "Developer access required" }, { status: 403 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ success: false, error: "Popup id is required" }, { status: 400 });
    }

    await adminDb.collection("dashboardPopups").doc(id).delete();

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[dashboard-popups] DELETE failed:", error);
    return NextResponse.json({ success: false, error: getErrorMessage(error, "Failed to delete popup") }, { status: 500 });
  }
}
