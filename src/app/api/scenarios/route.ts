import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { categories, scenarios, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const rows = await db
    .select({ scenario: scenarios, category: categories })
    .from(scenarios)
    .innerJoin(categories, eq(scenarios.categoryId, categories.id))
    .orderBy(desc(scenarios.createdAt));

  const filtered =
    user.role === "teacher"
      ? rows
      : rows.filter(
          (r) =>
            r.scenario.isActive &&
            (r.scenario.assignedStudentId == null ||
              r.scenario.assignedStudentId === user.id),
        );

  const studentIds = [
    ...new Set(
      filtered
        .map((r) => r.scenario.assignedStudentId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const studentRows = studentIds.length
    ? await db.select().from(users)
    : [];
  const studentMap = new Map(studentRows.map((s) => [s.id, s]));

  return Response.json({
    scenarios: filtered.map((r) => ({
      ...r.scenario,
      categoryName: r.category.name,
      categoryColor: r.category.color,
      categoryIcon: r.category.icon,
      assignedStudentName: r.scenario.assignedStudentId
        ? (() => {
            const s = studentMap.get(r.scenario.assignedStudentId);
            return s ? `${s.firstName} ${s.lastName}` : "Assigned";
          })()
        : "All students",
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as Record<string, string | number | boolean | null>;
  const required = [
    "categoryId",
    "title",
    "customerFirstName",
    "customerLastName",
    "accountNumber",
    "accountPassword",
    "securityQuestion",
    "securityAnswer",
    "concern",
  ];
  for (const key of required) {
    if (!body[key]) return jsonError(`${key} is required.`);
  }

  const row = {
    id: newId(),
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
    currentPlan: String(body.currentPlan || "Fiber Basic Plan"),
    monthlyFee: Number(body.monthlyFee || 0),
    internetSpeed: String(body.internetSpeed || "100 Mbps"),
    contractDuration: String(body.contractDuration || "12 months"),
    serviceStatus: String(body.serviceStatus || "Active"),
    billingStatus: String(body.billingStatus || "Current"),
    currentBalance: Number(body.currentBalance || 0),
    outstandingBalance: Number(body.outstandingBalance || 0),
    dueDate: String(body.dueDate || ""),
    previousPayment: Number(body.previousPayment || 0),
    concern: String(body.concern),
    openingStatement: String(body.openingStatement || body.concern),
    transferEnabled: body.transferEnabled !== false,
    assignedStudentId: body.assignedStudentId ? String(body.assignedStudentId) : null,
    createdBy: user.id,
    isActive: true,
    createdAt: new Date(),
  };

  await db.insert(scenarios).values(row);
  return Response.json({ scenario: row });
}
