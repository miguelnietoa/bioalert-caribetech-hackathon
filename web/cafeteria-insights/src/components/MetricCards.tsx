import { BarChart3, Clock, ShoppingBag } from "lucide-react";
import type { SummaryMetrics } from "../types";
import { formatCOP } from "../utils/format";

type Props = { summary: SummaryMetrics };

export function MetricCards({ summary }: Props) {
  const cards = [
    { label: "Ventas", value: formatCOP(summary.ventasCOP), icon: BarChart3 },
    { label: "Pedidos", value: String(summary.pedidos), icon: ShoppingBag },
    {
      label: "Pedidos Pendientes",
      value: String(summary.pedidosPendientes),
      icon: Clock,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon }) => (
        <article
          key={label}
          className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
        >
          <span className="rounded-xl bg-blue-50 p-3 text-biofood-primary">
            <Icon className="h-6 w-6" />
          </span>
          <span>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-sm text-slate-500">{label}</p>
          </span>
        </article>
      ))}
    </section>
  );
}
