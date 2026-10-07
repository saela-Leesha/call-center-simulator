import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings as settingsTable,
  users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { ensureTeacherSeed } from "@/db/seed";

export const dynamic = "force-dynamic";

const STATUSES = ["available", "busy", "break", "offline"] as const;
type Status = (typeof STATUSES)[number];

const LABEL: Record<Status, string> = {
  available: "Available",
  busy: "Busy",
  break: "Break",
  offline: "Offline",
};

/** Returns the caller's softphone status plus the floor ring/queue configuration. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const [row] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  const [cfg] = await db.select().from(settingsTable).limit(1);
  const status = STATUSES.includes(row?.agentStatus as Status)
    ? (row?.agentStatus as Status)
    : "offline";

  return Response.json({
    status,
    label: LABEL[status],
    statuses: STATUSES.map((s) => ({ value: s, label: LABEL[s] })),
    ringTimeoutSeconds: cfg?.ringTimeoutSeconds ?? 30,
    queueAutoDispatch: cfg?.queueAutoDispatch ?? true,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as { status?: string };
  if (!body.status || !STATUSES.includes(body.status as Status)) {
    return jsonError("Invalid status.");
  }
  await db
    .update(users)
    .set({ agentStatus: body.status })
    .where(eq(users.id, user.id));
  return Response.json({ status: body.status, label: LABEL[body.status as Status] });
}

/** Ensures the settings row exists for freshly registered accounts. */
export async function HEAD() {
  await ensureTeacherSeed();
  return new Response(null, { status: 204 });
}
