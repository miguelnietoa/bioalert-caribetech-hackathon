# lambdas/conversation-handler/tools/

Implementación de las 8 tools que expone el agente conversacional a Claude. Cada tool es un módulo TS con `name`, `description`, `input_schema` y `handler(input)`.

1. `get_student_consumption_today.ts` — qué comió hoy (US-01)
2. `get_student_consumption_week.ts` — última semana
3. `get_nutrition_summary.ts` — calorías/azúcar/grasas (EXT-2)
4. `get_balance_projection.ts` — proyección de agotamiento (US-04)
5. `get_recharge_recommendations.ts` — 3 opciones con narrativa (EXT-1)
6. `compare_to_peers.ts` — vs. compañeros de grado (EXT-2)
7. `get_school_alerts.ts` — solo admin cafetería (US-05)
8. `get_cafeteria_benchmark.ts` — vs. promedio nacional (EXT-3, solo admin)

Cada tool importa queries SQL desde `../queries/` y usa el cliente compartido de `lambdas/shared/db.ts`.
