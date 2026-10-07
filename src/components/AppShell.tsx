"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Award,
  Bell,
  ChartColumnBig,
  Headset,
  History,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  PhoneCall,
  Settings2,
  Shield,
  Users,
  FolderKanban,
  ClipboardCheck,
  UserRound,
} from "lucide-react";
import type { AuthUser } from "@/lib/auth";
import { api } from "@/lib/client";
import { primeSoftphone, softphone } from "@/lib/softphone-audio";
import { cn, initials } from "@/lib/utils";

type Notice = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const studentNav = [
  { href: "/student", label: "Dashboard", icon: LayoutDashboard },
  { href: "/student/calls", label: "Customer Calls", icon: PhoneCall },
  { href: "/student/history", label: "Call History", icon: History },
  { href: "/student/messages", label: "Teacher Messages", icon: MessageSquare },
  { href: "/student/certificates", label: "Certificates", icon: Award },
  { href: "/student/profile", label: "Profile", icon: UserRound },
];

const teacherNav = [
  { href: "/teacher", label: "Dashboard", icon: LayoutDashboard },
  { href: "/teacher/customers", label: "Customer Management", icon: FolderKanban },
  { href: "/teacher/students", label: "Student Management", icon: Users },
  { href: "/teacher/evaluations", label: "Evaluations & Ratings", icon: ClipboardCheck },
  { href: "/teacher/messages", label: "Messages", icon: MessageSquare },
  { href: "/teacher/certificates", label: "Certificates", icon: Award },
  { href: "/teacher/reports", label: "Reports & Analytics", icon: ChartColumnBig },
  { href: "/teacher/settings", label: "Settings", icon: Settings2 },
  { href: "/teacher/profile", label: "My Profile", icon: UserRound },
];

export function AppShell({
  user,
  variant,
  children,
}: {
  user: AuthUser;
  variant: "student" | "teacher";
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = variant === "student" ? studentNav : teacherNav;
  const [status, setStatus] = useState("offline");
  const [statusMeta, setStatusMeta] = useState<{ label: string; ringTimeoutSeconds: number; queueAutoDispatch: boolean }>({
    label: "Offline",
    ringTimeoutSeconds: 30,
    queueAutoDispatch: true,
  });
  const [openNotes, setOpenNotes] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () =>
      setClock(
        new Intl.DateTimeFormat("en-US", {
          weekday: "short",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  async function loadNotes() {
    try {
      const data = await api<{ notifications: Notice[]; unread: number }>("/api/notifications");
      setNotices(data.notifications);
      setUnread(data.unread);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadNotes();
    const id = setInterval(loadNotes, 20000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (variant !== "student") return;
    api<{ status: string; label: string; ringTimeoutSeconds: number; queueAutoDispatch: boolean }>(
      "/api/agent-status",
    )
      .then((d) => {
        setStatus(d.status);
        setStatusMeta({
          label: d.label,
          ringTimeoutSeconds: d.ringTimeoutSeconds,
          queueAutoDispatch: d.queueAutoDispatch,
        });
      })
      .catch(() => undefined);
  }, [variant]);

  async function changeStatus(next: string) {
    primeSoftphone();
    softphone()?.click();
    setStatus(next);
    try {
      await api("/api/agent-status", { method: "POST", body: JSON.stringify({ status: next }) });
    } catch {
      /* keep local state so the softphone stays usable */
    }
  }

  const title = useMemo(() => {
    const hit = [...nav].sort((a, b) => b.href.length - a.href.length).find((n) => pathname === n.href || (n.href !== `/${variant}` && pathname.startsWith(n.href)));
    return hit?.label ?? "Workspace";
  }, [nav, pathname, variant]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col bg-navy text-white md:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-navy">
            <Headset className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-accent">AetherLink CCS</p>
            <p className="text-sm font-semibold">
              {variant === "student" ? "Agent Desktop" : "Coach Console"}
            </p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== `/${variant}` && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-navy-3 font-mono text-xs text-accent">
              {initials(user.firstName, user.lastName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate font-mono text-[11px] text-white/50">{user.agentId}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="md:pl-[260px]">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-white/90 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
              {variant === "student" ? "Live training desktop" : "Quality operations"}
            </p>
            <h1 className="text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <p className="hidden font-mono text-xs text-muted sm:block">{clock}</p>
            {variant === "student" ? (
              <div className="flex items-center gap-1 rounded-full border border-line bg-panel p-1">
                {(
                  [
                    ["available", "Available", "bg-ok"],
                    ["busy", "Busy", "bg-danger"],
                    ["break", "Break", "bg-gold"],
                    ["offline", "Offline", "bg-slate-400"],
                  ] as const
                ).map(([value, label, dot]) => (
                  <button
                    key={value}
                    onClick={() => changeStatus(value)}
                    title={`Set status to ${label}`}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                      status === value ? "bg-navy text-white" : "text-muted hover:text-ink"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dot} ${status === value && value === "available" ? "animate-pulse" : ""}`} />
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-medium">
                {statusMeta.label}
              </span>
            )}
            <div className="relative">
              <button
                onClick={() => setOpenNotes((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-white"
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] text-white">
                    {unread}
                  </span>
                )}
              </button>
              {openNotes && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-xl">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <p className="text-sm font-medium">Notifications</p>
                    <button
                      className="text-xs text-accent-2"
                      onClick={async () => {
                        await api("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
                        loadNotes();
                      }}
                    >
                      Mark all read
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notices.length === 0 && (
                      <p className="px-3 py-6 text-center text-sm text-muted">No notifications</p>
                    )}
                    {notices.map((n) => (
                      <button
                        key={n.id}
                        onClick={async () => {
                          await api("/api/notifications", { method: "POST", body: JSON.stringify({ id: n.id }) });
                          if (n.link) router.push(n.link);
                          setOpenNotes(false);
                          loadNotes();
                        }}
                        className={cn(
                          "block w-full border-b border-line px-3 py-3 text-left text-sm hover:bg-canvas",
                          !n.read && "bg-accent/5",
                        )}
                      >
                        <p className="font-medium">{n.title}</p>
                        <p className="text-xs text-muted">{n.body}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-line bg-panel px-2 py-1 sm:flex">
              <Shield className="h-3.5 w-3.5 text-accent-2" />
              <span className="text-xs">{user.department}</span>
            </div>
          </div>
        </header>
        <div className="flex gap-1 overflow-x-auto border-b border-line bg-white px-2 py-2 md:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-xs",
                pathname.startsWith(item.href) ? "bg-navy text-white" : "bg-canvas text-muted",
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
