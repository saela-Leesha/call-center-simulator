"use client";

import { useState, type FormEvent } from "react";
import type { AuthUser } from "@/lib/auth";
import { api } from "@/lib/client";

export function ProfileForm({ user }: { user: AuthUser }) {
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [department, setDepartment] = useState(user.department ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function save(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      await api("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ firstName, lastName, phone, bio, department, password: password || undefined }),
      });
      setPassword("");
      setMessage("Profile updated.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Unable to save");
    }
  }

  return (
    <form onSubmit={save} className="max-w-2xl space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-muted">Identity</p>
        <h2 className="text-2xl font-semibold">Profile</h2>
        <p className="text-sm text-muted">
          {user.role === "student" ? "Agent" : "Coach"} ID {user.agentId} · {user.email}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="text-sm">
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="text-sm">
          Mobile
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
        </label>
        <label className="text-sm">
          Department
          <input value={department} onChange={(e) => setDepartment(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
        </label>
      </div>
      <label className="block text-sm">
        Bio
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
      </label>
      <label className="block text-sm">
        New password (optional)
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" />
      </label>
      <button className="rounded-xl bg-navy px-4 py-2 text-sm text-white">Save profile</button>
      {message && <p className="text-sm text-accent-2">{message}</p>}
    </form>
  );
}
