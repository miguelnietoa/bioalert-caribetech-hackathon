// Ambient declaration para pg-copy-streams v7 (sin tipos oficiales).
// El módulo retorna objetos Submittable de pg que también son streams. Para el
// script ETL hackathon usamos `any` porque la verificación estructural completa
// requeriría re-tipear pg Submittable + node streams cruzados, sin valor en 24h.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare module 'pg-copy-streams' {
  export function from(sql: string): any
  export function to(sql: string): any
}
