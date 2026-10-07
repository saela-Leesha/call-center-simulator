import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  calls,
  categories,
  certificates,
  messages,
  notifications,
  scenarios,
  users,
} from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { publicCall } from "@/lib/call-serialize";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  if (user.role === "student") {
    const studentCalls = await db
      .select()
      .from(calls)
      .where(eq(calls.studentId, user.id))
      .orderBy(desc(calls.startedAt));

    const completed = studentCalls.filter((c) => c.status === "completed");
    const ratings = completed
      .map((c) => c.overallRating)
      .filter((n): n is number => typeof n === "number");
    const averageRating =
      ratings.length > 0
        ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
        : 0;

    const assigned = await db
      .select()
      .from(scenarios)
      .where(
        and(
          eq(scenarios.isActive, true),
          or(eq(scenarios.assignedStudentId, user.id), isNull(scenarios.assignedStudentId)),
        ),
      );

    const completedScenarioIds = new Set(completed.map((c) => c.scenarioId));
    const pending = assigned.filter((s) => !completedScenarioIds.has(s.id));

    const earned = await db
      .select()
      .from(achievements)
      .where(eq(achievements.studentId, user.id))
      .orderBy(desc(achievements.earnedAt));

    const unread = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));

    const recent = studentCalls.slice(0, 5);
    const cats = await db.select().from(categories);

    return Response.json({
      role: "student",
      stats: {
        totalCalls: completed.length,
        averageRating,
        completedSimulations: completed.length,
        pendingSimulations: pending.length,
        achievementsEarned: earned.length,
        unreadNotifications: unread.length,
      },
      recentCalls: recent.map((c) => publicCall(c)),
      pendingScenarios: pending.slice(0, 6),
      achievements: earned,
      categories: cats,
    });
  }

  const allStudents = await db.select().from(users).where(eq(users.role, "student"));
  const allCalls = await db.select().from(calls).orderBy(desc(calls.startedAt));
  const pendingReviews = allCalls.filter(
    (c) => c.status === "completed" && c.teacherRating == null,
  );
  const cats = await db.select().from(categories);
  const allScenarios = await db.select().from(scenarios);
  const unread = await db
    .select()
    .from(messages)
    .where(and(eq(messages.toUserId, user.id), isNull(messages.readAt)));
  const certs = await db.select().from(certificates);

  return Response.json({
    role: "teacher",
    stats: {
      students: allStudents.length,
      totalCalls: allCalls.filter((c) => c.status === "completed").length,
      pendingReviews: pendingReviews.length,
      categories: cats.filter((c) => c.isActive).length,
      scenarios: allScenarios.filter((s) => s.isActive).length,
      unreadMessages: unread.length,
      certificatesIssued: certs.length,
    },
    pendingReviews: pendingReviews.slice(0, 8).map((c) => publicCall(c)),
    recentCalls: allCalls.slice(0, 8).map((c) => publicCall(c)),
    students: allStudents.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      email: s.email,
      agentId: s.agentId,
      department: s.department,
    })),
    categories: cats,
  });
}
