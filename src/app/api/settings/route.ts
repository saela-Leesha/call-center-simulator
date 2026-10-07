import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scenarios, settings } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const [row] = await db.select().from(settings).limit(1);
  const base =
    row ?? {
      id: "global",
      ownerRole: "teacher",
      cohortName: "Nesting Wave 14",
      passingScore: 75,
      floorTarget: 85,
      maxPasswordAttempts: 3,
      allowTransfer: true,
      autoReleaseCertificates: false,
      aiStrictness: "balanced",
      requireRecording: true,
      ringTimeoutSeconds: 30,
      queueAutoDispatch: true,
      updatedAt: new Date(),
    };
  return Response.json({ settings: base });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as {
    cohortName?: string;
    passingScore?: number;
    floorTarget?: number;
    maxPasswordAttempts?: number;
    allowTransfer?: boolean;
    autoReleaseCertificates?: boolean;
    aiStrictness?: string;
    requireRecording?: boolean;
    ringTimeoutSeconds?: number;
    queueAutoDispatch?: boolean;
  };

  const [existing] = await db.select().from(settings).limit(1);
  const patch = {
    ownerRole: "teacher",
    cohortName: body.cohortName?.trim() || existing?.cohortName || "Nesting Wave 14",
    passingScore: Math.max(50, Math.min(100, Number(body.passingScore ?? existing?.passingScore ?? 75))),
    floorTarget: Math.max(50, Math.min(100, Number(body.floorTarget ?? existing?.floorTarget ?? 85))),
    maxPasswordAttempts: Math.max(1, Math.min(5, Number(body.maxPasswordAttempts ?? existing?.maxPasswordAttempts ?? 3))),
    allowTransfer: body.allowTransfer ?? existing?.allowTransfer ?? true,
    autoReleaseCertificates: body.autoReleaseCertificates ?? existing?.autoReleaseCertificates ?? false,
    aiStrictness: ["lenient", "balanced", "strict"].includes(body.aiStrictness || "")
      ? (body.aiStrictness as string)
      : existing?.aiStrictness ?? "balanced",
    requireRecording: body.requireRecording ?? existing?.requireRecording ?? true,
    ringTimeoutSeconds: Math.max(
      10,
      Math.min(120, Number(body.ringTimeoutSeconds ?? existing?.ringTimeoutSeconds ?? 30)),
    ),
    queueAutoDispatch: body.queueAutoDispatch ?? existing?.queueAutoDispatch ?? true,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(settings).set(patch).where(eq(settings.id, existing.id));
  } else {
    await db.insert(settings).values({ id: "global", ...patch });
  }

  // Transfer permission is pushed live into every active scenario so students see it instantly.
  if (typeof body.allowTransfer === "boolean") {
    const rows = await db.select({ id: scenarios.id }).from(scenarios);
    for (const r of rows) {
      await db.update(scenarios).set({ transferEnabled: patch.allowTransfer }).where(eq(scenarios.id, r.id));
    }
  }

  return Response.json({ settings: { id: existing?.id ?? "global", ...patch } });
}
