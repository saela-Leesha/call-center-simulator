import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  calls,
  categories,
  notifications,
  products,
  scenarios,
  settings as settingsTable,
  users,
  type CallNotes,
  type PaymentRecord,
  type SoldProduct,
  type TranscriptLine,
} from "@/db/schema";
import { evaluateCall, grantAchievements } from "@/lib/ai-coach";
import { runSupervisor } from "@/lib/ai-supervisor";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { publicCall } from "@/lib/call-serialize";
import { newId, overallFromScores } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadCall(id: string) {
  const [row] = await db
    .select({
      call: calls,
      scenario: scenarios,
      category: categories,
      student: users,
    })
    .from(calls)
    .innerJoin(scenarios, eq(calls.scenarioId, scenarios.id))
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .innerJoin(users, eq(calls.studentId, users.id))
    .where(eq(calls.id, id))
    .limit(1);
  return row ?? null;
}

function sanitizeScenario(
  scenario: typeof scenarios.$inferSelect,
  role: string,
) {
  if (role === "teacher") return scenario;
  const { accountPassword: _p, securityAnswer: _s, ...rest } = scenario;
  return rest;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const row = await loadCall(id);
  if (!row) return jsonError("Call not found.", 404);
  if (user.role === "student" && row.call.studentId !== user.id) {
    return jsonError("Forbidden.", 403);
  }
  const catalog = await db.select().from(products);
  return Response.json({
    call: row.call,
    scenario: sanitizeScenario(row.scenario, user.role),
    category: row.category,
    student: {
      id: row.student.id,
      firstName: row.student.firstName,
      lastName: row.student.lastName,
      agentId: row.student.agentId,
    },
    products: catalog,
    securityQuestion: row.scenario.securityQuestion,
    transferEnabled: row.scenario.transferEnabled,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const row = await loadCall(id);
  if (!row) return jsonError("Call not found.", 404);

  const body = (await request.json()) as {
    action?: string;
    notes?: CallNotes;
    productsSold?: SoldProduct[];
    payment?: PaymentRecord | null;
    termsAgreed?: boolean;
    durationSeconds?: number;
    transcript?: TranscriptLine[];
    teacherRating?: number;
    teacherComments?: string;
    callState?: string;
    transferred?: boolean;
    transferTarget?: string;
    hasRecording?: boolean;
  };

  if (body.action === "teacher_review") {
    if (user.role !== "teacher") return jsonError("Teachers only.", 403);
    const teacherRating = Math.max(0, Math.min(100, Number(body.teacherRating || 0)));
    const overall = overallFromScores(row.call.aiScores?.overall ?? null, teacherRating);
    await db
      .update(calls)
      .set({
        teacherRating,
        teacherComments: body.teacherComments?.trim() || "",
        overallRating: overall,
      })
      .where(eq(calls.id, id));

    await db.insert(notifications).values({
      id: newId(),
      userId: row.call.studentId,
      title: "Teacher rating posted",
      body: `${user.firstName} ${user.lastName} scored your ${row.category.name} call ${teacherRating}/100.`,
      type: "rating",
      link: `/student/history/${id}`,
      read: false,
      createdAt: new Date(),
    });

    const updated = await loadCall(id);
    return Response.json({ call: updated ? publicCall(updated.call) : null });
  }

  if (user.role !== "student" || row.call.studentId !== user.id) {
    return jsonError("Forbidden.", 403);
  }

  const notes = body.notes ?? row.call.notes;
  const productsSold = body.productsSold ?? row.call.productsSold;
  const payment = body.payment === undefined ? row.call.payment : body.payment;
  const termsAgreed = body.termsAgreed ?? row.call.termsAgreed;
  const durationSeconds = body.durationSeconds ?? row.call.durationSeconds;
  const transcript = body.transcript ?? row.call.transcript;

  if (body.action === "complete") {
    if (!row.call.authSuccess) {
      return jsonError("Authenticate the customer before completing the call.");
    }
    const evalResult = evaluateCall({
      authSuccess: row.call.authSuccess,
      authMethod: row.call.authMethod,
      passwordAttempts: row.call.passwordAttempts,
      securityAttempts: row.call.securityAttempts,
      notes,
      products: productsSold,
      payment,
      termsAgreed,
      durationSeconds,
      categoryName: row.category.name,
      concern: row.scenario.concern,
    });

    const agentTurns = (transcript ?? []).filter((l) => l.speaker === "agent");
    const settingsRow = await db.select().from(settingsTable).limit(1);
    const strictness = (settingsRow[0]?.aiStrictness ?? "balanced") as
      | "lenient"
      | "balanced"
      | "strict";
    const supervisorReport = runSupervisor({
      transcript,
      notes,
      authSuccess: row.call.authSuccess,
      authMethod: row.call.authMethod,
      passwordAttempts: row.call.passwordAttempts,
      securityAttempts: row.call.securityAttempts,
      termsAgreed: termsAgreed ?? false,
      paymentPosted: Boolean(payment),
      productsOffered: (productsSold ?? []).filter((p) => p.action === "offered").length,
      productsSold: (productsSold ?? []).filter((p) => p.action === "sold").length,
      durationSeconds,
      recorded: body.hasRecording ?? Boolean(row.call.audioData),
      transferred: row.call.transferred,
      strictness,
    });
    const communicationBlend = Math.min(100, 46 + agentTurns.length * 5);

    const overall = overallFromScores(evalResult.scores.overall, row.call.teacherRating);

    await db
      .update(calls)
      .set({
        status: "completed",
        endedAt: new Date(),
        durationSeconds,
        notes,
        productsSold,
        payment,
        termsAgreed,
        transcript,
        aiScores: { ...evalResult.scores, communication: communicationBlend },
        aiCoaching: evalResult.coaching,
        supervisor: supervisorReport,
        overallRating: overall,
        callState: "ended",
      })
      .where(eq(calls.id, id));

    const completed = await db
      .select()
      .from(calls)
      .where(and(eq(calls.studentId, user.id), eq(calls.status, "completed")));
    const badges = grantAchievements({
      completedCount: completed.length,
      scores: evalResult.scores,
      authMethod: row.call.authMethod,
      soldCount: (productsSold ?? []).filter((p) => p.action === "sold").length,
      termsAgreed,
    });
    const already = await db
      .select()
      .from(achievements)
      .where(eq(achievements.studentId, user.id));
    const have = new Set(already.map((a) => a.code));
    for (const badge of badges) {
      if (have.has(badge.code)) continue;
      await db.insert(achievements).values({
        id: newId(),
        studentId: user.id,
        code: badge.code,
        title: badge.title,
        description: badge.description,
        earnedAt: new Date(),
      });
    }

    const teachers = await db.select().from(users).where(eq(users.role, "teacher"));
    for (const teacher of teachers) {
      await db.insert(notifications).values({
        id: newId(),
        userId: teacher.id,
        title: "Simulation completed",
        body: `${user.firstName} ${user.lastName} completed a ${row.category.name} call · AI ${evalResult.scores.overall} · Supervisor ${supervisorReport.rating} (${supervisorReport.verdict})`,
        type: "review",
        link: `/teacher/evaluations/${id}`,
        read: false,
        createdAt: new Date(),
      });
    }

    const updated = await loadCall(id);
    return Response.json({
      call: updated ? publicCall(updated.call) : null,
      coaching: evalResult.coaching,
      scores: evalResult.scores,
    });
  }

  if (body.action === "missed") {
    const ringSeconds = body.durationSeconds ?? row.call.durationSeconds;
    await db
      .update(calls)
      .set({
        status: "missed",
        endedAt: new Date(),
        durationSeconds: ringSeconds,
        callState: "missed",
        transcript: [
          ...(row.call.transcript ?? []),
          {
            at: "—",
            speaker: "system",
            text: `Ring timeout after ${ringSeconds}s — customer abandoned the queue. Logged as a missed call.`,
          },
        ],
      })
      .where(eq(calls.id, id));
    const missedRow = await loadCall(id);
    return Response.json({ call: missedRow ? publicCall(missedRow.call) : null });
  }

  if (body.action === "abandon" || body.action === "reject" || body.action === "transfer") {
    const status =
      body.action === "reject" ? "rejected" : body.action === "transfer" ? "transferred" : "abandoned";
    const finalTranscript: TranscriptLine[] = body.action === "transfer"
      ? [
          ...(transcript ?? []),
          {
            at: "—",
            speaker: "system",
            text: `Warm-transferred to ${body.transferTarget || "Tier 2 · Fiber Support"} with full case notes.`,
          },
        ]
      : (transcript ?? []);
    await db
      .update(calls)
      .set({
        status,
        endedAt: new Date(),
        callState: status,
        durationSeconds,
        transferred: body.action === "transfer" ? true : row.call.transferred,
        transferTarget:
          body.action === "transfer"
            ? body.transferTarget || "Tier 2 · Fiber Support"
            : row.call.transferTarget,
        transcript: finalTranscript,
        notes,
        productsSold,
        payment,
        termsAgreed,
      })
      .where(eq(calls.id, id));
    const updated = await loadCall(id);
    return Response.json({ call: updated ? publicCall(updated.call) : null });
  }

  await db
    .update(calls)
    .set({
      notes,
      productsSold,
      payment,
      termsAgreed,
      durationSeconds,
      transcript,
    })
    .where(eq(calls.id, id));
  const updated = await loadCall(id);
  return Response.json({ call: updated ? publicCall(updated.call) : null });
}
