"use client";

import { useEffect, useState } from "react";
import { Megaphone, Pin, Trash2 } from "lucide-react";
import { Panel, Pill } from "@/components/ui";
import { api, fileToDataUrl } from "@/lib/client";
import { formatDateTime } from "@/lib/utils";

type Ann = {
  id: string;
  title: string;
  body: string;
  kind: string;
  attachmentName: string | null;
  hasAttachment: boolean;
  pinned: boolean;
  createdAt: string;
  authorName: string;
  authorRole: string;
  read: boolean;
};

export function AnnouncementsBoard({ teacherMode }: { teacherMode?: boolean }) {
  const [rows, setRows] = useState<Ann[]>([]);
  const [form, setForm] = useState({ title: "", body: "", kind: "announcement", pinned: false });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function reload() {
    const d = await api<{ announcements: Ann[] }>("/api/announcements");
    setRows(d.announcements);
  }

  useEffect(() => {
    reload().catch((e: Error) => setMessage(e.message));
  }, []);

  useEffect(() => {
    const unread = rows.filter((r) => !r.read);
    if (!unread.length) return;
    void Promise.all(
      unread.map((r) => api("/api/announcements", { method: "PATCH", body: JSON.stringify({ id: r.id }) })),
    );
  }, [rows]);

  async function publish() {
    setMessage("");
    let attachmentName: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentData: string | undefined;
    if (file) {
      attachmentName = file.name;
      attachmentMime = file.type || "application/octet-stream";
      attachmentData = await fileToDataUrl(file);
    }
    await api("/api/announcements", {
      method: "POST",
      body: JSON.stringify({ ...form, attachmentName, attachmentMime, attachmentData }),
    });
    setForm({ title: "", body: "", kind: "announcement", pinned: false });
    setFile(null);
    setMessage("Posted to every student dashboard and notification centre.");
    reload();
  }

  async function download(a: Ann) {
    const d = await api<{ name: string; data: string }>(`/api/messages/announcement/${a.id}/attachment`);
    const link = document.createElement("a");
    link.href = d.data;
    link.download = d.name || "attachment";
    link.click();
  }

  return (
    <div className="space-y-4">
      {teacherMode && (
        <Panel title="Group announcement / coaching broadcast">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            />
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="rounded-lg border border-line px-3 py-2 text-sm"
            >
              <option value="announcement">Announcement</option>
              <option value="coaching">Coaching message</option>
              <option value="reminder">Reminder</option>
            </select>
            <textarea
              placeholder="Message to the cohort"
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="md:col-span-2 rounded-lg border border-line px-3 py-2 text-sm"
              rows={3}
            />
            <label className="text-sm">
              Attachment
              <input type="file" className="mt-1 block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <label className="flex items-end gap-2 text-sm">
              <input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} />
              Pin to top
            </label>
          </div>
          <button onClick={publish} className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white">
            Publish to all students
          </button>
          {message && <p className="mt-2 text-sm text-accent-2">{message}</p>}
        </Panel>
      )}

      <div className="space-y-3">
        {rows.map((a) => (
          <article key={a.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-base font-semibold">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-gold" />}
                  {a.title}
                </p>
                <p className="text-xs text-muted">
                  {a.authorName} · {formatDateTime(a.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={a.kind === "coaching" ? "teal" : a.kind === "reminder" ? "warn" : "navy"}>
                  <Megaphone className="mr-1 inline h-3 w-3" />
                  {a.kind}
                </Pill>
                {teacherMode && (
                  <button
                    onClick={async () => {
                      await api(`/api/announcements?id=${a.id}`, { method: "DELETE" });
                      reload();
                    }}
                    className="text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{a.body}</p>
            {a.hasAttachment && (
              <button onClick={() => download(a)} className="mt-2 text-xs text-accent-2 underline">
                Download {a.attachmentName}
              </button>
            )}
          </article>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No announcements posted yet.</p>}
      </div>
    </div>
  );
}
