export interface Venta {
  id: number
  usuario_identificacion: string
  nombre_estudiante: string | null
  fecha: Date
  cantidad: number
  precio: number
  importe: number
  nombre_producto: string
  identificacion_padre: string | null
  nombre_padre: string | null
  colegio: string
  nit_colegio: string
}

export interface Recarga {
  id: number
  usuario_identificacion: string
  nombre_estudiante: string | null
  fecha: Date
  valor: number
  identificacion_padre: string | null
  nombre_padre: string | null
  colegio: string
  nit_colegio: string
}

export interface ParentPhone {
  identificacion_padre: string
  phone_e164: string
  nombre_padre: string | null
}

export interface ProductNutrition {
  nombre_producto: string
  canonical_name: string | null
  category: string | null
  calories_100g: number | null
  sugar_g: number | null
  fat_g: number | null
  protein_g: number | null
  sodium_mg: number | null
}

export interface ConversationSession {
  phone_e164: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  identity?:
    | { kind: 'parent'; usuario_identificacion: string }
    | { kind: 'admin'; nit_colegio: string }
  expires_at: number
}

export interface WhatsAppInboundMessage {
  from: string
  text: string
  timestamp: string
  raw: unknown
}

export interface WhatsAppButton {
  id: string
  title: string
}
