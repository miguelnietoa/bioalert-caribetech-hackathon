import { Bot, Database } from "lucide-react";

type Props = {
  source: "live" | "mock";
  error?: string;
  generatedAt: string;
};

export function DataSourceBadge({ source, error, generatedAt }: Props) {
  const isMock = source === "mock";
  const time = new Date(generatedAt).toLocaleString("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <aside
      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
        isMock
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      {isMock ? (
        <Database className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <Bot className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="font-medium">
        {isMock
          ? "Datos demo (mock) — conecta VITE_BIOALERT_API_URL para datos del bot"
          : "Datos en vivo desde BioAlert+ API"}
      </span>
      <span className="text-slate-500">· Actualizado {time}</span>
      {error && (
        <span className="w-full text-amber-700">
          Fallback mock: {error}
        </span>
      )}
    </aside>
  );
}
