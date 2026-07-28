# Plan maestro de implementación — Control RRHH y Gestoría

## Instrucciones para Gemini 3.6 Flash

Este documento es el contrato de ejecución para consolidar el módulo de Control RRHH y Gestoría de EmpleadosManager.

**Documento de entrada obligatorio:** `docs/AUDITORIA_CONTROL_RRHH_GESTORIA.md`.

**Resultado esperado:**

```text
Perfil del empleado
→ pestaña Control horario
→ registro mensual único
→ Control general de RRHH
→ cierre del periodo
→ exportación inmutable a una copia de gestoria.xlsx
```

El objetivo no es crear un nuevo módulo. El objetivo es **consolidar el módulo existente, proteger los datos ya guardados y retirar la implementación duplicada únicamente cuando la sustitución esté verificada**.

---

# 1. Mandato principal

## 1.1 Decisión arquitectónica

Usar como base canónica la implementación existente **A, `PayrollControl*`**, porque:

- Su migración está aplicada en la base de datos.
- Contiene periodos y registros reales.
- Integra el control dentro del perfil del empleado.
- Perfil y control general trabajan sobre `PayrollControlRecord`.
- Ya contiene una primera estructura de periodos y sobrescrituras.

De la implementación **B, `Gestoria*` + `EmployeeSchedule*`**, reutilizar solo:

- El patrón de conceptos configurables.
- Las políticas tenant bien planteadas.
- Los componentes de tabla que superen pruebas de UX.
- Las ideas de vistas de columnas.
- Las partes del exportador que sean compatibles con la plantilla real y pasen las pruebas estructurales.

No conservar como fuentes de datos paralelas:

- `GestoriaPeriod`.
- `GestoriaEmployeeRow`.
- `GestoriaCell`.
- `EmployeeScheduleEntry` como agregado mensual independiente.
- `/gestoria/employee/:periodId/:employeeId`.
- `/employees/:id/schedule` como pantalla duplicada.

No eliminarlos inmediatamente. Primero migrar, verificar y obtener aprobación.

## 1.2 Restricciones absolutas

Gemini debe cumplir estas reglas durante todas las fases:

1. No crear un tercer módulo.
2. No comenzar desde cero.
3. No duplicar páginas, modelos, rutas, tablas, servicios o fuentes de datos.
4. No usar `prisma db push`.
5. No usar `prisma migrate reset`.
6. No borrar tablas ni datos hasta superar el gate de migración y obtener aprobación.
7. No modificar `horario.xlsx`, `2026 CONTROL (1).xlsx` ni `gestoria.xlsx`.
8. No conectar todavía TimeEntry, fichajes, kiosco, geolocalización ni marcajes.
9. No introducir datos de prueba o mocks en código de producción.
10. No convertir importes, tarifas o porcentajes a `Number`/`Float` durante los cálculos.
11. No asumir que `subaccount465`, DNI o un fragmento UUID son el código de gestoría.
12. No asumir la semántica de las fórmulas ambiguas del Excel.
13. No modificar archivos ajenos al alcance de la fase activa.
14. No reformatear masivamente el repositorio.
15. No ocultar fallos de lint, build, tests, migraciones o exportación.
16. No avanzar al siguiente gate si el gate actual falla.
17. No realizar commits, pushes o despliegues sin autorización expresa del operador.
18. No limpiar, descartar o sobrescribir cambios no identificados del worktree.

---

# 2. Protocolo de trabajo para Gemini

## 2.1 Inicio obligatorio de cada sesión

Antes de editar:

```powershell
git branch --show-current
git status --short
git worktree list --porcelain
git log -1 --oneline --decorate
```

Después:

1. Leer completamente:
   - `docs/AUDITORIA_CONTROL_RRHH_GESTORIA.md`
   - Este plan maestro.
   - El estado de ejecución creado en la fase 0.
2. Identificar la fase y subfase autorizada.
3. Enumerar los archivos que se prevé modificar.
4. Comprobar si existen cambios ajenos en esos archivos.
5. Si hay solapamiento no atribuible, detenerse y pedir decisión.

## 2.2 Tamaño máximo de una iteración

Gemini 3.6 Flash debe trabajar en unidades pequeñas:

- Una subfase por iteración.
- Un objetivo verificable.
- Una migración por cambio coherente.
- Un máximo recomendado de 8–12 archivos funcionales modificados por iteración.
- Tests de la subfase antes de continuar.

No agrupar seguridad, migración, fórmulas, UX y exportación en una misma iteración.

## 2.3 Formato de salida obligatorio

Al finalizar cada iteración, Gemini debe informar:

```text
FASE:
OBJETIVO COMPLETADO:
ARCHIVOS MODIFICADOS:
MIGRACIONES CREADAS:
COMANDOS EJECUTADOS:
TESTS APROBADOS:
TESTS FALLIDOS:
DATOS ANTES/DESPUÉS:
RIESGOS ABIERTOS:
DECISIONES PENDIENTES:
SIGUIENTE GATE:
```

