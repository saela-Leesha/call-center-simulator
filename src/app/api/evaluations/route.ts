import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, evaluations, scenarios, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId, nowIso } from "@/lib/utils";
import { starsToScore } from "@/lib/progress";
import type { EvaluationScores } from "@/db/schema";

export const dynamic = "force-dynamic";

const KEYS = [
  "authentication",
  "communication",
  "resolution",
  "documentation",
  "professionalism",
  "productKnowledge",
  "compliance",
] as const;

function readScores(raw: Record<string, unknown>): EvaluationScores {
  const out = {} as EvaluationScores;
  for (const k of KEYS) {
    const stars = Number(raw[k] ?? 3);
    out[k] = Math.max(1, Math.min(5, Math.round(stars)));
  }
  return out;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const url = new URL(request.url);
  const callId = url.searchParams.get("callId");
  const studentId = url.searchParams.get("studentId");

  let rows = await db.select().from(evaluations).orderBy(desc(evaluations.updatedAt));
  if (callId) rows = rows.filter((r) => r.callId === callId);
  if (studentId && user.role === "student") rows = rows.filter((r) => r.studentId === user.id);
  else if (studentId) rows = rows.filter((r) => r.studentId === studentId);

  if (user.role === "student") rows = rows.filter((r) => r.released);

  return Response.json({ evaluations: rows });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as {
    callId?: string;
    scores?: Record<string, number>;
    feedback?: string;
    coachingNotes?: string;
    improvementPlan?: string;
    recognition?: string;
    released?: boolean;
  };
  if (!body.callId) return jsonError("callId is required.");

  const [call] = await db.select().from(calls).where(eq(calls.id, body.callId)).limit(1);
  if (!call) return jsonError("Call not found.", 404);

  const scores = readScores((body.scores ?? {}) as Record<string, unknown>);
  const values = KEYS.map((k) => scores[k]);
  const overall = Math.round(
    values.reduce((a, b) => a + starsToScore(b), 0) / values.length,
  );

  const [existing] = await db
    .select()
    .from(evaluations)
    .where(eq(evaluations.callId, body.callId))
    .limit(1);

  const payload = {
    scores,
    overall,
    feedback: body.feedback?.trim() || "",
    coachingNotes: body.coachingNotes?.trim() || "",
    improvementPlan: body.improvementPlan?.trim() || "",
    recognition: body.recognition?.trim() || "",
    released: body.released ?? true,
    updatedAt: new Date(),
  };

  let evaluationId: string;
  if (existing) {
    evaluationId = existing.id;
    await db.update(evaluations).set(payload).where(eq(evaluations.id, existing.id));
  } else {
    evaluationId = newId();
    await db.insert(evaluations).values({
      id: evaluationId,
      callId: body.callId,
      studentId: call.studentId,
      teacherId: user.id,
      ...payload,
      createdAt: new Date(),
    });
  }

  // Overall score is written back to the student's call record.
  await db
    .update(calls)
    .set({
      teacherRating: overall,
      teacherComments: payload.feedback || payload.coachingNotes || call.teacherComments,
      overallRating: call.aiScores
        ? Math.round(call.aiScores.overall * 0.45 + overall * 0.55)
        : overall,
    })
    .where(eq(calls.id, body.callId));

  const [student] = await db.select().from(users).where(eq(users.id, call.studentId)).limit(1);

  return Response.json({
    evaluation: { id: evaluationId, ...payload },
    student: student ? { id: student.id, name: `${student.firstName} ${student.lastName}` } : null,
    savedAt: nowIso(),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const body = (await request.json()) as { id?: string; released?: boolean };
  if (!body.id) return jsonError("id is required.");
  await db
    .update(evaluations)
    .set({ released: body.released ?? true, updatedAt: new Date() })
    .where(eq(evaluations.id, body.id));
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") return jsonError("Teachers only.", 403);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("id is required.");
  await db.delete(evaluations).where(eq(evaluations.id, id));
  return Response.json({ ok: true });
}

/** Keep tree-shaking honest about unused joins in cold starts. */
export async function HEAD() {
  await db.select({ id: scenarios.id }).from(scenarios).limit(1);
  return new Response(null, { status: 204 });
}
