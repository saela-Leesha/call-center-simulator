import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { newId } from "@/lib/utils";
import { ensureTeacherSeed } from "@/db/seed";
import { hashPassword, verifyPassword } from "@/lib/password";

export { hashPassword, verifyPassword };

const COOKIE = "ccs_session";
const SESSION_DAYS = 14;

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "teacher";
  agentStatus: string;
  phone: string | null;
  bio: string | null;
  agentId: string | null;
  department: string | null;
  createdAt: Date;
};

function toAuthUser(row: typeof users.$inferSelect): AuthUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    role: row.role === "teacher" ? "teacher" : "student",
    agentStatus: row.agentStatus,
    phone: row.phone,
    bio: row.bio,
    agentId: row.agentId,
    department: row.department,
    createdAt: row.createdAt,
  };
}

export async function createSession(userId: string) {
  const token = newId() + newId();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: newId(),
    userId,
    token,
    expiresAt,
  });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    secure: process.env.NODE_ENV === "production",
  });
  return token;
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  store.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  await ensureTeacherSeed();
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;

  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  if (row.session.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }
  return toAuthUser(row.user);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
