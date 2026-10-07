import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  calls,
  categories,
  certificates,
  evaluations,
  scenarios,
  settings as settingsTable,
  users,
} from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { publicCall } from "@/lib/call-serialize";
import { progressLevel } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const { id } = await context.params;

  const [student] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!student) return jsonError("Student not found.", 404);

  const rows = await db
    .select({ call: calls, scenario: scenarios, category: categories })
    .from(calls)
    .innerJoin(scenarios, eq(calls.scenarioId, scenarios.id))
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .where(eq(calls.studentId, id))
    .orderBy(desc(calls.startedAt));

  const [evals, allScenarios, cfgRows, certs] = await Promise.all([
    db
      .select()
      .from(evaluations)
      .where(eq(evaluations.studentId, id))
      .orderBy(desc(evaluations.updatedAt)),
    db.select().from(scenarios),
    db.select().from(settingsTable).limit(1),
    db.select().from(certificates).where(eq(certificates.studentId, id)),
  ]);

  const cfg = cfgRows[0];
  const passing = cfg?.passingScore ?? 75;
  const completed = rows.filter((r) => r.call.status === "completed");
  const assigned = allScenarios.filter(
    (s) => s.isActive && (s.assignedStudentId === id || s.assignedStudentId === null),
  );
  const ratings = completed.map((r) => r.call.overallRating ?? 0);
  const average = ratings.length
    ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
    : 0;
  const progress = progressLevel({
    completed: completed.length,
    assigned: assigned.length,
    averageRating: average,
    passingScore: passing,
  });

  const byCategory = new Map<string, { total: number; count: number }>();
  for (const r of completed) {
    if (typeof r.call.overallRating !== "number") continue;
    const cur = byCategory.get(r.category.name) ?? { total: 0, count: 0 };
    byCategory.set(r.category.name, {
      total: cur.total + r.call.overallRating!,
      count: cur.count + 1,
    });
  }

  return Response.json({
    student: {
      id: student.id,
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone,
      bio: student.bio,
      agentId: student.agentId,
      department: student.department,
      createdAt: student.createdAt,
    },
    stats: {
      totalCalls: rows.length,
      completed: completed.length,
      rejected: rows.filter((r) => r.call.status === "rejected").length,
      transferred: rows.filter((r) => r.call.transferred).length,
      averageRating: average,
      completionRate: assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0,
      passRate: completed.length
        ? Math.round(
            (completed.filter((r) => (r.call.overallRating ?? 0) >= passing).length /
              completed.length) *
              100,
          )
        : 0,
      totalHandleTime: completed.reduce((a, r) => a + r.call.durationSeconds, 0),
      progressLevel: progress.level,
      progressPercent: progress.percent,
      recordings: completed.filter((r) => r.call.audioData).length,
      certificates: certs.length,
    },
    calls: rows.map((r) => ({
      ...publicCall(r.call),
      customerName: `${r.scenario.customerFirstName} ${r.scenario.customerLastName}`,
      accountNumber: r.scenario.accountNumber,
      categoryName: r.category.name,
      scenarioTitle: r.scenario.title,
      evaluationId: evals.find((e) => e.callId === r.call.id)?.id ?? null,
    })),
    evaluations: evals,
    assignedScenarios: assigned.map((s) => ({
      id: s.id,
      title: s.title,
      done: completed.some((r) => r.call.scenarioId === s.id),
    })),
    categoryAverages: [...byCategory.entries()].map(([name, v]) => ({
      name,
      average: Math.round(v.total / v.count),
      count: v.count,
    })),
    certificates: certs.map((c) => ({ id: c.id, title: c.title, type: c.type })),
    passingScore: passing,
  });
}