No usar “terminado” si queda algún criterio de aceptación sin demostrar.

## 2.4 Registro de progreso

En la fase 0 crear:

`docs/ESTADO_IMPLEMENTACION_CONTROL_RRHH_GESTORIA.md`

Debe contener:

- Fase actual.
- Commit base.
- Rama/worktree de trabajo.
- Último gate superado.
- Migraciones aplicadas.
- Recuentos de datos.
- Tests ejecutados.
- Decisiones de RRHH.
- Riesgos y bloqueos.

Actualizarlo solo con hechos comprobados.

---

# 3. Arquitectura final objetivo

## 3.1 Fuente única de verdad

Debe existir un único agregado mensual identificado por:

```text
companyId + year + month + employeeId
```

El perfil y el control general deben leer y escribir ese mismo agregado.

No debe existir:

- Una copia mensual en el perfil.
- Otra copia mensual en el control general.
- Sincronización manual entre pantallas.
- Estado mensual guardado únicamente en React.
- Un endpoint que calcule una realidad distinta para cada pantalla.

## 3.2 Entidades objetivo

Los nombres definitivos deben adaptarse al esquema existente sin crear duplicados. Evolucionar preferentemente las tablas `PayrollControl*`.

### Periodo

Responsabilidades:

- Empresa.
- Año.
- Mes.
- Estado.
- Versión para concurrencia.
- Fecha/usuario de cierre.
- Fecha/usuario de reapertura.
- Motivo de reapertura.
- Versión de reglas de cálculo.
- Snapshot de configuración.

Restricción:

```text
UNIQUE(companyId, year, month)
```

### Registro mensual por empleado

Responsabilidades:

- Periodo.
- Empleado.
- Snapshot histórico de categoría y departamento.
- Código de gestoría congelado para el periodo.
- Observaciones.
- Estado de revisión.
- Versión para concurrencia.

Restricción:

```text
UNIQUE(periodId, employeeId)
```

`employeeId` no debe ser nullable para registros ordinarios.

### Definición de concepto

Debe permitir añadir conceptos sin una columna Prisma por concepto.

Campos mínimos:

- Clave estable.
- Etiqueta.
- Tipo: dinero, horas, porcentaje, unidades, texto o booleano.
- Escala/decimales.
- Unidad.
- Orden.
- Visibilidad.
- Es estructural/configurable/calculado.
- Código de gestoría opcional.
- Fórmula o identificador de regla.
- Versión/vigencia.

### Valor mensual de concepto

Debe contener:

- Registro mensual.
- Concepto.
- Valor calculado.
- Valor manual nullable.
- Valor efectivo derivado.
- Indicador de sobrescritura derivable.
- Motivo de sobrescritura cuando proceda.
- Versión.

No almacenar tres fuentes independientes. La regla debe ser:

```text
effectiveValue = manualValue ?? calculatedValue
```

### Evento de sobrescritura

Debe registrar:

- Registro.
- Concepto/campo.
- Valor calculado vigente.
- Valor efectivo anterior.
- Valor manual anterior.
- Valor manual nuevo.
- Usuario.
- Fecha.
- Motivo, cuando sea obligatorio.
- Acción: override, cambio override o restauración.

### Detalle diario

El detalle de `horario.xlsx` debe pertenecer al mismo registro mensual:

- Fecha.
- Entrada 1.
- Salida 1.
- Entrada 2.
- Salida 2.
- Pausa/descuento.
- Horas trabajadas.
- Horas ordinarias.
- Horas extra normales.
- Horas de sábado/domingo/festivo.
- Observaciones.
- Fuente: manual ahora; fichaje en el futuro.

En esta versión:

```text
source = MANUAL
```

No implementar todavía importación automática.

### Exportación

Debe registrar:

- Periodo.
- Número de versión.
- Usuario.
- Fecha.
- Hash de la plantilla.
- Hash del archivo generado.
- Tamaño.
- Ruta/clave del binario inmutable.
- Snapshot de empleados, conceptos, mapeos y valores efectivos.
- Errores/warnings de validación.
- Número de descargas.

Descargar una exportación histórica significa devolver el mismo binario, no regenerarlo.

## 3.3 Código de gestoría del empleado

Añadir un campo explícito con nombre empresarial claro, por ejemplo:

```text
payrollAgencyEmployeeCode
```

Restricción recomendada:

```text
UNIQUE(companyId, payrollAgencyEmployeeCode)
```

Condiciones:

- Nullable mientras se concilia.
- Obligatorio para exportar.
- Nunca sustituir por nombre, DNI, `subaccount465` o UUID sin confirmación.
- El nombre se usa solo como comprobación visual.

## 3.4 API canónica

