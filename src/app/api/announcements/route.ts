import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, announcementReads, notifications, users } from "@/db/schema";
import { getCurrentUser, jsonError } from "@/lib/auth";
import { newId } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);

  const rows = await db
    .select({ announcement: announcements, author: users })
    .from(announcements)
    .innerJoin(users, eq(announcements.authorId, users.id))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt));

  const reads = await db
    .select()
    .from(announcementReads)
    .where(eq(announcementReads.userId, user.id));
  const readSet = new Set(reads.map((r) => r.announcementId));

  return Response.json({
    announcements: rows.map((r) => ({
      id: r.announcement.id,
      title: r.announcement.title,
      body: r.announcement.body,
      kind: r.announcement.kind,
      attachmentName: r.announcement.attachmentName,
      hasAttachment: Boolean(r.announcement.attachmentData),
      pinned: r.announcement.pinned,
      createdAt: r.announcement.createdAt,
      authorName: `${r.author.firstName} ${r.author.lastName}`,
      authorRole: r.author.role,
      read: readSet.has(r.announcement.id),
    })),
    unread: rows.filter((r) => !readSet.has(r.announcement.id)).length,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  if (user.role !== "teacher") return jsonError("Teachers only.", 403);

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    kind?: string;
    pinned?: boolean;
    attachmentName?: string;
    attachmentMime?: string;
    attachmentData?: string;
  };
  const title = body.title?.trim();
  const text = body.body?.trim();
  if (!title || !text) return jsonError("Title and message are required.");
  if ((body.attachmentData?.length || 0) > 1_400_000) {
    return jsonError("Attachment is too large (max ~1MB).");
  }

  const row = {
    id: newId(),
    authorId: user.id,
    title,
    body: text,
    kind: ["announcement", "coaching", "reminder"].includes(body.kind || "")
      ? (body.kind as string)
      : "announcement",
    attachmentName: body.attachmentName || null,
    attachmentMime: body.attachmentMime || null,
    attachmentData: body.attachmentData || null,
    pinned: body.pinned ?? false,
    createdAt: new Date(),
  };
  await db.insert(announcements).values(row);

  const students = await db.select().from(users).where(eq(users.role, "student"));
  for (const s of students) {
    await db.insert(notifications).values({
      id: newId(),
      userId: s.id,
      title: row.kind === "coaching" ? "Coaching message" : "New announcement",
      body: `${title}`,
      type: "message",
      link: "/student/messages",
      read: false,
      createdAt: new Date(),
    });
  }

  return Response.json({ announcement: { ...row, attachmentData: null, hasAttachment: Boolean(row.attachmentData) } });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as { id?: string };
  if (!body.id) return jsonError("id is required.");
  const [already] = await db
    .select()
    .from(announcementReads)
    .where(
      and(eq(announcementReads.announcementId, body.id), eq(announcementReads.userId, user.id)),
    )
    .limit(1);
  if (!already) {
    await db.insert(announcementReads).values({
      id: newId(),
      announcementId: body.id,
      userId: user.id,
      readAt: new Date(),
    });
  }
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "teacher") return jsonError("Teachers only.", 403);
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return jsonError("id is required.");
  await db.delete(announcements).where(eq(announcements.id, id));
  return Response.json({ ok: true });
}
