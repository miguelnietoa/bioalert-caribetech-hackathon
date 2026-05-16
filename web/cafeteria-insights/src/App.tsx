import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchCafeteriaInsights } from "./api/cafeteriaApi";
import { ActionBar } from "./components/ActionBar";
import { AiInsightsPanel } from "./components/AiInsightsPanel";
import { DataSourceBadge } from "./components/DataSourceBadge";
import { MetricCards } from "./components/MetricCards";
import { OrdersFilters } from "./components/OrdersFilters";
import { OrdersTable } from "./components/OrdersTable";
import { Sidebar } from "./components/Sidebar";
import type {
  CafeteriaInsightsPayload,
  OrderFilters,
  OrderRow,
} from "./types";

const today = new Date().toISOString().slice(0, 10);

const defaultFilters: OrderFilters = {
  fechaInicial: today,
  fechaFinal: today,
  estado: "",
  usuario: "",
  producto: "",
  tipoProducto: "",
  perfil: "",
  curso: "",
};

function filterOrders(orders: OrderRow[], filters: OrderFilters): OrderRow[] {
  return orders.filter((o) => {
    if (filters.estado && o.estado !== filters.estado) return false;
    if (
      filters.usuario &&
      !o.usuario.toLowerCase().includes(filters.usuario.toLowerCase())
    ) {
      return false;
    }
    if (
      filters.curso &&
      !o.curso.toLowerCase().includes(filters.curso.toLowerCase())
    ) {
      return false;
    }
    if (filters.perfil && o.perfil !== filters.perfil) return false;
    return true;
  });
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [payload, setPayload] = useState<CafeteriaInsightsPayload | null>(null);
  const [source, setSource] = useState<"live" | "mock">("mock");
  const [fetchError, setFetchError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [appliedFilters, setAppliedFilters] =
    useState<OrderFilters>(defaultFilters);
  const [tableSearch, setTableSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchCafeteriaInsights();
    setPayload(result.data);
    setSource(result.source);
    setFetchError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredOrders = useMemo(() => {
    if (!payload) return [];
    return filterOrders(payload.orders, appliedFilters);
  }, [payload, appliedFilters]);

  const handleAiAction = useCallback(
    (type: "discontinue" | "launch", id: string, action: string) => {
      console.log(
        JSON.stringify({
          event: "ai_insight_action",
          type,
          id,
          action,
          schoolNit: payload?.schoolNit,
        }),
      );
    },
    [payload?.schoolNit],
  );

  if (loading || !payload) {
    return (
      <p className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando insights de cafetería…
      </p>
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-biofood-bg">
      <Sidebar
        collapsed={sidebarCollapsed}
        schoolName={payload.schoolName}
        onToggle={() => setSidebarCollapsed((c) => !c)}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-800">Ordenes</h1>
          <p className="mt-1 text-sm text-slate-500">
            Operación diaria + recomendaciones predictivas BioAlert+
          </p>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-5 p-6">
          <DataSourceBadge
            source={source}
            error={fetchError}
            generatedAt={payload.generatedAt}
          />

          <MetricCards summary={payload.summary} />

          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-md ring-1 ring-violet-50">
            <AiInsightsPanel
              benchmark={payload.benchmark}
              discontinue={payload.discontinue}
              launch={payload.launch}
              parentInsights={payload.parentInsights}
              criticalStock={payload.criticalStock}
              onDiscontinueAction={(id, action) =>
                handleAiAction("discontinue", id, action)
              }
              onLaunchAction={(id, action) =>
                handleAiAction("launch", id, action)
              }
            />
          </section>

          <OrdersFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onSearch={() => setAppliedFilters({ ...filters })}
          />

          <ActionBar selectedCount={0} />

          <label className="flex max-w-xs items-center gap-2 text-sm text-slate-600">
            Buscar en tabla
            <input
              className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
              placeholder="Usuario, curso, ID…"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
            />
          </label>

          <OrdersTable orders={filteredOrders} searchTerm={tableSearch} />
          </div>
        </div>
      </main>
    </div>
  );
}
