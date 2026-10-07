"use client";

import { useCallback, useEffect, useState } from "react";
import { QueueBoard } from "@/components/QueueBoard";
import { api } from "@/lib/client";
import type { CallRow, CategoryRow, ScenarioRow } from "@/lib/types";

export default function CustomerCallsPage() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [calls, setCalls] = useState<CallRow[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, s, k] = await Promise.all([
        api<{ categories: CategoryRow[] }>("/api/categories"),
        api<{ scenarios: ScenarioRow[] }>("/api/scenarios"),
        api<{ calls: CallRow[] }>("/api/calls"),
      ]);
      setCategories(c.categories.filter((x) => x.isActive));
      setScenarios(s.scenarios);
      setCalls(k.calls);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load the queue");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted">Softphone · skill queue 14</p>
          <h2 className="text-2xl font-semibold">Customer Calls</h2>
          <p className="text-sm text-muted">
            Voice-only inbound simulation. Answer with your headset — there is no chat channel.
          </p>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-danger">{error}</p>}

      <QueueBoard
        categories={categories}
        scenarios={scenarios}
        calls={calls}
        onRefresh={load}
      />
    </div>
  );
}
