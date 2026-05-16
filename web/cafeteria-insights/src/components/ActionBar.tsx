type Props = { selectedCount: number };

const actions = [
  { label: "Imprimir", className: "bg-biofood-primary hover:bg-biofood-primary-dark" },
  { label: "Entregar", className: "bg-teal-500 hover:bg-teal-600" },
  { label: "Cancelar Orden", className: "bg-red-500 hover:bg-red-600" },
  { label: "Exportar Excel", className: "bg-sky-400 hover:bg-sky-500" },
  { label: "config impresión", className: "bg-cyan-500 hover:bg-cyan-600" },
  { label: "Agrupado Producto", className: "bg-cyan-300 text-slate-800 hover:bg-cyan-400" },
];

export function ActionBar({ selectedCount }: Props) {
  return (
    <section className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          disabled={a.label !== "Exportar Excel" && selectedCount === 0}
          className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${a.className}`}
        >
          {a.label}
        </button>
      ))}
    </section>
  );
}
