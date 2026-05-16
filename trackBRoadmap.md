# Track B Roadmap — Alertas + Reportes

Este archivo sirve para llevar el control del progreso del Track B. Podés marcar los hitos como completados a medida que avances.

## Fase 1: Pre-requisitos y Coordinación
- [ ] 1.1 Opt-in al sandbox de Kapso (Coordinar con Miguel).
- [ ] 1.2 Definir especificación de fixtures y enviar a Jose Maza.
- [x] 1.3 Esperar a que Jose Maza suba `lambdas/shared/`. (Completado por nosotros)

## Fase 2: Alertas Core (Alcance PRD)
- [x] 2.1 Implementar `lambdas/allergen-polling/` (US-03 - Alérgenos).
- [ ] 2.2 Probar `allergen-polling` con datos sintéticos.
- [x] 2.3 Implementar `lambdas/absence-cron/` (US-02 - Ausencia).
- [ ] 2.4 Probar `absence-cron` manualmente.
- [x] 2.5 Implementar `lambdas/stock-cron/` (US-05 - Stock Crítico).
- [ ] 2.6 Probar `stock-cron` manualmente.

## Fase 3: Reportes Avanzados (Extensiones)
- [x] 3.1 Implementar `lambdas/nutrition-weekly/` (EXT-2 - Reporte Nutricional).
- [ ] 3.2 Probar `nutrition-weekly` (verificar subida a S3 y link de WhatsApp).
- [x] 3.3 Implementar `lambdas/cafeteria-weekly/` (EXT-3 + EXT-5 - Reporte Cafetería + Insight Cruzado).
- [ ] 3.4 Probar `cafeteria-weekly` (verificar subida a S3 y link de WhatsApp).

## Fase 4: Cierre y Pulido
- [ ] 4.1 Grabar video de respaldo (Backup Demo).
- [ ] 4.2 Revisar logs y ajustar throttling si es necesario.
- [ ] 4.3 Participar en la prueba de integración grupal.
