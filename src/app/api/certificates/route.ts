import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { certificates, notifications, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const rows = await db.select().from(certificates).orderBy(desc(certificates.issuedAt));
  const people = await db.select().from(users);
  const map = new Map(people.map((p) => [p.id, p]));

  const filtered =
    user.role === "teacher" ? rows : rows.filter((c) => c.studentId === user.id);

  return Response.json({
    certificates: filtered.map((c) => {
      const student = map.get(c.studentId);
      const teacher = c.issuedBy ? map.get(c.issuedBy) : null;
      return {
        ...c,
        fileData: undefined,
        hasFile: Boolean(c.fileData),
        studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
        studentAgentId: student?.agentId ?? "",
        issuerName: teacher ? `${teacher.firstName} ${teacher.lastName}` : "AetherLink Academy",
      };
    }),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as {
    studentId?: string;
    title?: string;
    type?: string;
    description?: string;
    fileName?: string;
    fileMime?: string;
    fileData?: string;
  };
  if (!body.studentId || !body.title?.trim() || !body.description?.trim()) {
    return jsonError("Student, title, and description are required.");
  }
  const type = ["training", "completion", "achievement"].includes(body.type || "")
    ? (body.type as string)
    : "training";

  const row = {
    id: newId(),
    studentId: body.studentId,
    issuedBy: user.id,
    title: body.title.trim(),
    type,
    description: body.description.trim(),
    fileName: body.fileName || null,
    fileMime: body.fileMime || null,
    fileData: body.fileData || null,
    issuedAt: new Date(),
  };
  await db.insert(certificates).values(row);
  await db.insert(notifications).values({
    id: newId(),
    userId: body.studentId,
    title: "Certificate issued",
    body: `${row.title} has been added to your training transcript.`,
    type: "certificate",
    link: "/student/certificates",
    read: false,
    createdAt: new Date(),
  });
  return Response.json({ certificate: { ...row, fileData: undefined, hasFile: Boolean(row.fileData) } });
}
