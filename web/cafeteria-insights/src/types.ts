export type OrderStatus = "pendiente" | "entregado" | "cancelado";

export interface OrderRow {
  id: string;
  fecha: string;
  usuario: string;
  curso: string;
  perfil: string;
  total: number;
  estado: OrderStatus;
}

export interface SummaryMetrics {
  ventasCOP: number;
  pedidos: number;
  pedidosPendientes: number;
  ticketPromedioCOP: number;
}

export interface BenchmarkMetric {
  label: string;
  schoolValue: number;
  nationalAvg: number;
  unit: "%" | "COP" | "unidades";
  trend: "up" | "down" | "flat";
  insight: string;
}

export interface DiscontinueSuggestion {
  id: string;
  productName: string;
  category: string;
  weeklyUnits: number;
  weeklyRevenueCOP: number;
  declinePct: number;
  confidence: number;
  reason: string;
  status: "pending" | "accepted" | "dismissed";
}

export interface LaunchSuggestion {
  id: string;
  productName: string;
  similarTo: string;
  category: string;
  predictedSuccessPct: number;
  predictedWeeklyUnits: number;
  predictedRevenueCOP: number;
  peersAdoptionPct: number;
  confidence: number;
  reason: string;
  status: "pending" | "accepted" | "dismissed";
}

export interface ParentCrossInsight {
  id: string;
  signal: string;
  count: number;
  period: string;
  recommendation: string;
  impactEstimate: string;
}

export interface CriticalStockItem {
  productName: string;
  currentStock: number;
  minimumStock: number;
}

export interface CafeteriaInsightsPayload {
  schoolName: string;
  schoolNit: string;
  generatedAt: string;
  dataSource: "live" | "mock";
  summary: SummaryMetrics;
  orders: OrderRow[];
  benchmark: BenchmarkMetric[];
  discontinue: DiscontinueSuggestion[];
  launch: LaunchSuggestion[];
  parentInsights: ParentCrossInsight[];
  criticalStock: CriticalStockItem[];
}

export interface OrderFilters {
  fechaInicial: string;
  fechaFinal: string;
  estado: string;
  usuario: string;
  producto: string;
  tipoProducto: string;
  perfil: string;
  curso: string;
}
