import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { calls, categories, scenarios, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { publicCall } from "@/lib/call-serialize";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const rows = await db
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
    .orderBy(desc(calls.startedAt));

  const filtered = user.role === "teacher" ? rows : rows.filter((r) => r.call.studentId === user.id);

  return Response.json({
    calls: filtered.map((r) => ({
      ...publicCall(r.call),
      customerName: `${r.scenario.customerFirstName} ${r.scenario.customerLastName}`,
      customerEmail: r.scenario.email,
      customerMobile: r.scenario.mobile,
      customerAddress: r.scenario.address,
      accountNumber: r.scenario.accountNumber,
      categoryName: r.category.name,
      scenarioTitle: r.scenario.title,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      studentAgentId: r.student.agentId,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "student") return jsonError("Students start simulations.", 403);

  const body = (await request.json()) as { scenarioId?: string };
  if (!body.scenarioId) return jsonError("scenarioId is required.");

  const [scenario] = await db
    .select({ scenario: scenarios, category: categories })
    .from(scenarios)
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .where(eq(scenarios.id, body.scenarioId))
    .limit(1);
  if (!scenario) return jsonError("Scenario not found.", 404);

  const existing = await db.select().from(calls).where(eq(calls.studentId, user.id));
  const open = existing.find(
    (c) =>
      c.scenarioId === body.scenarioId && (c.status === "in_progress" || c.status === "ringing"),
  );
  if (open) {
    return Response.json({ call: publicCall(open) });
  }

  const row = {
    id: newId(),
    studentId: user.id,
    scenarioId: scenario.scenario.id,
    status: "ringing",
    callState: "ringing",
    startedAt: new Date(),
    endedAt: null,
    durationSeconds: 0,
    callType: scenario.category.name,
    passwordAttempts: 0,
    securityAttempts: 0,
    authMethod: null,
    authSuccess: false,
    passwordLocked: false,
    notes: {
      concern: scenario.scenario.concern,
      troubleshooting: "",
      resolution: "",
      followUp: "",
      escalation: "",
    },
    productsSold: [],
    payment: null,
    termsAgreed: false,
    transcript: [
      {
        at: "00:00",
        speaker: "system" as const,
        text: `Inbound call connected · Queue: ${scenario.category.name} · Skill: Residential Care`,
      },
      {
        at: "00:04",
        speaker: "customer" as const,
        text: scenario.scenario.openingStatement,
      },
    ],
    aiScores: null,
    aiCoaching: null,
    teacherRating: null,
    teacherComments: null,
    overallRating: null,
    createdAt: new Date(),
  };

  await db.insert(calls).values(row);
  return Response.json({ call: row });
}
