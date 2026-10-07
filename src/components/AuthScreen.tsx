"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Headphones, ShieldCheck, GraduationCap } from "lucide-react";
import { api } from "@/lib/client";

type Mode = "login" | "register";

export function AuthScreen({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await api<{ user: { role: string } }>(path, {
        method: "POST",
        body: JSON.stringify({ email, password, role, firstName, lastName }),
      });
      router.push(data.user.role === "teacher" ? "/teacher" : "/student");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(nextRole: "student" | "teacher") {
    setRole(nextRole);
    if (nextRole === "student") {
      setEmail("student@aetherlink.com");
      setPassword("Student123!");
    } else {
      setEmail("teacher@aetherlink.com");
      setPassword("Teacher123!");
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section className="relative hidden overflow-hidden bg-navy text-white lg:flex">
        <img
          src="/images/login-hero.jpg"
          alt="AetherLink contact center floor"
          className="absolute inset-0 h-full w-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy/88 to-accent-2/40" />
        <div className="relative z-10 flex w-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-navy shadow-lg shadow-accent/30">
              <Headphones className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-accent">AetherLink CCS</p>
              <p className="text-lg font-semibold">Contact Center Academy</p>
            </div>
          </div>
          <div className="max-w-xl">
            <p className="text-sm uppercase tracking-[0.18em] text-accent">Workforce simulation</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.05]">
              Train like you take live fiber care calls.
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/75">
              Authenticate customers, document in the CRM, process payments, and receive AI plus
              teacher coaching — the same rhythm used on a telecommunications BPO floor.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-4">
              {[
                ["99.2%", "QA floor target"],
                ["7", "live scenario queues"],
                ["PCI", "disclosure ready"],
              ].map(([k, v]) => (
                <div key={v} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-mono text-2xl text-accent">{k}</p>
                  <p className="mt-1 text-xs text-white/60">{v}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs text-white/50">
            Educational simulator · Not connected to production billing systems
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-canvas px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-accent">
                <Headphones className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-accent-2">AetherLink CCS</p>
                <p className="font-semibold">Contact Center Academy</p>
              </div>
            </div>
          </div>

          <p className="text-sm font-medium uppercase tracking-[0.16em] text-accent-2">
            {mode === "login" ? "Agent sign in" : "Create academy account"}
          </p>
          <h2 className="mt-2 text-3xl font-semibold text-ink">
            {mode === "login" ? "Enter the training floor" : "Join a nesting wave"}
          </h2>
          <p className="mt-2 text-sm text-muted">
            Choose your role. Students handle simulated live calls. Teachers coach, assign
            scenarios, and issue certificates.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-line">
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                role === "student" ? "bg-navy text-white" : "text-muted hover:text-ink"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Student
            </button>
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                role === "teacher" ? "bg-navy text-white" : "text-muted hover:text-ink"
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
              Teacher
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">First name</span>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 focus:ring-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-muted">Last name</span>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 focus:ring-2"
                  />
                </label>
              </div>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Work email</span>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 focus:ring-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Password</span>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-accent/30 focus:ring-2"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
            )}
            <button
              disabled={loading}
              className="w-full rounded-xl bg-accent-2 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/20 transition hover:bg-accent disabled:opacity-60"
            >
              {loading ? "Connecting…" : mode === "login" ? "Sign in to CCS" : "Create account"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted">
            {mode === "login" ? (
              <>
                New hire?{" "}
                <a href="/register" className="font-medium text-accent-2">
                  Sign up
                </a>
              </>
            ) : (
              <>
                Already rostered?{" "}
                <a href="/login" className="font-medium text-accent-2">
                  Sign in
                </a>
              </>
            )}
          </p>

          {mode === "login" && (
            <div className="mt-6 rounded-2xl border border-dashed border-line bg-white/70 p-4 text-sm">
              <p className="font-medium text-ink">Demo academy logins</p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => fillDemo("student")}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-left hover:bg-line/40"
                >
                  <span>
                    Student · Jordan Ellis
                    <span className="block font-mono text-xs text-muted">student@aetherlink.com</span>
                  </span>
                  <span className="text-xs text-accent-2">Use</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillDemo("teacher")}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-left hover:bg-line/40"
                >
                  <span>
                    Teacher · Maya Reyes
                    <span className="block font-mono text-xs text-muted">teacher@aetherlink.com</span>
                  </span>
                  <span className="text-xs text-accent-2">Use</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
