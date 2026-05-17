/**
 * Convierte markdown habitual del LLM al subset de formato de WhatsApp.
 * WA: *negrita* _cursiva_ ~tachado~ — no **negrita** ni ## títulos.
 */
export function formatForWhatsApp(text: string): string {
  let s = text

  // **negrita** / __negrita__ → *negrita*
  s = s.replace(/\*\*([^*]+)\*\*/g, '*$1*')
  s = s.replace(/__([^_]+)__/g, '*$1*')

  // ~~tachado~~ → ~tachado~
  s = s.replace(/~~([^~]+)~~/g, '~$1~')

  // Encabezados markdown
  s = s.replace(/^#{1,6}\s+/gm, '')

  // Bloques de código → solo el contenido
  s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')

  // `inline` → texto plano
  s = s.replace(/`([^`]+)`/g, '$1')

  // [texto](url) → texto (url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')

  return s.trim()
}
