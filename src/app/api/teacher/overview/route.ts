import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  calls,
  categories,
  certificates,
  evaluations,
  messages,
  notifications,
  scenarios,
  settings as settingsTable,
  users,
} from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { publicCall } from "@/lib/call-serialize";
import { progressLevel } from "@/lib/progress";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const [students, allCalls, cats, allScenarios, allEvals, allCerts, msgs, notes, cfgRows] =
    await Promise.all([
      db.select().from(users).where(eq(users.role, "student")),
      db.select().from(calls).orderBy(desc(calls.startedAt)),
      db.select().from(categories),
      db.select().from(scenarios),
      db.select().from(evaluations).orderBy(desc(evaluations.updatedAt)),
      db.select().from(certificates),
      db.select().from(messages).orderBy(desc(messages.createdAt)),
      db.select().from(notifications).orderBy(desc(notifications.createdAt)),
      db.select().from(settingsTable).limit(1),
    ]);

  const cfg = cfgRows[0];
  const passing = cfg?.passingScore ?? 75;
  const completed = allCalls.filter((c) => c.status === "completed");
  const active = allCalls.filter((c) => c.status === "in_progress" || c.status === "ringing");
  const rated = completed.filter((c) => typeof c.overallRating === "number");
  const avgRating = rated.length
    ? Math.round(rated.reduce((a, c) => a + (c.overallRating ?? 0), 0) / rated.length)
    : 0;
  const supervisorAvg = completed.filter((c) => c.supervisor).length
    ? Math.round(
        completed.filter((c) => c.supervisor).reduce((a, c) => a + (c.supervisor?.rating ?? 0), 0) /
          completed.filter((c) => c.supervisor).length,
      )
    : 0;

  const studentStats = students.map((s) => {
    const mine = completed.filter((c) => c.studentId === s.id);
    const assigned = allScenarios.filter(
      (x) => x.isActive && (x.assignedStudentId === s.id || x.assignedStudentId === null),
    );
    const ratings = mine.map((c) => c.overallRating ?? 0);
    const average = ratings.length
      ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
      : 0;
    const progress = progressLevel({
      completed: mine.length,
      assigned: assigned.length,
      averageRating: average,
      passingScore: passing,
    });
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      email: s.email,
      agentId: s.agentId,
      totalCalls: mine.length,
      averageRating: average,
      completionRate: assigned.length ? Math.round((mine.length / assigned.length) * 100) : 0,
      progressLevel: progress.level,
      progressPercent: progress.percent,
      evaluations: allEvals.filter((e) => e.studentId === s.id).length,
      certificates: allCerts.filter((c) => c.studentId === s.id).length,
      lastActive: mine[0]?.startedAt ?? s.createdAt,
    };
  });

  const top = [...studentStats]
    .filter((s) => s.totalCalls > 0)
    .sort((a, b) => b.averageRating - a.averageRating || b.totalCalls - a.totalCalls)
    .slice(0, 5);

  const activities = [
    ...completed.slice(0, 8).map((c) => ({
      id: `call-${c.id}`,
      kind: "call" as const,
      title: `${c.callType} completed`,
      detail: `AI ${c.aiScores?.overall ?? "—"} · Supervisor ${c.supervisor?.rating ?? "—"}`,
      at: c.endedAt ?? c.startedAt,
      link: `/teacher/evaluations/${c.id}`,
    })),
    ...allEvals.slice(0, 5).map((e) => ({
      id: `eval-${e.id}`,
      kind: "evaluation" as const,
      title: `Teacher evaluation · ${e.overall}/100`,
      detail: e.feedback.slice(0, 80) || "Scored against 7 QA categories",
      at: e.updatedAt,
      link: "/teacher/evaluations",
    })),
    ...allCerts.slice(0, 4).map((c) => ({
      id: `cert-${c.id}`,
      kind: "certificate" as const,
      title: `Certificate released · ${c.title}`,
      detail: c.type,
      at: c.issuedAt,
      link: "/teacher/certificates",
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);

  return Response.json({
    config: cfg ?? null,
    stats: {
      totalStudents: students.length,
      activeSimulations: active.length,
      completedCalls: completed.length,
      averageStudentRating: avgRating,
      supervisorAverage: supervisorAvg,
      pendingEvaluations: completed.filter((c) => c.teacherRating == null).length,
      customers: allScenarios.length,
      activeCustomers: allScenarios.filter((s) => s.isActive).length,
      categories: cats.filter((c) => c.isActive).length,
      certificatesIssued: allCerts.length,
      announcements: 0,
      unreadMessages: msgs.filter((m) => m.toUserId === user.id && !m.readAt).length,
    },
    topStudents: top,
    students: studentStats,
    recentActivities: activities,
    recentCalls: completed.slice(0, 8).map((c) => publicCall(c)),
    queueMix: cats.map((c) => ({
      name: c.name,
      color: c.color,
      count: allScenarios.filter((s) => s.categoryId === c.id).length,
      handled: completed.filter((x) => x.callType === c.name).length,
    })),
    notices: notes.filter((n) => n.userId === user.id).slice(0, 8),
    announcementCount: (await db.select().from(announcements)).length,
  });
}
