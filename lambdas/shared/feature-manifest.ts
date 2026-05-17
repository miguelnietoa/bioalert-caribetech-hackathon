// Único punto de verdad para qué features expone el catálogo demo.
// El backend (demo-trigger Lambda) y el frontend (catalog HTML) consumen este manifest.
// Si agregás un feature acá, también hay que replicarlo en web/feature-catalog/app.js
// (no se puede importar TS desde vanilla JS sin un build step).

export type FeatureKind = 'conversational_parent' | 'conversational_admin' | 'cron' | 'view_only'

export interface FeatureSpec {
  id: string
  kind: FeatureKind
  title: string
  description: string
  cobertura: string // "US-XX" | "EXT-X" | combinación
  // Para conversacionales: el mensaje que se simula desde el padre/admin
  whatsapp_text?: string
  // Para conversacionales: a qué teléfono se simula que escribe
  as_phone?: string
  // Para crons: el FunctionName completo en AWS
  lambda_function?: string
  // Para vistas (link directo): ruta relativa al S3 bucket
  view_path?: string
}

export const DEFAULT_PARENT_PHONE = '+573046002689'   // Diana (Miguel), parent en parent_phone_map
export const DEFAULT_ADMIN_PHONE = '+573046002689'    // Miguel también es admin del colegio 680

