import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, notifications, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const url = new URL(request.url);
  const withUser = url.searchParams.get("with");

  const people = await db.select().from(users);
  const directory = people
    .filter((p) => p.id !== user.id)
    .filter((p) => (user.role === "student" ? p.role === "teacher" : true))
    .map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      role: p.role,
      agentId: p.agentId,
      email: p.email,
    }));

  const rows = await db.select().from(messages).orderBy(desc(messages.createdAt));
  const mine = rows.filter((m) => m.fromUserId === user.id || m.toUserId === user.id);

  const thread = withUser
    ? mine
        .filter(
          (m) =>
            (m.fromUserId === withUser && m.toUserId === user.id) ||
            (m.fromUserId === user.id && m.toUserId === withUser),
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((m) => ({
          ...m,
          attachmentData: m.attachmentData ? true : null,
          hasAttachment: Boolean(m.attachmentData),
        }))
    : [];

  const unreadByPeer: Record<string, number> = {};
  for (const m of mine) {
    if (m.toUserId === user.id && !m.readAt) {
      unreadByPeer[m.fromUserId] = (unreadByPeer[m.fromUserId] || 0) + 1;
    }
  }

  return Response.json({
    directory,
    thread,
    unreadByPeer,
    unreadTotal: Object.values(unreadByPeer).reduce((a, b) => a + b, 0),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as {
    toUserId?: string;
    body?: string;
    attachmentName?: string;
    attachmentMime?: string;
    attachmentData?: string;
  };
  const text = body.body?.trim();
  if (!body.toUserId || !text) return jsonError("Recipient and message are required.");
  if ((body.attachmentData?.length || 0) > 1_400_000) {
    return jsonError("Attachment is too large (max ~1MB).");
  }

  const [peer] = await db.select().from(users).where(eq(users.id, body.toUserId)).limit(1);
  if (!peer) return jsonError("Recipient not found.", 404);

  const row = {
    id: newId(),
    fromUserId: user.id,
    toUserId: peer.id,
    body: text,
    attachmentName: body.attachmentName || null,
    attachmentMime: body.attachmentMime || null,
    attachmentData: body.attachmentData || null,
    readAt: null,
    createdAt: new Date(),
  };
  await db.insert(messages).values(row);
  await db.insert(notifications).values({
    id: newId(),
    userId: peer.id,
    title: "New message",
    body: `${user.firstName} ${user.lastName}: ${text.slice(0, 80)}`,
    type: "message",
    link: peer.role === "student" ? "/student/messages" : "/teacher/messages",
    read: false,
    createdAt: new Date(),
  });

  return Response.json({
    message: { ...row, hasAttachment: Boolean(row.attachmentData), attachmentData: null },
  });
}
