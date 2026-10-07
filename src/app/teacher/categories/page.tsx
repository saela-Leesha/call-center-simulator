"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { CategoryRow } from "@/lib/types";

const empty = { name: "", description: "", icon: "phone", color: "#14b8a6", isActive: true };

export default function CategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [form, setForm] = useState({ ...empty });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const data = await api<{ categories: CategoryRow[] }>("/api/categories");
    setRows(data.categories);
  }

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
  }, []);

  async function save() {
    setError("");
    if (editing) {
      await api(`/api/categories/${editing}`, { method: "PUT", body: JSON.stringify(form) });
    } else {
      await api("/api/categories", { method: "POST", body: JSON.stringify(form) });
    }
    setForm({ ...empty });
    setEditing(null);
    reload();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <h2 className="text-2xl font-semibold">Call categories</h2>
        <p className="text-sm text-muted">Teachers can create, edit, and retire queues that students pick from.</p>
        {error && <p className="mt-2 text-danger">{error}</p>}
        <div className="mt-4 space-y-3">
          {rows.map((c) => (
            <article key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-white p-4">
              <div>
                <p className="font-medium" style={{ color: c.color }}>
                  {c.name}
                </p>
                <p className="text-sm text-muted">{c.description}</p>
                <p className="mt-1 text-xs">{c.isActive ? "Active" : "Hidden"}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(c.id);
                    setForm({
                      name: c.name,
                      description: c.description,
                      icon: c.icon,
                      color: c.color,
                      isActive: c.isActive,
                    });
                  }}
                  className="text-xs text-accent-2"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    await api(`/api/categories/${c.id}`, { method: "DELETE" });
                    reload();
                  }}
                  className="text-xs text-danger"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      <form
        className="h-fit space-y-3 rounded-2xl border border-line bg-white p-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h3 className="font-semibold">{editing ? "Edit category" : "New category"}</h3>
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <textarea
          required
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          placeholder="Icon key"
          value={form.icon}
          onChange={(e) => setForm({ ...form, icon: e.target.value })}
          className="w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <input
          type="color"
          value={form.color}
          onChange={(e) => setForm({ ...form, color: e.target.value })}
          className="h-10 w-full"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active for students
        </label>
        <button className="w-full rounded-xl bg-navy py-2 text-sm text-white">Save category</button>
      </form>
    </div>
  );
}
