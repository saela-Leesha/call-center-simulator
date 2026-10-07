"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Panel, Pill } from "@/components/ui";
import { api } from "@/lib/client";
import { formatCurrency } from "@/lib/utils";
import type { CategoryRow, ScenarioRow } from "@/lib/types";

type StudentOpt = { id: string; firstName: string; lastName: string; agentId: string | null };

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
  billingStatus: "Current",
  currentBalance: 3999,
  outstandingBalance: 0,
  dueDate: "",
  previousPayment: 3999,
  concern: "",
  openingStatement: "",
  transferEnabled: true,
  assignedStudentId: "",
};

const BILLING_STATUS = ["Current", "Past due", "Partial payment", "In collections", "Promo expiring"];

export default function CustomerManagementPage() {
  const [rows, setRows] = useState<ScenarioRow[]>([]);
  const [cats, setCats] = useState<CategoryRow[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  const visible = useMemo(
    () => (filter === "all" ? rows : rows.filter((r) => r.categoryId === filter)),
    [rows, filter],
  );

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setError("");
    setMessage("");
    const payload = { ...form, assignedStudentId: form.assignedStudentId || null };
    try {
      if (editing) {
        await api(`/api/scenarios/${editing}`, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Customer profile updated — students see the change immediately.");
      } else {
        await api("/api/scenarios", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Customer profile created and pushed to the student queue.");
      }
      setEditing(null);
      setForm({ ...blank, categoryId: cats[0]?.id || "" });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function toggleActive(s: ScenarioRow) {
    await api(`/api/scenarios/${s.id}`, {
      method: "PUT",
      body: JSON.stringify({ ...s, isActive: !s.isActive, assignedStudentId: s.assignedStudentId }),
    });
    setMessage(`${s.customerFirstName} ${s.customerLastName} is now ${!s.isActive ? "active" : "hidden"} from students.`);
    reload();
  }

  async function remove(id: string) {
    await api(`/api/scenarios/${id}`, { method: "DELETE" });
    setMessage("Customer profile deleted.");
    reload();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Simulation library</p>
          <h2 className="text-2xl font-semibold">Customer Management</h2>
          <p className="text-sm text-muted">
            Build customer profiles, internet service details, and scenario types. Assign them to
            students — every change appears instantly on the student dashboard.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setForm({ ...blank, categoryId: cats[0]?.id || "" });
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> New customer profile
        </button>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-danger">{error}</p>}
      {message && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-accent-2">{message}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === "all" ? "bg-navy text-white" : "bg-white ring-1 ring-line"}`}
        >
          All ({rows.length})
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilter(c.id)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${filter === c.id ? "bg-navy text-white" : "bg-white ring-1 ring-line"}`}
          >
            {c.name} ({rows.filter((r) => r.categoryId === c.id).length})
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          {visible.map((s) => (
            <article key={s.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide" style={{ color: s.categoryColor }}>
                    {s.categoryName}
                  </p>
                  <h3 className="mt-0.5 text-base font-semibold">
                    {s.customerFirstName} {s.customerLastName}
                  </h3>
                  <p className="font-mono text-xs text-muted">{s.accountNumber}</p>
                  <p className="mt-1 text-sm text-muted">{s.concern}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Pill tone={s.isActive ? "ok" : "slate"}>{s.isActive ? "Active" : "Deactivated"}</Pill>
                  <Pill tone={s.difficulty === "Complex" ? "danger" : s.difficulty === "Sensitive" ? "warn" : "teal"}>
                    {s.difficulty}
                  </Pill>
                  <Pill tone={s.billingStatus === "Current" ? "ok" : "warn"}>{s.billingStatus}</Pill>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
                <p>Plan<span className="mt-0.5 block font-medium text-ink">{s.currentPlan}</span></p>
                <p>Monthly<span className="mt-0.5 block font-mono font-medium text-ink">{formatCurrency(s.monthlyFee)}</span></p>
                <p>Speed<span className="mt-0.5 block font-medium text-ink">{s.internetSpeed}</span></p>
                <p>Contract<span className="mt-0.5 block font-medium text-ink">{s.contractDuration}</span></p>
                <p>Outstanding<span className="mt-0.5 block font-mono font-medium text-ink">{formatCurrency(s.outstandingBalance)}</span></p>
                <p>Assigned<span className="mt-0.5 block font-medium text-ink">{s.assignedStudentName ?? "All students"}</span></p>
                <p>Transfer<span className="mt-0.5 block font-medium text-ink">{s.transferEnabled ? "Enabled" : "Locked"}</span></p>
                <p>Service<span className="mt-0.5 block font-medium text-ink">{s.serviceStatus}</span></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    const data = await api<{ scenario: ScenarioRow }>(`/api/scenarios/${s.id}`);
                    setEditing(s.id);
                    setForm({
                      ...blank,
                      ...data.scenario,
                      assignedStudentId: data.scenario.assignedStudentId || "",
                      accountPassword: data.scenario.accountPassword || "",
                      securityAnswer: data.scenario.securityAnswer || "",
                      transferEnabled: data.scenario.transferEnabled !== false,
                    });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="text-xs font-medium text-accent-2"
                >
                  Edit profile
                </button>
                <button onClick={() => toggleActive(s)} className="inline-flex items-center gap-1 text-xs text-muted">
                  <RefreshCw className="h-3 w-3" /> {s.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => remove(s.id)} className="inline-flex items-center gap-1 text-xs text-danger">
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="text-sm text-muted">No customers in this queue yet.</p>}
        </div>

        <form
          className="h-fit space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <h3 className="text-lg font-semibold">{editing ? "Edit customer profile" : "New customer profile"}</h3>

          <p className="text-[11px] uppercase tracking-wide text-muted">Scenario</p>
          <select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input placeholder="Scenario title" value={form.title} onChange={(e) => set("title", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" required />
          <select value={form.difficulty} onChange={(e) => set("difficulty", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option>Standard</option>
            <option>Complex</option>
            <option>Sensitive</option>
          </select>
          <select value={form.assignedStudentId} onChange={(e) => set("assignedStudentId", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
            <option value="">Assign to all students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.agentId})
              </option>
            ))}
          </select>

          <p className="pt-2 text-[11px] uppercase tracking-wide text-muted">Customer information</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="First name" value={form.customerFirstName} onChange={(e) => set("customerFirstName", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
            <input placeholder="Last name" value={form.customerLastName} onChange={(e) => set("customerLastName", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" required />
          </div>
          <input placeholder="Account number (e.g. AL-12345678)" value={form.accountNumber} onChange={(e) => set("accountNumber", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 font-mono text-sm" required />
          <input placeholder="Account password" value={form.accountPassword} onChange={(e) => set("accountPassword", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" required />
          <input placeholder="Security question" value={form.securityQuestion} onChange={(e) => set("securityQuestion", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <input placeholder="Security answer" value={form.securityAnswer} onChange={(e) => set("securityAnswer", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" required />
          <input placeholder="Service address" value={form.address} onChange={(e) => set("address", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <input placeholder="Gmail address" value={form.email} onChange={(e) => set("email", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <input placeholder="Mobile number" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />

          <p className="pt-2 text-[11px] uppercase tracking-wide text-muted">Internet service details</p>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Current plan" value={form.currentPlan} onChange={(e) => set("currentPlan", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            <input type="number" placeholder="Monthly fee (cents)" value={form.monthlyFee} onChange={(e) => set("monthlyFee", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 font-mono text-sm" />
            <input placeholder="Internet speed" value={form.internetSpeed} onChange={(e) => set("internetSpeed", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            <input placeholder="Contract duration" value={form.contractDuration} onChange={(e) => set("contractDuration", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            <select value={form.billingStatus} onChange={(e) => set("billingStatus", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm">
              {BILLING_STATUS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            <input type="number" placeholder="Outstanding balance (cents)" value={form.outstandingBalance} onChange={(e) => set("outstandingBalance", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 font-mono text-sm" />
            <input type="number" placeholder="Current balance (cents)" value={form.currentBalance} onChange={(e) => set("currentBalance", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 font-mono text-sm" />
            <input placeholder="Due date (YYYY-MM-DD)" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            <input type="number" placeholder="Previous payment (cents)" value={form.previousPayment} onChange={(e) => set("previousPayment", Number(e.target.value))} className="rounded-lg border border-line px-3 py-2 font-mono text-sm" />
            <input placeholder="Service status" value={form.serviceStatus} onChange={(e) => set("serviceStatus", e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
          </div>

          <p className="pt-2 text-[11px] uppercase tracking-wide text-muted">Simulation script</p>
          <textarea placeholder="Customer concern" value={form.concern} onChange={(e) => set("concern", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" required />
          <textarea placeholder="Opening statement the customer speaks on the call" value={form.openingStatement} onChange={(e) => set("openingStatement", e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.transferEnabled} onChange={(e) => set("transferEnabled", e.target.checked)} />
            Allow call transfer for this scenario
          </label>

          <button className="w-full rounded-xl bg-accent-2 py-2.5 text-sm font-semibold text-white">
            {editing ? "Update customer profile" : "Create customer profile"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm({ ...blank, categoryId: cats[0]?.id || "" });
              }}
              className="w-full rounded-xl bg-canvas py-2 text-sm"
            >
              Cancel edit
            </button>
          )}
        </form>
      </div>

      <Panel title="Scenario types (editable by teachers)">
        <div className="grid gap-3 md:grid-cols-2">
          {cats.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
              <div>
                <p className="text-sm font-medium" style={{ color: c.color }}>
                  {c.name}
                </p>
                <p className="text-xs text-muted">{c.description}</p>
              </div>
              <Pill tone={c.isActive ? "ok" : "slate"}>{c.isActive ? "Live" : "Hidden"}</Pill>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
