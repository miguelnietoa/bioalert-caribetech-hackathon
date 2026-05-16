import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  Lightbulb,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import type {
  BenchmarkMetric,
  CriticalStockItem,
  DiscontinueSuggestion,
  LaunchSuggestion,
  ParentCrossInsight,
} from "../types";
import { formatCOP, formatPct } from "../utils/format";

type Props = {
  benchmark: BenchmarkMetric[];
  discontinue: DiscontinueSuggestion[];
  launch: LaunchSuggestion[];
  parentInsights: ParentCrossInsight[];
  criticalStock: CriticalStockItem[];
  onDiscontinueAction: (id: string, action: "accepted" | "dismissed") => void;
  onLaunchAction: (id: string, action: "accepted" | "dismissed") => void;
};

function ConfidenceBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-biofood-primary"
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="text-xs font-medium text-slate-500">{value}% conf.</span>
    </span>
  );
}

function TrendIcon({ trend }: { trend: BenchmarkMetric["trend"] }) {
  if (trend === "up") return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
  if (trend === "down") return <ArrowDownRight className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

export function AiInsightsPanel({
  benchmark,
  discontinue: initialDisc,
  launch: initialLaunch,
  parentInsights,
  criticalStock,
  onDiscontinueAction,
  onLaunchAction,
}: Props) {
  const [tab, setTab] = useState<"launch" | "discontinue" | "parents">("launch");
  const [disc, setDisc] = useState(initialDisc);
  const [launch, setLaunch] = useState(initialLaunch);

  const handleDisc = (id: string, action: "accepted" | "dismissed") => {
    setDisc((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: action } : d)),
    );
    onDiscontinueAction(id, action);
  };

  const handleLaunch = (id: string, action: "accepted" | "dismissed") => {
    setLaunch((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: action } : l)),
    );
    onLaunchAction(id, action);
  };

  const pendingDisc = disc.filter((d) => d.status === "pending").length;
  const pendingLaunch = launch.filter((l) => l.status === "pending").length;

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-br from-violet-500 to-biofood-primary p-2 text-white">
            <Sparkles className="h-5 w-5" />
          </span>
          <span>
            <h2 className="text-lg font-bold text-slate-800">
              BioAlert+ Insights IA
            </h2>
            <p className="text-xs text-slate-500">
              EXT-3 benchmark · EXT-5 señales padres · predicción de menú
            </p>
          </span>
        </span>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        {benchmark.map((b) => (
          <article
            key={b.label}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <p className="flex items-center justify-between text-xs font-medium text-slate-500">
              {b.label}
              <TrendIcon trend={b.trend} />
            </p>
            <p className="mt-2 text-lg font-bold text-slate-800">
              {b.unit === "COP"
                ? formatCOP(b.schoolValue)
                : `${b.schoolValue}${b.unit === "%" ? "%" : ""}`}
              <span className="ml-2 text-sm font-normal text-slate-400">
                vs{" "}
                {b.unit === "COP"
                  ? formatCOP(b.nationalAvg)
                  : `${b.nationalAvg}${b.unit === "%" ? "%" : ""}`}{" "}
                nacional
              </span>
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              {b.insight}
            </p>
          </article>
        ))}
      </section>

      {criticalStock.length > 0 && (
        <aside className="flex flex-wrap items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Stock crítico (US-05):</strong>{" "}
            {criticalStock
              .map(
                (s) =>
                  `${s.productName} (${s.currentStock}/${s.minimumStock})`,
              )
              .join(" · ")}
          </span>
        </aside>
      )}

      <nav className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["launch", `Agregar al menú (${pendingLaunch})`, TrendingUp],
            ["discontinue", `Descontinuar (${pendingDisc})`, TrendingDown],
            ["parents", "Señales padres", Lightbulb],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${
              tab === key
                ? "bg-white text-biofood-primary shadow-sm"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </nav>

      {tab === "launch" && (
        <ul className="space-y-3">
          {launch.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                item.status === "pending"
                  ? "border-emerald-100 bg-white shadow-sm"
                  : item.status === "accepted"
                    ? "border-emerald-300 bg-emerald-50/50 opacity-90"
                    : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <h3 className="font-semibold text-slate-800">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Similar a «{item.similarTo}» · {item.category} ·{" "}
                    {item.peersAdoptionPct}% colegios pares ya lo tienen
                  </p>
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
                  {item.predictedSuccessPct}% éxito previsto
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
              <p className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                <span>~{item.predictedWeeklyUnits} u/semana</span>
                <span>{formatCOP(item.predictedRevenueCOP)} proyectado</span>
                <ConfidenceBar value={item.confidence} />
              </p>
              {item.status === "pending" ? (
                <span className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunch(item.id, "accepted")}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Agregar a pedido proveedor
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLaunch(item.id, "dismissed")}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Descartar
                  </button>
                </span>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {item.status === "accepted"
                    ? "✓ Aceptado — se incluirá en próximo pedido"
                    : "Descartado"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "discontinue" && (
        <ul className="space-y-3">
          {disc.map((item) => (
            <li
              key={item.id}
              className={`rounded-2xl border p-4 transition ${
                item.status === "pending"
                  ? "border-amber-100 bg-white shadow-sm"
                  : item.status === "accepted"
                    ? "border-amber-300 bg-amber-50/50 opacity-90"
                    : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  <h3 className="font-semibold text-slate-800">
                    {item.productName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {item.category} · {item.weeklyUnits} u/sem ·{" "}
                    {formatCOP(item.weeklyRevenueCOP)}
                  </p>
                </span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-800">
                  {formatPct(item.declinePct)} ventas
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{item.reason}</p>
              <ConfidenceBar value={item.confidence} />
              {item.status === "pending" ? (
                <span className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDisc(item.id, "accepted")}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Descontinuar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDisc(item.id, "dismissed")}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Mantener en menú
                  </button>
                </span>
              ) : (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {item.status === "accepted"
                    ? "✓ Marcado para descontinuar"
                    : "Se mantiene en menú"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {tab === "parents" && (
        <ul className="space-y-3">
          {parentInsights.map((pi) => (
            <li
              key={pi.id}
              className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Insight cruzado EXT-5
              </p>
              <h3 className="mt-1 font-semibold text-slate-800">
                {pi.count} {pi.signal}
              </h3>
              <p className="text-xs text-slate-500">{pi.period}</p>
              <p className="mt-2 text-sm text-slate-700">{pi.recommendation}</p>
              <p className="mt-2 text-xs font-medium text-emerald-700">
                {pi.impactEstimate}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
