"use client";

import { useEffect, useState } from "react";
import { Download, Printer } from "lucide-react";
import { Pill } from "@/components/ui";
import { api, fileToDataUrl } from "@/lib/client";
import { formatDate } from "@/lib/utils";
import type { CertificateRow } from "@/lib/types";

export function CertificateGallery({
  teacherMode,
}: {
  teacherMode?: boolean;
}) {
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [active, setActive] = useState<CertificateRow | null>(null);
  const [students, setStudents] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [form, setForm] = useState({
    studentId: "",
    title: "",
    type: "training",
    description: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  async function reload() {
    const data = await api<{ certificates: CertificateRow[] }>("/api/certificates");
    setRows(data.certificates);
  }

  useEffect(() => {
    reload().catch((e: Error) => setMessage(e.message));
    if (teacherMode) {
      api<{ students: { id: string; firstName: string; lastName: string }[] }>("/api/students")
        .then((d) => {
          setStudents(d.students);
          if (d.students[0]) setForm((f) => ({ ...f, studentId: d.students[0].id }));
        })
        .catch(() => undefined);
    }
  }, [teacherMode]);

  async function issue() {
    setMessage("");
    let fileName: string | undefined;
    let fileMime: string | undefined;
    let fileData: string | undefined;
    if (file) {
      fileName = file.name;
      fileMime = file.type;
      fileData = await fileToDataUrl(file);
    }
    await api("/api/certificates", {
      method: "POST",
      body: JSON.stringify({ ...form, fileName, fileMime, fileData }),
    });
    setForm((f) => ({ ...f, title: "", description: "" }));
    setFile(null);
    setMessage("Certificate issued to the student account.");
    reload();
  }

  async function download(row: CertificateRow) {
    const data = await api<{ certificate: CertificateRow }>(`/api/certificates/${row.id}`);
    if (data.certificate.fileData) {
      const a = document.createElement("a");
      a.href = data.certificate.fileData;
      a.download = data.certificate.fileName || `${row.title}.bin`;
      a.click();
      return;
    }
    setActive({ ...row, ...data.certificate });
    setTimeout(() => window.print(), 250);
  }

  return (
    <div className="space-y-5">
      {teacherMode && (
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold">Upload / issue certificate</h3>
          <p className="text-sm text-muted">Push training, completion, or achievement certificates to a student account.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">
              Student
              <select
                value={form.studentId}
                onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Type
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              >
                <option value="training">Training certificate</option>
                <option value="completion">Completion certificate</option>
                <option value="achievement">Achievement certificate</option>
              </select>
            </label>
            <label className="text-sm md:col-span-2">
              Title
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Description
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2"
                rows={3}
              />
            </label>
            <label className="text-sm md:col-span-2">
              Optional file upload
              <input type="file" className="mt-1 block w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <button onClick={issue} className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm text-white">
            Issue to student
          </button>
          {message && <p className="mt-2 text-sm text-accent-2">{message}</p>}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => (
          <article key={c.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <Pill tone={c.type === "achievement" ? "warn" : c.type === "completion" ? "ok" : "teal"}>
              {c.type} certificate
            </Pill>
            <h3 className="mt-3 text-lg font-semibold">{c.title}</h3>
            <p className="mt-1 text-sm text-muted">{c.description}</p>
            <p className="mt-3 text-xs text-muted">
              {c.studentName} · issued {formatDate(c.issuedAt)} by {c.issuerName}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => download(c)}
                className="inline-flex items-center gap-1 rounded-lg bg-accent-2 px-3 py-1.5 text-xs font-medium text-white"
              >
                <Download className="h-3.5 w-3.5" />
                Download / print
              </button>
              <button onClick={() => setActive(c)} className="inline-flex items-center gap-1 rounded-lg bg-canvas px-3 py-1.5 text-xs">
                <Printer className="h-3.5 w-3.5" />
                View
              </button>
            </div>
          </article>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">No certificates issued yet.</p>}
      </div>

      {active && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-navy/80 p-4 no-print">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex justify-end gap-2">
              <button onClick={() => window.print()} className="rounded-lg bg-white px-3 py-1.5 text-sm">
                Print
              </button>
              <button onClick={() => setActive(null)} className="rounded-lg bg-white px-3 py-1.5 text-sm">
                Close
              </button>
            </div>
            <CertificateSheet cert={active} />
          </div>
        </div>
      )}
      {active && (
        <div className="hidden print:block">
          <CertificateSheet cert={active} />
        </div>
      )}
    </div>
  );
}

function CertificateSheet({ cert }: { cert: CertificateRow }) {
  return (
    <article className="print-sheet relative overflow-hidden rounded-sm border-[12px] border-navy bg-[#fbf7ee] p-10 text-center shadow-2xl">
      <img src="/images/certificate-seal.png" alt="" className="absolute right-8 top-8 h-24 w-24 object-contain opacity-90" />
      <p className="text-xs uppercase tracking-[0.35em] text-accent-2">AetherLink Communications</p>
      <h2 className="mt-3 font-serif text-4xl text-navy">Certificate of {cert.type === "achievement" ? "Achievement" : cert.type === "completion" ? "Completion" : "Training"}</h2>
      <p className="mt-6 text-sm text-muted">This certifies that</p>
      <p className="mt-2 font-serif text-3xl text-ink">{cert.studentName}</p>
      <p className="mt-1 font-mono text-xs text-muted">{cert.studentAgentId}</p>
      <p className="mx-auto mt-6 max-w-xl text-sm leading-6 text-ink/80">{cert.description}</p>
      <p className="mt-4 text-lg font-semibold text-navy">{cert.title}</p>
      <div className="mt-10 flex items-end justify-between px-8 text-sm">
        <div>
          <p className="font-medium">{cert.issuerName}</p>
          <p className="text-xs text-muted">Workforce Coach</p>
        </div>
        <div>
          <p className="font-medium">{formatDate(cert.issuedAt)}</p>
          <p className="text-xs text-muted">Date issued</p>
        </div>
      </div>
    </article>
  );
}
