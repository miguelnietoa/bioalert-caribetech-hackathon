import {
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  Home,
  Mail,
  Users,
  UtensilsCrossed,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", active: false },
  { label: "Usuarios", active: true },
  { label: "Inventario", active: false },
  { label: "Producción", active: false },
  { label: "Reportes", active: false },
  { label: "Configuración", active: false },
  { label: "Nómina", active: false },
  { label: "Desembolsos", active: false },
];

type Props = {
  collapsed: boolean;
  schoolName: string;
  onToggle: () => void;
};

export function Sidebar({ collapsed, schoolName, onToggle }: Props) {
  return (
    <aside className="flex h-screen shrink-0">
      <div className="flex w-12 flex-col items-center gap-6 bg-biofood-sidebar py-4 text-white">
        <Fingerprint className="h-5 w-5 opacity-90" />
        <Home className="h-5 w-5 opacity-70 hover:opacity-100" />
        <Mail className="h-5 w-5 opacity-70 hover:opacity-100" />
        <div className="flex-1" />
        <UtensilsCrossed className="h-5 w-5 opacity-70 hover:opacity-100" />
      </div>

      <div
        className={`flex flex-col border-r border-slate-200 bg-white transition-all ${
          collapsed ? "w-16" : "w-56"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-biofood-primary to-biofood-accent text-xs font-bold text-white">
            BF
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold leading-tight text-slate-800">
              {schoolName}
            </span>
          )}
        </div>

        {!collapsed && (
          <p className="px-4 pt-4 text-[10px] font-semibold tracking-wider text-slate-400">
            MENÚ
          </p>
        )}

        <nav className="flex-1 space-y-0.5 px-2 py-2">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition ${
                item.active
                  ? "bg-biofood-primary text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
              {!collapsed && item.active && (
                <ChevronRight className="h-4 w-4 opacity-80" />
              )}
            </button>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t border-slate-100 p-3">
          <Users className="h-5 w-5 text-slate-400" />
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg bg-biofood-primary p-1.5 text-white hover:bg-biofood-primary-dark"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            <ChevronLeft
              className={`h-4 w-4 transition ${collapsed ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>
    </aside>
  );
}