Durante la consolidación, conservar preferentemente la familia existente:

```text
/api/payroll/control
```

No crear simultáneamente `/api/rrhh-control` y dejar la anterior activa.

La API debe ofrecer:

- Periodos por empresa/año/mes.
- Registro mensual del empleado.
- Filas del control general.
- Actualización de celdas por lote.
- Restauración de cálculo.
- Cierre/reapertura.
- Prevalidación y preview de exportación.
- Generación y descarga histórica.

Una actualización nunca puede recibir ni modificar:

- Nombre del empleado.
- Empresa del registro.
- Empleado del registro.
- Periodo del registro.
- Código de gestoría histórico salvo operación administrativa específica.

## 3.5 Permisos

Políticas mínimas:

```text
gestoria.read
gestoria.write
gestoria.close
gestoria.reopen
gestoria.export
```

Reglas:

- `reopen` debe ser distinto de `close`.
- Frontend y backend deben comprobar la misma capability.
- Tener acceso visual no implica acceso de escritura.
- Todas las políticas deben resolver el tenant objetivo.
- Global admin debe quedar explícito; no inferido accidentalmente.

## 3.6 Estados y transiciones

Estados obligatorios:

```text
DRAFT
IN_REVIEW
CLOSED
EXPORTED
SENT_TO_AGENCY
REOPENED
```

Transiciones recomendadas:

```text
DRAFT → IN_REVIEW
IN_REVIEW → DRAFT
IN_REVIEW → CLOSED
CLOSED → EXPORTED
CLOSED → REOPENED
EXPORTED → EXPORTED       # nueva versión de exportación, si está permitido
EXPORTED → SENT_TO_AGENCY
EXPORTED → REOPENED
SENT_TO_AGENCY → REOPENED
REOPENED → IN_REVIEW
REOPENED → CLOSED
```

Condiciones:

- Exportar nunca cambia el estado a abierto.
- Reabrir requiere `gestoria.reopen` y motivo.
- Editar valores solo se permite en `DRAFT`, `IN_REVIEW` o `REOPENED`.
- `CLOSED`, `EXPORTED` y `SENT_TO_AGENCY` bloquean toda mutación mensual.
- Descargar un histórico no cambia el estado.
- Una nueva exportación nunca sobrescribe la anterior.

---

# 4. Gates obligatorios

| Gate | Condición para superarlo |
| --- | --- |
| G0 — Preservación | Cambios de ambos worktrees inventariados y respaldados; ningún archivo ajeno perdido. |
| G1 — Migraciones | Repositorio y BD coinciden; migración A incorporada con checksum correcto; `prisma migrate status` limpio. |
| G2 — Caracterización | Tests reproducen el comportamiento actual y los fallos conocidos antes de refactorizar. |
| G3 — Seguridad | Tests cross-tenant y manipulación de payload pasan para todas las rutas. |
| G4 — Modelo/migración | Datos migrados con recuentos, sumas y overrides conciliados; rollback probado. |
| G5 — Fuente única | Perfil↔general funciona en ambos sentidos con el mismo registro y sin tablas paralelas. |
| G6 — Cálculos | Fórmulas aprobadas por RRHH y tests dorados Decimal pasan. |
| G7 — Periodos/auditoría | Cierre, reapertura, concurrencia y auditoría atómica pasan. |
| G8 — UX | Prueba de 20 empleados igual o más rápida que el umbral acordado; teclado/clipboard completos. |
| G9 — Exportación | Plantilla real, mapeo por código, estructura preservada, hash original intacto e histórico reproducible. |
| G10 — Producción | CI limpio, piloto mensual aprobado, backup/rollback/documentación listos. |

---

# 5. Fase 0 — Preservación y preparación

## Objetivo

Evitar pérdida de cambios o datos antes de consolidar.

## Tareas

1. Inventariar el worktree activo y el worktree A.
2. Identificar qué archivos pertenecen a A, B y otros trabajos.
3. No hacer `stash`, reset, checkout destructivo ni limpieza automática.
4. Obtener un dump de solo lectura de:
   - `_prisma_migrations`.
   - `PayrollControlPeriod`.
   - `PayrollControlRecord`.
   - `PayrollControlOverride`.
   - `PayrollControlConceptConfig`.
5. Registrar recuentos y sumas por periodo/campo.
6. Copiar de forma segura los SQL exactos de la migración A al historial canónico.
7. Comparar el checksum del SQL del worktree A con `_prisma_migrations`.
8. Si el checksum no coincide, detenerse. No alterar manualmente el registro de migraciones.
9. Crear el documento de estado.
10. Preparar una rama/worktree limpio solo cuando el operador autorice cómo preservar los cambios actuales.

## Evidencia mínima

- Recuento base observado en auditoría: 2 periodos, 40 registros, 71 overrides.
- Los recuentos reales del día de ejecución prevalecen.
- Hash SHA-256 de los tres Excel.
- Listado de migraciones locales, aplicadas y divergentes.

