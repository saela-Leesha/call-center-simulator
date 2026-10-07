import { eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const [row] = await db.select().from(certificates).where(eq(certificates.id, id)).limit(1);
  if (!row) return jsonError("Certificate not found.", 404);
  if (user.role === "student" && row.studentId !== user.id) {
    return jsonError("Forbidden.", 403);
  }
  const people = await db.select().from(users);
  const student = people.find((p) => p.id === row.studentId);
  const teacher = people.find((p) => p.id === row.issuedBy);
  return Response.json({
    certificate: {
      ...row,
      studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
      studentAgentId: student?.agentId ?? "",
      issuerName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "AetherLink Academy",
    },
  });
}
