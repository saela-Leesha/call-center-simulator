import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, jsonError } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  };

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const firstName = body.firstName?.trim();
  const lastName = body.lastName?.trim();
  const role = body.role === "teacher" ? "teacher" : "student";

  if (!email || !password || !firstName || !lastName) {
    return jsonError("All fields are required.");
  }
  if (password.length < 6) {
    return jsonError("Password must be at least 6 characters.");
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    return jsonError("An account with this email already exists.");
  }

  const count = await db.select({ id: users.id }).from(users);
  const agentId =
    role === "teacher"
      ? `TL-${1000 + count.length}`
      : `AG-${1100 + count.length}`;

  const id = newId();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    firstName,
    lastName,
    role,
    agentId,
    department: role === "teacher" ? "Quality & Training" : "Residential Care",
  });

  await createSession(id);
  return Response.json({
    user: { id, email, firstName, lastName, role },
  });
}
