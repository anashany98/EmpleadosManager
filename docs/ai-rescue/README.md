# AI Rescue Kit

Este directorio contiene tres entregables pensados para que una IA ejecutora y una IA revisora puedan rescatar este proyecto sin improvisar.

## Archivos

- `docs/ai-rescue/01-prompt-unico.md`
  - Prompt unico, largo y autocontenido, listo para pegar en otra IA.
- `docs/ai-rescue/02-runbook-operativo.md`
  - Runbook de ejecucion por fases, con reglas, puertas de calidad y flujo entre IA ejecutora e IA revisora.
- `docs/ai-rescue/03-tickets-ia.md`
  - Backlog de tickets redactados para ejecucion uno por uno por una IA.

## Orden recomendado de uso

1. Leer `docs/ai-rescue/02-runbook-operativo.md`.
2. Usar `docs/ai-rescue/01-prompt-unico.md` para arrancar a la IA ejecutora.
3. Ejecutar los tickets en el orden definido en `docs/ai-rescue/03-tickets-ia.md`.

## Regla central

No avanzar a refactors grandes ni mejoras cosmeticas mientras existan P0 abiertos en:

- tenant isolation
- auth / session invalidation
- migraciones / despliegue reproducible
- contratos backend/frontend rotos
- backup / restore / CI falsamente saludables

## Modo de trabajo esperado

- una IA ejecuta un solo bloque cada vez
- una segunda IA revisa el bloque terminado
- cada bloque deja evidencia: cambios, tests, verificacion y riesgos remanentes
- si aparece un riesgo mayor no previsto, se eleva antes de seguir
