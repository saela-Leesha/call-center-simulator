import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, categories, evaluations, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

function shift(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const [allCalls, allEvals, students, cats] = await Promise.all([
    db.select().from(calls).orderBy(desc(calls.startedAt)),
    db.select().from(evaluations).orderBy(desc(evaluations.updatedAt)),
    db.select().from(users).where(eq(users.role, "student")),
    db.select().from(categories),
  ]);

  const completed = allCalls.filter((c) => c.status === "completed");
  const rated = completed.filter((c) => typeof c.overallRating === "number");

  // Ratings + volume trend over the last 10 contacts (oldest -> newest).
  const series = [...completed]
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
    .slice(-10);
  const ratingsTrend = series.map((c) => ({
    label: new Date(c.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    overall: c.overallRating ?? c.aiScores?.overall ?? 0,
    teacher: c.teacherRating ?? 0,
    ai: c.aiScores?.overall ?? 0,
    supervisor: c.supervisor?.rating ?? 0,
    callId: c.id,
    callType: c.callType,
    studentId: c.studentId,
  }));

  // Completion trend grouped by day (last 7 days).
  const completionTrend: { label: string; completed: number; started: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = shift(i);
    const key = day.toDateString();
    completionTrend.push({
      label: day.toLocaleDateString("en-US", { weekday: "short" }),
      completed: completed.filter((c) => new Date(c.startedAt).toDateString() === key).length,
      started: allCalls.filter((c) => new Date(c.startedAt).toDateString() === key).length,
    });
  }

  // Skill improvement: average AI pillar score for the first half vs second half of history.
  const pillarKeys = ["communication", "authentication", "documentation", "sales", "compliance"] as const;
  const half = Math.max(1, Math.floor(series.length / 2));
  const avgPillar = (rows: typeof series) => {
    const withScores = rows.filter((r) => r.aiScores);
    if (!withScores.length) return 0;
    const out: Record<string, number> = {};
    for (const k of pillarKeys) {
      out[k] = Math.round(
        withScores.reduce((a, r) => a + (r.aiScores?.[k] ?? 0), 0) / withScores.length,
      );
    }
    return out;
  };
  const firstHalfPillars = avgPillar(series.slice(0, half));
  const secondHalfPillars = avgPillar(series.slice(-half));
  const skillTrend = pillarKeys.map((k) => ({
    skill: k,
    before: (firstHalfPillars as Record<string, number>)[k] ?? 0,
    after: (secondHalfPillars as Record<string, number>)[k] ?? 0,
  }));

  const volumeByQueue = cats.map((c) => ({
    name: c.name,
    color: c.color,
    scenarios: 0,
    handled: completed.filter((x) => x.callType === c.name).length,
  }));

  const ranking = students
    .map((s) => {
      const mine = completed.filter((c) => c.studentId === s.id);
      const r = mine.map((c) => c.overallRating ?? 0);
      return {
        id: s.id,
        name: `${s.firstName} ${s.lastName}`,
        agentId: s.agentId,
        totalCalls: mine.length,
        averageRating: r.length ? Math.round(r.reduce((a, b) => a + b, 0) / r.length) : 0,
        supervisorAverage: mine.filter((c) => c.supervisor).length
          ? Math.round(
              mine.filter((c) => c.supervisor).reduce((a, c) => a + (c.supervisor?.rating ?? 0), 0) /
                mine.filter((c) => c.supervisor).length,
            )
          : 0,
        evaluations: allEvals.filter((e) => e.studentId === s.id).length,
      };
    })
    .filter((s) => s.totalCalls > 0)
    .sort((a, b) => b.averageRating - a.averageRating || b.totalCalls - a.totalCalls);

  const failingAuth = completed.filter(
    (c) => c.supervisor && c.supervisor.missedAuthSteps.length > 0,
  );
  const failingDocs = completed.filter(
    (c) => c.supervisor && c.supervisor.missedDocumentation.length > 0,
  );

  return Response.json({
    summary: {
      totalCalls: allCalls.length,
      completed: completed.length,
      averageRating: rated.length
        ? Math.round(rated.reduce((a, c) => a + (c.overallRating ?? 0), 0) / rated.length)
        : 0,
      averageHandleTime: completed.length
        ? Math.round(completed.reduce((a, c) => a + c.durationSeconds, 0) / completed.length)
        : 0,
      evaluationsFiled: allEvals.length,
      averageEvaluation: allEvals.length
        ? Math.round(allEvals.reduce((a, e) => a + e.overall, 0) / allEvals.length)
        : 0,
      supervisorAverage: completed.filter((c) => c.supervisor).length
        ? Math.round(
            completed.filter((c) => c.supervisor).reduce((a, c) => a + (c.supervisor?.rating ?? 0), 0) /
              completed.filter((c) => c.supervisor).length,
          )
        : 0,
      authComplianceRate: completed.length
        ? Math.round(((completed.length - failingAuth.length) / completed.length) * 100)
        : 0,
      documentationRate: completed.length
        ? Math.round(((completed.length - failingDocs.length) / completed.length) * 100)
        : 0,
      transferred: completed.filter((c) => c.transferred).length,
      rejected: allCalls.filter((c) => c.status === "rejected").length,
    },
    ratingsTrend,
    completionTrend,
    skillTrend,
    volumeByQueue,
    ranking,
    supervisorFindings: completed
      .filter((c) => c.supervisor)
      .slice(0, 8)
      .map((c) => ({
        callId: c.id,
        callType: c.callType,
        rating: c.supervisor?.rating ?? 0,
        verdict: c.supervisor?.verdict ?? "",
        missedAuthSteps: c.supervisor?.missedAuthSteps ?? [],
        missedDocumentation: c.supervisor?.missedDocumentation ?? [],
        complianceFindings: c.supervisor?.complianceFindings ?? [],
        startedAt: c.startedAt,
      })),
    evaluations: allEvals.slice(0, 10),
  });
}