export const FEATURES: FeatureSpec[] = [
  // ── Conversacional · Padre ──
  {
    id: 'consumption_today',
    kind: 'conversational_parent',
    title: '¿Qué comió hoy?',
    description: 'Lista de compras del estudiante hoy (timezone Bogotá), con hora, producto y monto.',
    cobertura: 'US-01',
    whatsapp_text: '¿qué comió Mateo hoy?',
  },
  {
    id: 'consumption_week',
    kind: 'conversational_parent',
    title: 'Resumen de la semana',
    description: 'Top productos + número de compras + gasto total últimos 7 días.',
    cobertura: 'US-01 ext',
    whatsapp_text: '¿y esta semana cómo le fue?',
  },
  {
    id: 'nutrition_summary',
    kind: 'conversational_parent',
    title: 'Análisis nutricional',
    description: 'Azúcar, calorías, grasa y sodio acumulados con peso por unidad real.',
    cobertura: 'EXT-2',
    whatsapp_text: '¿está comiendo mucha azúcar Mateo?',
  },
  {
    id: 'compare_peers',
    kind: 'conversational_parent',
    title: 'Vs. compañeros',
    description: 'Comparación con el promedio del colegio en ticket y % dulce.',
    cobertura: 'EXT-2',
    whatsapp_text: '¿Mateo come más azúcar que sus compañeros?',
  },
  {
    id: 'balance_projection',
    kind: 'conversational_parent',
    title: 'Saldo + proyección',
    description: 'Saldo actual y días estimados antes de agotamiento.',
    cobertura: 'US-04',
    whatsapp_text: '¿cuánto saldo le queda a Mateo?',
  },
  {
    id: 'recharge_recommendations',
    kind: 'conversational_parent',
    title: '3 opciones de recarga',
    description: 'Anchoring con Esencial / Equilibrada / Bienestar, narrativa data-driven.',
    cobertura: 'EXT-1',
    whatsapp_text: '¿cuánto le recargo?',
  },
  {
    id: 'wompi_checkout',
    kind: 'conversational_parent',
    title: 'Confirmar recarga → Wompi',
    description: 'El padre elige una opción y el bot envía link de pago Wompi (sandbox).',
    cobertura: 'EXT-1 + Wompi',
    whatsapp_text: 'voy con la equilibrada',
    view_path: 'wompi-mock/index.html',
  },

  // ── Conversacional · Admin cafetería ──
  // NOTA: Diana (DEFAULT_ADMIN_PHONE) está en parent_phone_map Y cafeteria_admins.
  // El handler usa UNION ALL ... LIMIT 1 sin ORDER BY → resuelve como parent.
  // Workaround: el demo-trigger agrega un prefix "Como admin de cafetería, ..." al
  // mensaje para forzar el contexto via Claude, aunque la identidad técnica siga parent.
  {
    id: 'school_alerts',
    kind: 'conversational_admin',
    title: 'Stock crítico',
    description: 'Lista de productos por debajo del mínimo configurado.',
    cobertura: 'US-05',
    whatsapp_text: '¿qué tengo en stock crítico hoy?',
    as_phone: DEFAULT_ADMIN_PHONE,
  },
  {
    id: 'cafeteria_benchmark',
    kind: 'conversational_admin',
    title: 'Benchmark vs otros colegios',
    description: 'Comparación con promedio nacional + productos saludables faltantes.',
    cobertura: 'EXT-3',
    whatsapp_text: '¿cómo voy vs otros colegios?',
    as_phone: DEFAULT_ADMIN_PHONE,
    view_path: 'cafeteria-insights/index.html',
  },

  // ── Crons (event-driven) ──
  {
    id: 'allergen_polling',
    kind: 'cron',
    title: 'Alerta de alérgeno',
    description: 'Cada 60s: detecta ventas nuevas con productos que contienen alérgenos del estudiante. <30s al padre.',
    cobertura: 'US-03',
    lambda_function: 'bioalert-hackathon-allergen-polling',
  },
  {
    id: 'absence_cron',
    kind: 'cron',
    title: 'Alerta de ausencia',
    description: 'Diario 12 PM Bogotá: padres cuyos hijos no compraron hoy reciben aviso.',
    cobertura: 'US-02',
    lambda_function: 'bioalert-hackathon-absence-cron',
  },
  {
    id: 'stock_cron',
    kind: 'cron',
    title: 'Stock crítico diario',
    description: 'Diario 7 AM Bogotá: admin recibe consolidado de productos en stock crítico.',
    cobertura: 'US-05',
    lambda_function: 'bioalert-hackathon-stock-cron',
  },
  {
    id: 'nutrition_weekly',
    kind: 'cron',
    title: 'Reporte nutricional semanal',
    description: 'Domingos 6 PM Bogotá: padre recibe top productos + macros + comparativa peer + link a vista web.',
    cobertura: 'EXT-2',
    lambda_function: 'bioalert-hackathon-nutrition-weekly',
    view_path: 'nutrition-report/index.html',
  },
  {
    id: 'cafeteria_weekly',
    kind: 'cron',
    title: 'Reporte semanal cafetería + insight cruzado',
    description: 'Lunes 7 AM Bogotá: admin recibe benchmark + señales agregadas de padres (EXT-5) + recomendaciones accionables.',
    cobertura: 'EXT-3 + EXT-5',
    lambda_function: 'bioalert-hackathon-cafeteria-weekly',
    view_path: 'cafeteria-insights/index.html',
  },

  // ── Diferenciadores no demostrables como botón pero importantes ──
  {
    id: 'explainability',
    kind: 'view_only',
    title: 'Explicabilidad obligatoria',
    description: 'Cada respuesta del bot incluye "te aviso esto porque..." con justificación basada en data. Nunca caja negra.',
    cobertura: 'EXT-4',
  },
  {
    id: 'multi_hijo',
    kind: 'view_only',
    title: 'Multi-hijo determinístico',
    description: 'El bot maneja padres con varios hijos en el dataset eligiendo al más activo por COUNT(*) + ties por fecha.',
    cobertura: 'producto real',
  },
  {
    id: 'timezone_bogota',
    kind: 'view_only',
    title: 'Timezone Bogotá nativo',
    description: 'Todas las queries usan now() AT TIME ZONE America/Bogota — sin confusión con dataset que tiene fechas futuras.',
    cobertura: 'producto real',
  },
]

export function findFeature(id: string): FeatureSpec | undefined {
  return FEATURES.find(f => f.id === id)
}
