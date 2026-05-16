# analysis/

Análisis exploratorio en Python/Jupyter. **NO va a producción** — solo para entender la data y producir el caso demo + uplift.

Notebooks esperados:

- `01-eda.ipynb` — exploración del dataset histórico del colegio piloto: distribuciones de ticket, frecuencia de recarga, patrones por grado, productos top.
- `02-uplift.ipynb` — cálculo de uplift en 3 escenarios (pesimista 15% / base 30% / optimista 40%) y extrapolación a los 90 colegios de Biofood.

Resultados finales (markdown) van en `results/`:

- `caso-demo.md` — perfil de "Diana y Mateo" elegido para la demo (con candidatos descartados anotados).
- `uplift-pitch.md` — números del modelo + supuestos + frase del pitch.

**Recordatorio:** el código productivo es 100% Node.js. No mezclar runtimes en Lambdas.
