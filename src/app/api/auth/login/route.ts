import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, jsonError, verifyPassword } from "@/lib/auth";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureSeeded();
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    role?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";
  const role = body.role;

  if (!email || !password) {
    return jsonError("Email and password are required.");
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return jsonError("Invalid email or password.", 401);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return jsonError("Invalid email or password.", 401);
  }
  if (role && user.role !== role) {
    return jsonError(
      `This account is registered as a ${user.role}. Switch the role toggle and try again.`,
      403,
    );
  }

  await createSession(user.id);
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
}
