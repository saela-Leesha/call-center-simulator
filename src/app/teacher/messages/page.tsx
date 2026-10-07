import { redirect } from "next/navigation";
import { MessagesPortal } from "@/components/MessagesPortal";
import { AnnouncementsBoard } from "@/components/AnnouncementsBoard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TeacherMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Communication hub</p>
        <h2 className="text-2xl font-semibold">Messages</h2>
        <p className="text-sm text-muted">
          Direct chat with students, coaching conversations, attachments, and cohort-wide
          announcements. Every exchange is stored in message history.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <MessagesPortal selfId={user.id} />
        <AnnouncementsBoard teacherMode />
      </div>
    </div>
  );
}
