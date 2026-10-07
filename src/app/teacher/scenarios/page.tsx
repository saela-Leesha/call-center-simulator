"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import type { CategoryRow, ScenarioRow } from "@/lib/types";

type StudentOpt = { id: string; firstName: string; lastName: string };

const blank = {
  categoryId: "",
  title: "",
  difficulty: "Standard",
  customerFirstName: "",
  customerLastName: "",
  accountNumber: "",
  accountPassword: "",
  securityQuestion: "What is your mother's maiden name?",
  securityAnswer: "",
  address: "",
  email: "",
  mobile: "",
  currentPlan: "Fiber Basic Plan",
  monthlyFee: 3999,
  internetSpeed: "100 Mbps",
  contractDuration: "12 months",
  serviceStatus: "Active",
  currentBalance: 3999,
  outstandingBalance: 0,
  dueDate: "2026-04-30",
  previousPayment: 3999,
  concern: "",
  openingStatement: "",
  transferEnabled: true,
  assignedStudentId: "",
};

export default function ScenariosPage() {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const [s, c, st] = await Promise.all([
      api<{ scenarios: ScenarioRow[] }>("/api/scenarios"),
      api<{ categories: CategoryRow[] }>("/api/categories"),
      api<{ students: StudentOpt[] }>("/api/students"),
    ]);
    setRows(s.scenarios);
    setCats(c.categories);
    setStudents(st.students);
    if (!form.categoryId && c.categories[0]) {
      setForm((f) => ({ ...f, categoryId: c.categories[0].id }));
    }
  }

  useEffect(() => {
    reload().catch((e: Error) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setError("");
    const payload = { ...form, assignedStudentId: form.assignedStudentId || null };
    if (editing) {
      await api(`/api/scenarios/${editing}`, { method: "PUT", body: JSON.stringify(payload) });
    } else {
      await api("/api/scenarios", { method: "POST", body: JSON.stringify(payload) });
    }
    setEditing(null);
    setForm({ ...blank, categoryId: cats[0]?.id || "" });
    reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Customer scenarios</h2>
        <p className="text-sm text-muted">Build the accounts students will authenticate and serve.</p>
      </div>
      {error && <p className="text-danger">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-canvas text-[11px] uppercase text-muted">
            <tr>
              <th className="px-3 py-2">Scenario</th>
              <th className="px-3 py-2">Queue</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Assigned</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-3 py-2">{s.title}</td>
                <td className="px-3 py-2">{s.categoryName}</td>
                <td className="px-3 py-2">
                  {s.customerFirstName} {s.customerLastName}
                </td>
                <td className="px-3 py-2">{s.assignedStudentName}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    className="text-xs text-accent-2"
                    onClick={async () => {
                      const data = await api<{ scenario: ScenarioRow }>(`/api/scenarios/${s.id}`);
                      setEditing(s.id);
                      setForm({
                        ...blank,
                        ...data.scenario,
                        assignedStudentId: data.scenario.assignedStudentId || "",
                        accountPassword: data.scenario.accountPassword || "",
                        securityAnswer: data.scenario.securityAnswer || "",
                      });
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-line bg-white p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h3 className="md:col-span-2 text-lg font-semibold">{editing ? "Edit scenario" : "New scenario"}</h3>
        <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input placeholder="Title" value={form.title} onChange={(e) => set("title", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="First name" value={form.customerFirstName} onChange={(e) => set("customerFirstName", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="Last name" value={form.customerLastName} onChange={(e) => set("customerLastName", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="Account number" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="Password" value={form.accountPassword} onChange={(e) => set("accountPassword", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="Security question" value={form.securityQuestion} onChange={(e) => set("securityQuestion", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Security answer" value={form.securityAnswer} onChange={(e) => set("securityAnswer", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
        <input placeholder="Address" value={form.address} onChange={(e) => set("address", e.target.value)} className="md:col-span-2 rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Gmail" value={form.email} onChange={(e) => set("email", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Mobile" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Current plan" value={form.currentPlan} onChange={(e) => set("currentPlan", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input type="number" placeholder="Monthly fee cents" value={form.monthlyFee} onChange={(e) => set("monthlyFee", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Speed" value={form.internetSpeed} onChange={(e) => set("internetSpeed", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Contract" value={form.contractDuration} onChange={(e) => set("contractDuration", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Service status" value={form.serviceStatus} onChange={(e) => set("serviceStatus", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input type="number" placeholder="Current balance cents" value={form.currentBalance} onChange={(e) => set("currentBalance", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input type="number" placeholder="Outstanding cents" value={form.outstandingBalance} onChange={(e) => set("outstandingBalance", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input placeholder="Due date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <input type="number" placeholder="Previous payment cents" value={form.previousPayment} onChange={(e) => set("previousPayment", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
          <option>Standard</option>
          <option>Complex</option>
          <option>Sensitive</option>
        </select>
        <select value={form.assignedStudentId} onChange={(e) => set("assignedStudentId", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
          <option value="">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.firstName} {s.lastName}
            </option>
          ))}
        </select>
        <textarea placeholder="Customer concern" value={form.concern} onChange={(e) => set("concern", e.target.value)} className="md:col-span-2 rounded-lg border border-line px-3 py-2 text-sm" required />
        <textarea placeholder="Opening statement" value={form.openingStatement} onChange={(e) => set("openingStatement", e.target.value)} className="md:col-span-2 rounded-lg border border-line px-3 py-2 text-sm" />
        <label className="md:col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.transferEnabled} onChange={(e) => set("transferEnabled", e.target.checked)} />
          Allow call transfer for this scenario
        </label>
        <button className="md:col-span-2 rounded-xl bg-navy py-2 text-sm text-white">{editing ? "Update scenario" : "Create scenario"}</button>
      </form>
    </div>
  );
}