## Gate G0

No avanzar hasta que el operador confirme que los cambios de ambos intentos están preservados.

---

# 6. Fase 1 — Reconciliación de migraciones

## Objetivo

Hacer que el repositorio represente exactamente la base existente antes de diseñar nuevas migraciones.

## Tareas

1. Incorporar la migración A aplicada con su contenido exacto.
2. Incorporar al esquema Prisma los modelos A que corresponden a esa migración.
3. Ejecutar:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run prisma:status
```

4. No aplicar las migraciones B.
5. Marcar las migraciones B como candidatas a retirada/reemplazo, no borrarlas hasta preservar su trabajo útil.
6. Probar el acceso de lectura a los datos A con el cliente generado.
7. Verificar que no aparecen planes destructivos.

## Criterios de aceptación

- `prisma validate`: PASS.
- `prisma generate`: PASS.
- `prisma migrate status`: repositorio y BD sincronizados.
- Se pueden leer los 2/40/71 registros o los recuentos actuales equivalentes.
- Ninguna tabla B se crea.
- Ninguna tabla A se elimina o renombra todavía.

---

# 7. Fase 2 — Tests de caracterización

## Objetivo

Congelar el comportamiento actual antes de cambiarlo y convertir los fallos de auditoría en tests rojos.

## Backend

Crear tests para:

1. Periodo único por empresa/año/mes.
2. Perfil y general leen el mismo `PayrollControlRecord`.
3. Fórmulas actuales con casos conocidos.
4. Cierre actual.
5. Restauración actual.
6. Exportación actual contra copia temporal de la plantilla.
7. Payload con `employeeId`, `periodId`, nombre o empresa.
8. Acceso cross-tenant.
9. Lectura que crea registros en periodo cerrado.
10. Transiciones arbitrarias.

Los tests que demuestran defectos deben comenzar rojos con una descripción del comportamiento correcto esperado.

## Frontend

Crear tests para:

1. Pestaña Control horario dentro de `EmployeeDetail`.
2. Nombre readonly.
3. Campos editables/readonly actuales.
4. Bloqueo por estado.
5. Estado guardando/error.
6. Navegación y clipboard actuales.

## Exportación

Usar siempre:

```text
copia temporal de documentos-referencia/gestoria.xlsx
```

Nunca escribir en el original.

## Gate G2

La suite debe demostrar de forma reproducible los fallos críticos antes del refactor.

---

# 8. Fase 3 — Seguridad, tenant e inmutabilidad

## Objetivo

Cerrar las vulnerabilidades antes de ampliar el módulo.

## Backend

1. Introducir Zod estricto en todas las rutas.
2. Usar allowlists por operación.
3. Rechazar propiedades desconocidas.
4. Pasar `ActorContext` a todos los servicios.
5. Resolver empresa desde el recurso servidor, no desde el payload.
6. Añadir `companyId` a los filtros de lectura y mutación.
7. Verificar que el empleado pertenece a la empresa del periodo.
8. Impedir cambiar:
   - `employeeId`.
   - `periodId`.
   - `companyId`.
   - nombre.
9. Aplicar políticas separadas read/write/close/reopen/export.
10. No confiar en permisos de frontend.

## Tests obligatorios

Para cada endpoint:

- Usuario empresa A, recurso A: permitido según permiso.
- Usuario empresa A, recurso B por ID: 403/404 seguro.
- Global admin: permitido explícitamente.
- Usuario read intenta write: 403.
- Payload manipulado: 400.
- Nombre por edición, paste, bulk o API: rechazado.

## Gate G3

No debe existir una ruta de lectura, mutación o exportación sin test tenant.

---

# 9. Fase 4 — Modelo final y migración de datos

## Objetivo

Evolucionar A hacia el modelo flexible sin perder registros ni overrides.

## Estrategia

Usar migración expand–migrate–contract:

### Expand

1. Añadir nuevas tablas/campos sin borrar los antiguos.
2. Añadir definiciones de conceptos estándar.
3. Añadir valores mensuales.
4. Añadir versión de registros/periodos.
5. Añadir código de gestoría explícito.
6. Añadir eventos de override.

### Migrate

1. Crear conceptos estándar:
   - `OVERTIME_RATE`.
   - `HOLIDAY_OVERTIME_RATE`.
   - `OVERTIME_HOURS`.
   - `HOLIDAY_OVERTIME_HOURS`.
   - `OVERTIME_AMOUNT`.
   - `POSITIVE_VARIABLE`.
   - `NEGATIVE_VARIABLE`.
   - `DIETS`.
   - `IRPF`.
   - `TGSS`.
   - `AVAILABLE_PERCENTAGE`.
   - `GROSS`.
   - `PRODUCTIVITY`.
   - `HOURS_RESULT`.
   - `CHECK_RESULT`.
   - `DIFFERENCE`.
   - `ARREARS`.
   - `COMMISSION`.
   - `EXPENSES`.
   - `ADVANCE`.
2. Migrar cada columna A a su concepto.
3. Migrar manual flags y valores manuales.
4. Convertir cada override histórico en evento.
5. Mantener snapshots de categoría/departamento.
6. No rellenar códigos de gestoría con heurísticas.
7. Marcar empleados sin código como pendientes de conciliación.

### Verify

Comparar:

- Periodos antes/después.
- Registros antes/después.
- Valores no nulos por campo/concepto.
- Sumas Decimal por periodo.
- Overrides/eventos por campo.
- Empleados huérfanos.
- Duplicados.
- Estados.

### Contract

No eliminar columnas/tablas antiguas en esta fase.

## Rollback

- Migración ensayada en una copia de la BD.
- Script de verificación separado.
- Rollback por restauración de backup, no por `migrate reset`.
- Si un recuento o suma difiere, abortar.

## Gate G4

La conciliación debe producir cero diferencias no explicadas.

---

# 10. Fase 5 — Servicio mensual único

## Objetivo

Hacer que perfil y general trabajen sobre el mismo agregado.

## Tareas

1. Implementar un repositorio/servicio canónico de registros mensuales.
2. Hacer que `EmployeeControlHorarioSection` consuma ese servicio.
3. Hacer que `PayrollControlPage` consuma el mismo servicio.
4. Integrar el detalle diario bajo el registro mensual.
5. Calcular agregados diarios hacia valores calculados mensuales.
6. Permitir valor manual mensual sin destruir el cálculo diario.
7. Etiquetar la fuente:

```text
MANUAL
```

8. No llamar a TimeEntry.
9. No mantener `EmployeeScheduleEntry` como segunda fuente.
10. Eliminar las pantallas duplicadas solo después de que las rutas canónicas estén probadas.

## Test E2E obligatorio

```text
1. Abrir empleado A.
2. Pestaña Control horario.
3. Seleccionar empresa/año/mes.
4. Guardar horas y dietas.
5. Abrir control general.
6. Ver los mismos valores.
7. Modificar desde general.
8. Volver al perfil.
9. Ver el valor actualizado.
10. Confirmar un solo registro en BD.
```

Repetir con dos empresas y empleados distintos.

## Gate G5

El test anterior debe pasar sin sincronización, duplicados ni refresh completo.

---

# 11. Fase 6 — Fórmulas Decimal y decisiones de RRHH

## Bloqueo previo

No implementar como definitivas estas fórmulas hasta obtener respuesta:

1. ¿Variable positiva H forma parte del bruto o se paga aparte?
2. ¿Variable negativa I es descuento, corrección u otro concepto?
3. ¿Dietas J forman parte de bruto?
4. ¿Productividad P debe ser `H/O`?
5. ¿Horas Q debe ser `O-P`?
6. ¿R es solo comprobación?
7. ¿Los subtotales incompletos son intencionados?
8. ¿434 recibe importe total, normal o festivo?
9. ¿Qué redondeo se usa?

Registrar cada respuesta en el documento de estado.

## Implementación

1. Usar `Prisma.Decimal` o una librería Decimal compatible.
2. No usar `Number`, `parseFloat` ni sumas JS para importes.
3. Definir escala por concepto.
4. Definir redondeo por operación y por exportación.
5. Tratar explícitamente:
   - Vacío.
   - Cero.
   - Negativo.
   - División por cero.
   - Porcentaje fuera de rango.
6. Versionar reglas.
7. Congelar versión de fórmula y tarifas en el periodo.
8. Guardar:
   - calculado;
   - manual nullable;
   - efectivo derivado.
9. Restaurar significa borrar `manualValue`, no copiarlo al calculado.

## Casos dorados mínimos

- Tarifas 10/12, horas 5/2, IRPF 17%, TGSS 6,35%.
- Periodo sin horas.
- Solo horas festivas.
- Porcentaje disponible cero.
- Porcentaje disponible negativo.
- Valor manual cero.
- Restauración de override.
- Cambio futuro de tarifa sin alterar periodo cerrado.
- Totales de grupo y generales.

## Gate G6

Resultados aprobados por RRHH y tests exactos con Decimal.

---

# 12. Fase 7 — Periodos, cierre, concurrencia y auditoría

## Periodos

1. Convertir estados a enum.
2. Implementar máquina de transiciones.
3. Evitar creación de registros mediante GET.
4. No añadir empleados automáticamente a periodos cerrados.
5. Añadir empleados mediante operación explícita y solo en estados editables.

## Cierre

En una única transacción:

1. Verificar estado/versión.
2. Verificar pendientes definidos.
3. Congelar tarifas, reglas y códigos.
4. Cambiar estado.
5. Insertar auditoría.

## Reapertura

Requiere:

- `gestoria.reopen`.
- Motivo no vacío.
- Estado origen permitido.
- Auditoría before/after.
- Nueva versión.

## Concurrencia

Usar bloqueo optimista:

```text
WHERE id = ? AND version = ?
```

Incrementar versión en cada mutación.

Si la versión no coincide:

- Devolver 409.
- No sobrescribir.
- Mostrar al usuario opción de recargar/comparar.

## Auditoría

Modificar el servicio para aceptar cliente transaccional o usar outbox:

- La mutación no se confirma sin evento de auditoría.
- Registrar old/new por concepto.
- Registrar usuario, fecha, empresa, periodo y empleado.
- No capturar y silenciar el fallo de auditoría.

## Tests

- Guardado concurrente.
- Cierre durante guardado.
- Mutación por todos los endpoints en cerrado.
- Reapertura sin permiso.
- Reapertura sin motivo.
- Exportación no reabre.
- Restore en `SENT_TO_AGENCY` bloqueado.

## Gate G7

Cero mutaciones posibles en estados bloqueados, incluso por API directa.

---

# 13. Fase 8 — Pestaña Control horario

## Objetivo

Conservar una única experiencia dentro de `EmployeeDetail`.

## UI

La pestaña debe ofrecer:

- Empresa vinculada.
- Año.
- Mes.
- Empleado actual readonly.
- Resumen mensual.
- Detalle diario opcional.
- Horas extra normal/festiva.
- Tarifas congeladas.
- Dietas.
- Variables.
- Productividad.
- Gastos.
- Atrasos.
- Comisiones.
- Anticipos.
- Otros conceptos configurables.
- Observaciones.
- Estado de revisión.
- Indicador calculado/manual/efectivo.
- Restaurar cálculo.

## Reglas

- No mostrar selector para cambiar a otro empleado.
- No crear una ficha duplicada.
- Periodo bloqueado = inputs deshabilitados.
- Backend sigue siendo la protección real.
- Guardado sin recarga completa.
- Errores visibles y recuperables.

## Retirada controlada

Cuando la pestaña canónica esté aprobada:

- Retirar link independiente de horario.
- Redirigir temporalmente la URL antigua a `EmployeeDetail?tab=control-horario`.
- Retirar `GestoriaEmployeeDetailPage`.
- No conservar dos formularios funcionales.

---

# 14. Fase 9 — Control general tipo Excel

## Objetivo UX

Completar 20 empleados con un tiempo similar o inferior a 1,25× el Excel, salvo que RRHH acuerde otro umbral.

## Capacidades obligatorias

1. Click directo en celda.
2. Tab y Shift+Tab.
3. Enter y Shift+Enter.
4. Flechas.
5. Copiar celda.
6. Copiar rango.
7. Pegar TSV desde Excel.
8. Pegar matrices de varias filas/columnas.
9. Selección multicelda.
10. Selección de filas.
11. Aplicar valor a selección.
12. Borrar rango.
13. Fill/repetición.
14. Undo.
15. Redo cuando no haya confirmación remota incompatible.
16. Nombre fijado y readonly.
17. Cabecera fijada.
18. Resize.
19. Reordenar.
20. Ocultar/mostrar.
21. Buscar.
22. Filtrar.
23. Ordenar.
24. Agrupar por departamento/categoría.
25. Subtotales y total general.
26. Guardando/guardado/error.
27. Retry.
28. Protección al salir.
29. Virtualización o rendimiento demostrado.

## Backend para edición por lote

Crear una operación transaccional por lote que:

- Reciba solo IDs y claves permitidas.
- Valide tenant.
- Valide periodo/versión.
- Rechace el nombre.
- Valide todas las celdas antes de escribir.
- Aplique todo o nada.
- Registre old/new por celda.
- Devuelva versiones nuevas.

## Protección del nombre

Probar:

- Edición directa.
- Paste que incluye columna nombre.
- Bulk.
- Payload manual.
- DevTools.
- Petición directa.

Todos deben mantener/rechazar el nombre sin modificar `Employee`.

## Benchmark

Medir:

- Clics.
- Teclas.
- Cambios de pantalla.
- Tiempo.
- Errores.
- Recuperación.

Ejecutar con 20 y 80 empleados.

## Gate G8

RRHH debe aprobar la tarea mensual comparada con su Excel.

---

# 15. Fase 10 — Exportación real a gestoría

## Plantilla

Usar exclusivamente:

`documentos-referencia/gestoria.xlsx`

Proceso:

1. Leer bytes originales.
2. Calcular SHA-256.
3. Crear copia temporal/nueva.
4. No guardar jamás sobre la ruta original.
5. Modificar solo las celdas aprobadas.
6. Verificar nuevamente el hash del original.

## Mapeo de empleados

1. Leer B9:B91.
2. Crear índice código→fila.
3. Detectar códigos duplicados en plantilla.
4. Para cada registro:
   - exigir código;
   - buscar coincidencia exacta;
   - comprobar nombre como warning;
   - asignar la fila encontrada.
5. Mostrar antes de generar:
   - sin código;
   - no encontrados;
   - duplicados;
   - empleados de plantilla sin registro;
   - discrepancias de nombre.
6. Bloquear generación por errores críticos.

## Mapeo de conceptos

| Código | Columna | Valor |
| --- | --- | --- |
| 044 | D | Importe de atrasos |
| 048 | E | Importe de comisión |
| 050 | F | Importe de productividad |
| 182 | G | Importe de gastos |
| 434 | H | Importe de horas extra aprobado por RRHH |
| 604 | I | Importe de dietas |
| 791 | J | Importe de anticipo semanal |

No mapear variable negativa a comisión.

## Preservación estructural

Comparar original y copia:

- Hojas y orden.
- Celdas combinadas.
- Freeze panes.
- Protección.
- Validaciones.
- Formatos numéricos.
- Fuentes/rellenos/bordes.
- Anchos/altos.
- Nombres definidos.
- Área de impresión.
- Contenido fijo.
- Todas las celdas no objetivo.

Si ExcelJS altera partes no objetivo, no declarar éxito. Usar parche OOXML de las celdas concretas o una herramienta que pase el diff estructural.

## Histórico

1. Guardar el binario exacto generado.
2. Hash y tamaño.
3. Snapshot de datos/mapeo.
4. Nombre con versión/UUID, nunca solo periodo.
5. Descargar log histórico devuelve el mismo hash.
6. Comprobar tenant al listar/descargar.

## Tests obligatorios

- Original mantiene hash.
- Código encuentra fila correcta aunque los registros estén desordenados.
- Nombre similar no sustituye al código.
- Falta de código bloquea.
- Código inexistente bloquea.
- Dos exportaciones no se sobrescriben.
- Descarga histórica coincide byte a byte.
- Exportar cerrado no reabre.
- Usuario sin permiso recibe 403.
- Empresa A no descarga export de B.

## Gate G9

Una copia real debe abrir correctamente y superar el diff estructural.

---

# 16. Fase 11 — Retirada de la implementación duplicada

## Condición previa

Solo después de G5, G7, G8 y G9.

## Tareas

1. Confirmar que ninguna ruta/UI usa B.
2. Confirmar que no existen datos B no migrados.
3. Retirar rutas duplicadas.
4. Retirar páginas duplicadas.
5. Retirar servicios duplicados.
6. Retirar modelos B mediante migración explícita.
7. No eliminar datos sin backup y aprobación.
8. Mantener redirecciones temporales si existen enlaces guardados.
9. Ejecutar búsqueda global:

```powershell
rg "GestoriaPeriod|GestoriaEmployeeRow|GestoriaCell|EmployeeScheduleEntry|GestoriaEmployeeDetailPage|EmployeeSchedulePage"
```

10. Cada coincidencia restante debe estar justificada.

## Criterio

Al finalizar debe existir:

- Una pantalla general.
- Una pestaña individual.
- Un agregado mensual.
- Una API.
- Un modelo de periodos.
- Un exportador.

---

# 17. Fase 12 — Pruebas, piloto y producción

## Suite técnica

Ejecutar y registrar:

```powershell
git status --short
npm run prisma:validate
npm run prisma:generate
npm run prisma:status
```

Backend:

```powershell
npm run lint
npm run build
npm test -- --run
```

Frontend:

```powershell
npm run lint
npm run build
npm test -- --run
npm run test:e2e
```

## Matriz mínima

- Unitarias de fórmulas.
- Integración PostgreSQL.
- Rutas/permisos.
- Multiempresa.
- Cierre/reapertura.
- Concurrencia.
- Override/restore.
- Perfil↔general.
- Clipboard/grid.
- Export real.
- Histórico.
- Rendimiento 20/80 empleados.

## Piloto

1. Ejecutar un mes en paralelo con Excel.
2. Comparar empleado por empleado.
3. Comparar totales.
4. Comparar gestoría.
5. Registrar discrepancias.
6. No retirar Excel hasta aprobación.

## Producción

Requisitos:

- Backup probado.
- Migraciones forward-only.
- Rollback documentado.
- Logs/auditoría.
- Almacenamiento de exportaciones.
- Manual de RRHH.
- Formación breve.
- Propietario funcional.
- Métricas de errores/guardados/exportaciones.

## Gate G10

Producción solo con aprobación técnica y funcional.

---

# 18. Orden recomendado de entregas

| Entrega | Contenido | Dependencia |
| --- | --- | --- |
| E0 | Preservación, inventario, estado | Ninguna |
| E1 | Migraciones reconciliadas | E0 |
| E2 | Tests de caracterización | E1 |
| E3 | Seguridad/tenant/payload | E2 |
| E4 | Modelo expandido y migración de datos | E3 |
| E5 | Servicio mensual único | E4 |
| E6 | Fórmulas/overrides Decimal | Decisiones RRHH + E5 |
| E7 | Estados/cierre/auditoría/concurrencia | E6 |
| E8 | Pestaña individual definitiva | E5–E7 |
| E9 | Grid Excel definitivo | E5–E7 |
| E10 | Exportación real e histórica | E6–E7 |
| E11 | Retirada de duplicados | E8–E10 |
| E12 | Piloto y producción | E11 |

---

# 19. Priorización de defectos de la auditoría

## P0 — Resolver primero

- HRG-001: doble implementación y divergencia de datos.
- HRG-002: multiempresa insegura.
- HRG-003: exportación sin mapeo por código.
- HRG-004: fuente única rota.
- HRG-005: formato real no soportado por B.
- HRG-006/007: payload e identidad manipulables.
- HRG-008/009/010: estados, cierre y concurrencia.
- HRG-011/012: overrides y auditoría.

## P1 — Antes de piloto

- HRG-013/014: fórmulas y Decimal.
- HRG-015: UX.
- HRG-016/017: histórico y código empleado.
- HRG-018/019: conceptos y permisos.
- HRG-028/029: guardado e inmutabilidad.
- HRG-031: cobertura de tests.

## P2 — Durante consolidación

- HRG-020/021: bulk y porcentajes.
- HRG-022/023/024: pausa, festivos y horas.
- HRG-025: pantallas duplicadas.
- HRG-026/027: anomalías del Excel.
- HRG-030/032: gates de calidad y rango de años.

---

# 20. Prompt de arranque para Gemini 3.6 Flash

Copiar este bloque al iniciar la implementación:

```text
Actúa como implementador senior y ejecuta exclusivamente la siguiente fase
del plan maestro:

