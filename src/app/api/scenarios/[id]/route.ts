import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, scenarios } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const { id } = await context.params;

  const [row] = await db
    .select({ scenario: scenarios, category: categories })
    .from(scenarios)
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .where(eq(scenarios.id, id))
    .limit(1);
  if (!row) return jsonError("Scenario not found.", 404);

  const catalog = await db.select().from(products);

  const studentView = user.role === "student";
  return Response.json({
    scenario: {
      ...row.scenario,
      categoryName: row.category.name,
      categoryColor: row.category.color,
      categoryIcon: row.category.icon,
      accountPassword: studentView ? undefined : row.scenario.accountPassword,
      securityAnswer: studentView ? undefined : row.scenario.securityAnswer,
    },
    products: catalog,
  });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const { id } = await context.params;
  const body = (await request.json()) as Record<string, string | number | boolean | null>;

  await db
    .update(scenarios)
    .set({
      categoryId: String(body.categoryId),
      title: String(body.title),
      difficulty: String(body.difficulty || "Standard"),
      customerFirstName: String(body.customerFirstName),
      customerLastName: String(body.customerLastName),
      accountNumber: String(body.accountNumber),
      accountPassword: String(body.accountPassword),
      securityQuestion: String(body.securityQuestion),
      securityAnswer: String(body.securityAnswer),
      address: String(body.address || ""),
      email: String(body.email || ""),
      mobile: String(body.mobile || ""),
      currentPlan: String(body.currentPlan || ""),
      monthlyFee: Number(body.monthlyFee || 0),
      internetSpeed: String(body.internetSpeed || ""),
      contractDuration: String(body.contractDuration || ""),
      serviceStatus: String(body.serviceStatus || "Active"),
      billingStatus: String(body.billingStatus || "Current"),
      currentBalance: Number(body.currentBalance || 0),
      outstandingBalance: Number(body.outstandingBalance || 0),
      dueDate: String(body.dueDate || ""),
      previousPayment: Number(body.previousPayment || 0),
      concern: String(body.concern || ""),
      openingStatement: String(body.openingStatement || ""),
      transferEnabled: body.transferEnabled !== false,
      assignedStudentId: body.assignedStudentId ? String(body.assignedStudentId) : null,
      isActive: body.isActive !== false,
    })
    .where(eq(scenarios.id, id));

  const [scenario] = await db.select().from(scenarios).where(eq(scenarios.id, id));
  return Response.json({ scenario });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);
  const { id } = await context.params;
  await db.delete(scenarios).where(eq(scenarios.id, id));
  return Response.json({ ok: true });
}
