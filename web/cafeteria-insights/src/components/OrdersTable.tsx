import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import type { OrderRow } from "../types";
import { formatCOP } from "../utils/format";

type Props = {
  orders: OrderRow[];
  searchTerm: string;
};

const statusStyles: Record<OrderRow["estado"], string> = {
  pendiente: "bg-amber-100 text-amber-800",
  entregado: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-700",
};

export function OrdersTable({ orders, searchTerm }: Props) {
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.usuario.toLowerCase().includes(q) ||
        o.curso.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q),
    );
  }, [orders, searchTerm]);

  const visible = filtered.slice(0, pageSize);

  const toggleAll = () => {
    if (selected.size === visible.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((o) => o.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Mostrar
          <select
            className="rounded border border-slate-200 px-2 py-1"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          registros
        </label>
        <p className="text-xs text-slate-400">
          {selected.size > 0
            ? `${selected.size} seleccionados`
            : `${filtered.length} órdenes`}
        </p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={
                    visible.length > 0 && selected.size === visible.length
                  }
                  onChange={toggleAll}
                  aria-label="Seleccionar todos"
                />
              </th>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Curso</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Ver más</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((order) => (
              <tr
                key={order.id}
                className="border-t border-slate-50 hover:bg-slate-50/80"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggleOne(order.id)}
                    aria-label={`Seleccionar ${order.usuario}`}
                  />
                </td>
                <td className="px-4 py-3 text-slate-600">{order.fecha}</td>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {order.usuario}
                </td>
                <td className="px-4 py-3">{order.curso}</td>
                <td className="px-4 py-3">{order.perfil}</td>
                <td className="px-4 py-3 font-medium">
                  {formatCOP(order.total)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[order.estado]}`}
                  >
                    {order.estado}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-biofood-primary hover:underline"
                    title="Ver detalle"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">
          No hay órdenes con los filtros actuales.
        </p>
      )}
    </section>
  );
}
