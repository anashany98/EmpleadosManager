# Runbook Operativo Para IA Ejecutora y Revisora

## 1. Proposito

Este runbook define como debe trabajar una IA ejecutora y como debe validar una IA revisora al rescatar este proyecto. La meta no es producir muchos cambios. La meta es cerrar riesgos reales en el orden correcto.

## 2. Roles

### IA ejecutora
- toma un solo bloque de trabajo
- inspecciona archivos del bloque
- implementa el cambio minimo correcto
- anade o corrige tests
- deja handoff estructurado

### IA revisora
- revisa el resultado del bloque
- busca regresiones y huecos de seguridad
- decide si el riesgo quedo cerrado de verdad
- aprueba o devuelve correcciones concretas

## 3. Flujo de trabajo obligatorio

### Paso 1 - Preparacion
- identificar el bloque activo
- leer todos los archivos implicados
- entender dependencias laterales
- definir riesgo exacto y contrato esperado

### Paso 2 - Ejecucion
- hacer el cambio minimo correcto
- evitar mezclar refactors no esenciales
- actualizar tests o crear nuevos

### Paso 3 - Verificacion
- ejecutar checks relevantes del bloque
- validar comportamiento positivo y negativo
- comprobar que no se rompio el contrato adyacente

### Paso 4 - Handoff
La IA ejecutora entrega siempre:

```text
BLOQUE:
RIESGO CERRADO:
ARCHIVOS TOCADOS:
CAMBIO REALIZADO:
TESTS ANADIDOS/ACTUALIZADOS:
VERIFICACION HECHA:
RIESGOS REMANENTES:
DECISIONES TOMADAS:
SIGUIENTE BLOQUE RECOMENDADO:
```

### Paso 5 - Revision
La IA revisora responde siempre:

```text
RESULTADO: APROBADO | CORRECCIONES NECESARIAS | RIESGO NO RESUELTO
HALLAZGOS:
- ...
REGRESIONES POSIBLES:
- ...
VALIDACION DE SEGURIDAD:
- ...
VALIDACION DE CONTRATO:
- ...
VALIDACION DE TESTS:
- ...
SIGUIENTE ACCION:
- ...
```

## 4. Puertas de calidad globales

Ningun bloque se considera realmente cerrado si falla cualquiera de estas puertas:

- el riesgo principal sigue abierto en un camino alternativo
- el test solo cubre el camino feliz
- el cambio deja contrato roto entre backend y frontend
- el cambio depende de comportamiento local no reproducible
- se hizo refactor cosmetico junto con una correccion critica y ya no es facil auditar el cambio
- no quedaron anotados los riesgos remanentes

## 5. Orden de fases

### Fase 1 - Contencion critica
Objetivo: cerrar fugas y falsos controles de seguridad.

Bloques:
- A1 tenant isolation en dashboard/reporting/analytics/insights
- A2 tenant isolation en importacion masiva de empleados
- A3 invalidacion real de sesion
- A4 refresh/reset password robustos

No salir de esta fase si queda abierta cualquiera de estas condiciones:
- un usuario scoped puede consultar otra empresa
- sessionVersion no se aplica realmente
- reset password no invalida sesiones previas

### Fase 2 - Base operativa reproducible
Objetivo: que el proyecto se construya, despliegue y recupere sin depender de magia local.

Bloques:
- B1 migraciones versionadas
- B2 repo autocontenido para build/deploy
- B3 CI real y estricta
- B4 health/runner/hardening minimo real
- B5 backup/restore unificados y probados

No salir de esta fase si queda abierta cualquiera de estas condiciones:
- las migraciones siguen sin versionarse
- clean clone no construye
- CI sigue tolerando fallos esenciales
- backup/restore siguen siendo decorativos

### Fase 3 - Contratos rotos y seguridad operacional
Objetivo: que la aplicacion deje de prometer cosas que no soporta y que las entradas peligrosas se validen de verdad.

Bloques:
- C1 contrato SMTP/IMAP real
- C2 validacion real de archivos
- C3 fichajes y permisos consistentes
- C4 kiosk distribuible y menos ingenuo

No salir de esta fase si queda abierta cualquiera de estas condiciones:
- Settings configura algo que el backend ignora
- OCR procesa archivos no confiables
- manager/frontend y backend discrepan en permisos de fichaje
- kiosk depende de secretos en el cliente o memoria del proceso

### Fase 4 - Correctitud de negocio
Objetivo: que reportes y metricas dejen de ser potencialmente enganiososos.

Bloques:
- D1 contratos backend/frontend de reportes
- D2 analytics con reglas de negocio reales
- D3 performance con permisos y tipos correctos

No salir de esta fase si queda abierta cualquiera de estas condiciones:
- un reporte usa estructuras incompatibles entre backend y frontend
- una metrica critica depende de atajos incorrectos
- performance sigue heredando permisos que no le corresponden

### Fase 5 - Refactor estructural
Objetivo: bajar deuda despues de estabilizar la base.

Bloques:
- E1 dividir EmployeeController
- E2 dividir AuthController
- E3 dividir PayrollController
- E4 dividir pantallas gigantes del frontend
- E5 observabilidad y limpieza tecnica final

No empezar esta fase mientras haya P0 o P1 funcionales abiertos.

## 6. Politicas de decision

### Cuando elegir cambio minimo
Usar cambio minimo si:
- el riesgo se puede cerrar sin mover media arquitectura
- el problema es de policy enforcement, validacion o contrato directo
- el refactor grande no es necesario para cerrar el agujero

### Cuando elevar a refactor estructural
Elevar si:
- el archivo es tan grande que impide cerrar el riesgo con seguridad
- la logica esta duplicada en demasiados puntos
- el cambio minimo dejaria mas deuda peligrosa que solucion

### Cuando pausar y escalar
Pausar si:
- aparecen archivos criticos no versionados que invalidan build/deploy
- la base de datos o el contrato no se pueden inferir con confianza suficiente
- el modulo revisado depende de comportamiento externo no verificable

## 7. Evidencia minima por tipo de bloque

### Tenant / auth
- test positivo
- test negativo
- prueba de scope de empresa
- prueba de sesion obsoleta si aplica

### Deploy / infra
- evidencia de build reproducible
- evidencia de migracion reproducible
- pipeline o scripts corregidos
- docs honestas actualizadas

### Contratos frontend/backend
- DTO o forma de respuesta clarificada
- consumidor frontend actualizado
- test o smoke check del flujo

### Refactor
- antes/despues explicito
- responsabilidades separadas
- no degradar cobertura ni contratos

## 8. Lista roja de cosas prohibidas

- meter mejoras visuales mientras haya P0 abiertos
- mezclar 3 bloques en un mismo cambio
- confiar en query params sensibles sin scope server-side
- dejar `any` nuevo en zonas criticas
- aceptar `console.*` como observabilidad suficiente
- tapar un problema de contrato con `res.data || res || {}` en frontend
- llamar "seguro" a un secreto embebido en `VITE_*`

## 9. Checklist rapido antes de cerrar un bloque

- el riesgo principal queda cerrado de verdad?
- existe un camino alternativo no cubierto?
- los tests fallarian si se revierte el cambio?
- frontend y backend quedaron alineados?
- hay impacto lateral documentado?
- la IA revisora tendra evidencia suficiente para auditar?

## 10. Cierre del programa

El rescate se considera exitoso solo si:
- no hay fugas tenant conocidas
- la invalidacion de sesion es real
- el despliegue es reproducible
- CI es puerta de calidad real
- SMTP/IMAP, reportes y downloads funcionan con contratos honestos
- la deuda estructural critica baja de archivos monstruo a modulos razonables
