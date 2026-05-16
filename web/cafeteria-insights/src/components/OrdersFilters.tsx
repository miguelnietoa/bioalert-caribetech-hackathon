import { Search } from "lucide-react";
import type { OrderFilters } from "../types";

type Props = {
  filters: OrderFilters;
  onChange: (patch: Partial<OrderFilters>) => void;
  onSearch: () => void;
};

const fieldClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-biofood-primary focus:ring-1 focus:ring-biofood-primary";

export function OrdersFilters({ filters, onChange, onSearch }: Props) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-xs font-medium text-slate-500">
          Fecha inicial
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={filters.fechaInicial}
            onChange={(e) => onChange({ fechaInicial: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Fecha final
          <input
            type="date"
            className={`${fieldClass} mt-1`}
            value={filters.fechaFinal}
            onChange={(e) => onChange({ fechaFinal: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Estado
          <select
            className={`${fieldClass} mt-1`}
            value={filters.estado}
            onChange={(e) => onChange({ estado: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Usuarios
          <input
            className={`${fieldClass} mt-1`}
            placeholder="Buscar usuario"
            value={filters.usuario}
            onChange={(e) => onChange({ usuario: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Producto
          <input
            className={`${fieldClass} mt-1`}
            placeholder="Nombre producto"
            value={filters.producto}
            onChange={(e) => onChange({ producto: e.target.value })}
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Tipo producto
          <select
            className={`${fieldClass} mt-1`}
            value={filters.tipoProducto}
            onChange={(e) => onChange({ tipoProducto: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="fruta">Fruta</option>
            <option value="bebida">Bebida</option>
            <option value="snack">Snack</option>
            <option value="comida">Comida</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Perfil
          <select
            className={`${fieldClass} mt-1`}
            value={filters.perfil}
            onChange={(e) => onChange({ perfil: e.target.value })}
          >
            <option value="">Todos</option>
            <option value="Estudiante">Estudiante</option>
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Curso
          <input
            className={`${fieldClass} mt-1`}
            placeholder="Ej. 5°B"
            value={filters.curso}
            onChange={(e) => onChange({ curso: e.target.value })}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={onSearch}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-biofood-primary px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-biofood-primary-dark"
      >
        <Search className="h-4 w-4" />
        Buscar
      </button>
    </section>
  );
}
