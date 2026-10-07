"use client";

import { useEffect, useMemo, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { api, fileToDataUrl } from "@/lib/client";
import { formatDateTime, initials } from "@/lib/utils";
import type { DirectoryUser, MessageRow } from "@/lib/types";

export function MessagesPortal({ selfId }: { selfId: string }) {
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [peerId, setPeerId] = useState<string>("");
  const [thread, setThread] = useState<MessageRow[]>([]);
  const [unreadByPeer, setUnreadByPeer] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function load(withUser?: string) {
    const q = withUser ? `?with=${withUser}` : "";
    const data = await api<{
      directory: DirectoryUser[];
      thread: MessageRow[];
      unreadByPeer: Record<string, number>;
    }>(`/api/messages${q}`);
    setDirectory(data.directory);
    setUnreadByPeer(data.unreadByPeer);
    if (withUser) setThread(data.thread);
    return data;
  }

  useEffect(() => {
    load()
      .then((d) => {
        const first = d.directory[0];
        if (first) setPeerId(first.id);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!peerId) return;
    load(peerId)
      .then(() =>
        api("/api/messages/read", { method: "POST", body: JSON.stringify({ fromUserId: peerId }) }),
      )
      .catch((e: Error) => setError(e.message));
  }, [peerId]);

  const peer = useMemo(() => directory.find((d) => d.id === peerId), [directory, peerId]);

  async function send() {
    if (!peerId || !text.trim()) return;
    setError("");
    let attachmentName: string | undefined;
    let attachmentMime: string | undefined;
    let attachmentData: string | undefined;
    if (file) {
      attachmentName = file.name;
      attachmentMime = file.type || "application/octet-stream";
      attachmentData = await fileToDataUrl(file);
    }
    await api("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        toUserId: peerId,
        body: text,
        attachmentName,
        attachmentMime,
        attachmentData,
      }),
    });
    setText("");
    setFile(null);
    await load(peerId);
  }

  async function downloadAttachment(id: string) {
    const data = await api<{ name: string; mime: string; data: string }>(`/api/messages/${id}/attachment`);
    const a = document.createElement("a");
    a.href = data.data;
    a.download = data.name || "attachment";
    a.click();
  }

  return (
    <div className="grid min-h-[70vh] overflow-hidden rounded-2xl border border-line bg-white shadow-sm lg:grid-cols-[280px_1fr]">
      <aside className="border-b border-line lg:border-b-0 lg:border-r">
        <div className="border-b border-line px-4 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">Inbox</p>
          <h2 className="text-lg font-semibold">Teacher messages</h2>
        </div>
        <ul className="max-h-[30vh] overflow-y-auto lg:max-h-none">
          {directory.map((d) => (
            <li key={d.id}>
              <button
                onClick={() => setPeerId(d.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas ${peerId === d.id ? "bg-canvas" : ""}`}
              >
                <div className="grid h-9 w-9 place-items-center rounded-full bg-navy text-xs text-accent">
                  {initials(d.firstName, d.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {d.firstName} {d.lastName}
                  </p>
                  <p className="truncate text-xs capitalize text-muted">{d.role}</p>
                </div>
                {unreadByPeer[d.id] ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-danger text-[10px] text-white">
                    {unreadByPeer[d.id]}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="flex min-h-[50vh] flex-col">
        <div className="border-b border-line px-5 py-3">
          <p className="font-medium">
            {peer ? `${peer.firstName} ${peer.lastName}` : "Select a conversation"}
          </p>
          <p className="text-xs text-muted">Coaching, reminders, and assistance</p>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto bg-panel p-4">
          {thread.map((m) => {
            const mine = m.fromUserId === selfId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-navy text-white" : "bg-white ring-1 ring-line"}`}
                >
                  <p>{m.body}</p>
                  {m.hasAttachment && (
                    <button
                      onClick={() => downloadAttachment(m.id)}
                      className="mt-1 inline-flex items-center gap-1 text-xs underline"
                    >
                      <Paperclip className="h-3 w-3" />
                      {m.attachmentName || "Attachment"}
                    </button>
                  )}
                  <p className={`mt-1 text-[10px] ${mine ? "text-white/50" : "text-muted"}`}>
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {error && <p className="px-4 text-sm text-danger">{error}</p>}
        <form
          className="flex flex-wrap items-center gap-2 border-t border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label className="grid h-10 w-10 cursor-pointer place-items-center rounded-lg bg-canvas">
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask a question, send feedback, or request help…"
            className="min-w-[180px] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
          />
          <button className="inline-flex items-center gap-1 rounded-xl bg-accent-2 px-3 py-2 text-sm font-medium text-white">
            <Send className="h-4 w-4" />
            Send
          </button>
          {file && <span className="w-full text-xs text-muted">{file.name}</span>}
        </form>
      </section>
    </div>
  );
}
