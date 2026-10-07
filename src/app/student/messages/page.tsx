import { redirect } from "next/navigation";
import { MessagesPortal } from "@/components/MessagesPortal";
import { AnnouncementsBoard } from "@/components/AnnouncementsBoard";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function StudentMessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Cohort board</p>
        <h2 className="text-xl font-semibold">Announcements & coaching broadcasts</h2>
      </div>
      <AnnouncementsBoard />
      <MessagesPortal selfId={user.id} />
    </div>
  );
}