docs/PLAN_MAESTRO_IMPLEMENTACION_CONTROL_RRHH_GESTORIA_GEMINI.md

Antes de modificar nada:

1. Lee completamente el plan maestro.
2. Lee completamente docs/AUDITORIA_CONTROL_RRHH_GESTORIA.md.
3. Ejecuta git branch --show-current, git status --short,
   git worktree list --porcelain y git log -1 --oneline --decorate.
4. Identifica la fase y el gate actuales desde
   docs/ESTADO_IMPLEMENTACION_CONTROL_RRHH_GESTORIA.md, si existe.
5. No avances más de una subfase.
6. No crees otro módulo, modelo, pantalla, ruta o tabla equivalente.
7. No uses prisma db push, migrate reset ni elimines datos.
8. No modifiques los Excel originales.
9. No integres TimeEntry, fichajes, kiosco, geolocalización ni marcajes.
10. Si detectas cambios ajenos, divergencia de datos, checksum distinto,
    fórmula sin confirmar o riesgo de pérdida, detente y solicita decisión.

Implementación base:
- Conservar y evolucionar PayrollControl*.
- Reutilizar selectivamente conceptos configurables/políticas/UI de Gestoria*.
- Migrar antes de retirar duplicados.
- Fuente única company+año+mes+employee.
- Decimal extremo a extremo.
- Nombre e identidad inmutables en backend.
- Tenant obligatorio.
- Auditoría atómica.
- Exportación por código sobre una copia de gestoria.xlsx.

