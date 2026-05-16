# lambdas/conversation-handler/prompts/

System prompt y plantillas que recibe Claude.

- `system.txt` — define al agente como "asistente nutricional familiar de Biofood": español, tono cálido pero conciso, llama al padre por su nombre, **explica por qué dice cada cosa** (EXT-4), no inventa datos fuera de tools, limita contexto a últimas 20 transacciones (PRD §riesgos).
- `recharge-options.md` — plantilla narrativa para EXT-1 (Esencial / Equilibrada / Bienestar con justificación data-driven).
- `quick-replies.json` — catálogo de quick replies para EXT-6.

Versionar cambios — un prompt malo destruye la demo.
