import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { achievements, calls, certificates, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const students = await db
    .select()
    .from(users)
    .where(eq(users.role, "student"))
    .orderBy(desc(users.createdAt));
  const allCalls = await db.select().from(calls);
  const allAch = await db.select().from(achievements);
  const allCerts = await db.select().from(certificates);

  return Response.json({
    students: students.map((s) => {
      const mine = allCalls.filter((c) => c.studentId === s.id && c.status === "completed");
      const ratings = mine
        .map((c) => c.overallRating)
        .filter((n): n is number => typeof n === "number");
      return {
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        phone: s.phone,
        agentId: s.agentId,
        department: s.department,
        bio: s.bio,
        createdAt: s.createdAt,
        callsHandled: mine.length,
        averageRating: ratings.length
          ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length)
          : 0,
        achievements: allAch.filter((a) => a.studentId === s.id).length,
        certificates: allCerts.filter((c) => c.studentId === s.id).length,
      };
    }),
  });
}