Al terminar informa exactamente:
FASE, OBJETIVO COMPLETADO, ARCHIVOS MODIFICADOS, MIGRACIONES CREADAS,
COMANDOS EJECUTADOS, TESTS APROBADOS, TESTS FALLIDOS,
DATOS ANTES/DESPUÉS, RIESGOS ABIERTOS, DECISIONES PENDIENTES
y SIGUIENTE GATE.

No declares completada la fase si no puedes demostrar cada criterio
de aceptación.
```

---

# 21. Definición final de “terminado”

El módulo solo está terminado cuando:

- Existe una única implementación.
- Los datos históricos están migrados y conciliados.
- Perfil y general comparten registro.
- El nombre no puede modificarse por ninguna vía.
- Todos los demás valores permitidos son editables.
- Calculado/manual/efectivo funcionan.
- Restore recupera realmente el cálculo.
- Los cálculos están aprobados y usan Decimal.
- Tarifas/reglas históricas están congeladas.
- Permisos y tenant pasan tests.
- Cierre bloquea frontend y backend.
- Reapertura requiere permiso y motivo.
- Auditoría old/new es atómica.
- La UX supera el benchmark acordado.
- La exportación usa código de trabajador.
- La plantilla original conserva su hash.
- Cada exportación histórica es inmutable.
- Las pruebas específicas pasan.
- RRHH aprueba un mes piloto.

Compilar o mostrar notificaciones no satisface esta definición.
