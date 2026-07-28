# Auditoría técnica, funcional y UX — Control RRHH y Gestoría

**Proyecto:** EmpleadosManager
**Fecha de auditoría:** 27/07/2026
**Rama activa:** `feature/obras-cambios`
**Commit base:** `87058f5`
**Modalidad:** inspección de solo lectura. No se ha corregido código, aplicado migraciones, alterado datos ni modificado los Excel originales.

## Alcance y advertencia de configuración

La auditoría cubre los tres documentos de referencia, el código y las migraciones de la rama activa, el esquema de la base de datos accesible y un segundo worktree vinculado que contiene otra implementación del mismo dominio.

Para evitar confusiones, en este informe se usan estas denominaciones:

- **Implementación A — `PayrollControl*`:** está en el worktree vinculado `C:\Users\PC\.gemini\antigravity\worktrees\RRHH\implementar_control_gestoria_rrhh`. Integra “Control horario” dentro de `EmployeeDetail`, tiene un control general y un exportador `gestoria.xlsx`. Su migración `20260727120000_add_payroll_control_module` está aplicada en la base de datos, pero no existe en la rama activa.
- **Implementación B — `Gestoria*` + `EmployeeSchedule*`:** está sin commit en la rama activa. Crea un segundo control general, otro detalle individual, una pantalla independiente de horario y otros modelos/endpoints. Sus tres migraciones están pendientes y sus tablas no existen en la base de datos inspeccionada.

Esta duplicación no es teórica: la base contiene **2 periodos, 40 registros mensuales y 71 sobrescrituras** de la implementación A. La rama activa no contiene su esquema ni su migración y está intentando introducir la implementación B. Aplicar la rama activa sin una reconciliación previa puede dejar datos reales inaccesibles, provocar fallos de ejecución y conducir a una migración destructiva accidental.

# 1. Veredicto general

## Clasificación única

**Implementación incorrecta o insegura.**

El módulo no es apto para producción ni para sustituir los Excel. Los bloqueos principales son:

1. Existen dos implementaciones incompatibles del mismo proceso.
2. El estado de migraciones presenta divergencia entre repositorio y base de datos.
3. La implementación que contiene los datos reales no aplica aislamiento tenant en sus servicios/controlador.
4. La implementación nueva no comparte fuente de datos entre el horario individual y el control general.
5. Ninguno de los dos exportadores genera de forma válida y reproducible una copia de la plantilla real asociando empleados por su código de gestoría.
6. Las fórmulas no reproducen de forma completa ni fiable `2026 CONTROL (1).xlsx`.
7. El control general no ofrece una experiencia comparable a Excel.
8. Los bloqueos de periodo, la auditoría y las sobrescrituras tienen vías de omisión.
9. No hay pruebas E2E ni de seguridad específicas del módulo.

## Decisión de salida

**No desplegar, no ejecutar `prisma db push`, no aplicar las migraciones de la implementación B y no retirar las tablas `PayrollControl*` hasta decidir qué implementación se conserva y migrar explícitamente los 40 registros y 71 sobrescrituras existentes.**

## Estado de la evidencia

- La persistencia real existe solo para la implementación A.
- La implementación B compila y tiene tests unitarios, pero no tiene tablas en la base inspeccionada.
- No se ejecutó una exportación real porque la implementación B solo admite una plantilla `.xls` inexistente y la implementación A no está en la rama activa; forzarla habría mutado el estado del periodo en la base.
- La simulación UX es una inspección funcional del código y de los eventos implementados. No pudo completarse un E2E integrado contra datos reales debido a la divergencia de esquema.

# 2. Porcentaje de finalización

Los porcentajes valoran el resultado desplegable actual, no la suma de líneas escritas en ambos intentos.

| Área | Finalización | Justificación |
| --- | ---: | --- |
| Control horario dentro del perfil | 35% | A está integrado en el perfil y persiste; B crea una pantalla independiente. Ninguno reproduce íntegramente el detalle diario y los conceptos requeridos sobre una única fuente. |
| Control general | 42% | Hay dos tablas editables, agrupaciones y totales parciales; faltan columnas/semántica confirmada, edición universal segura y una implementación única desplegable. |
| Experiencia tipo Excel | 18% | Tab nativo y nombre fijado; faltan selección de rangos, pegado matricial, flechas, Enter, undo/redo, fill, redimensionado, orden y ocultación operativos. |
| Cálculos | 30% | Coinciden parcialmente G/N/O/S; productividad y horas no coinciden, se ignoran conceptos y se calcula con `Number`. |
| Persistencia | 30% | A persiste datos reales, pero está fuera de la rama activa; B carece de tablas aplicadas. |
| Fuente única de datos | 25% | A comparte `PayrollControlRecord`; B separa `EmployeeScheduleEntry` de `GestoriaCell`. La rama activa es B. |
| Permisos | 20% | B usa políticas tenant en rutas; A no. No existe permiso específico de reapertura y el frontend no refleja bien permisos de escritura. |
| Multiempresa | 15% | A permite acceso por identificadores de otra empresa; B mejora rutas, pero mezcla festivos entre empresas y la importación admite asociaciones no verificadas. |
| Auditoría | 25% | Hay llamadas de auditoría, pero varias no son atómicas, no garantizan éxito y no registran antes/después por celda. |
| Periodos y cierre | 30% | A tiene seis estados y B solo dos. Ambos presentan operaciones posibles tras cierre o carreras de cierre/guardado. |
| Exportación | 10% | Ningún exportador satisface el mapeo por código, preservación verificada, prevalidación e histórico descargable contra la plantilla real. |
| Tests | 18% | Pasan 80 tests unitarios relacionados entre ambas implementaciones; no prueban integración, tenant, cierre, Excel real ni UX. Hay 0 E2E específicos. |
| **Total del módulo** | **26%** | El trabajo existente es aprovechable, pero la arquitectura y los datos deben reconciliarse antes de continuar. |

# 3. Hallazgos

| ID | Severidad | Área | Descripción | Evidencia | Archivo y línea | Consecuencia | Solución recomendada |
| --- | --- | --- | --- | --- | --- | --- | --- |
| HRG-001 | Crítica | Arquitectura/datos | Hay dos módulos para el mismo dato. A está aplicado en BD; B está en la rama activa y pendiente. | BD: 2 periodos, 40 registros, 71 overrides A; 0 tablas B. `prisma:status` informa una migración aplicada no presente y tres locales pendientes. | A: `database/prisma/schema.prisma:1352-1497`; B: `database/prisma/schema.prisma:1335-1546,1591-1640` | Datos huérfanos, fallos de ejecución o pérdida de datos al migrar. | Elegir una base canónica, incorporar primero la migración aplicada al historial, diseñar una migración A→modelo final y retirar duplicados solo después de conciliación y backup. |
| HRG-002 | Crítica | Multiempresa | A recibe `companyId`, `periodId`, `recordId` y `employeeId` sin comprobar el tenant del usuario. | El controlador llama a servicios sin actor/empresa; servicios consultan por ID global. | A `PayrollControlController.ts:13-177`; A `PayrollControlService.ts:38,306-397,472-536,541-642` | Un usuario con permiso funcional puede leer/modificar/exportar otra empresa mediante API directa. | Pasar `ActorContext` a todos los servicios, resolver tenant en middleware y filtrar todas las consultas/mutaciones por empresa. Añadir tests cruzados A/B. |
| HRG-003 | Crítica | Exportación | Ningún exportador localiza la fila del empleado por el código contenido en B9:B91 de la plantilla. | A ordena por `employeeId` y escribe secuencialmente desde fila 9. B ordena departamento/nombre y también escribe secuencialmente. | A `PayrollControlService.ts:550,599-614`; B `GestoriaExportService.ts:144-252` | Importes asignados a trabajadores incorrectos. | Añadir código de gestoría único al empleado por empresa; indexar B9:B91; validar ausentes, duplicados y no encontrados; escribir solo por coincidencia de código. |
| HRG-004 | Crítica | Fuente única | En B el perfil horario usa `EmployeeScheduleEntry`, mientras el control general usa `GestoriaEmployeeRow/GestoriaCell`. | Modelos y APIs independientes; no hay relación ni servicio de proyección. | `schema.prisma:1433-1506,1591-1618`; `EmployeeScheduleService.ts`; `GestoriaRowService.ts` | El flujo perfil→general→perfil no sincroniza; hay dos fuentes de verdad. | No crear sincronización manual. Unificar en un agregado mensual canónico y hacer que ambas vistas editen los mismos valores. Mantener el detalle diario como desglose opcional del mismo agregado. |
| HRG-005 | Crítica | Exportación | B no puede abrir el `gestoria.xlsx` real: busca exclusivamente `gestoria_template.xls`. | La plantilla real es OOXML `.xlsx`; las rutas y el script usan `.xls`, `xlrd/xlutils`. | `GestoriaExportService.ts:114-130,387-400`; `backend/scripts/gestoria_export.py` | La exportación real falla antes de generar. Los 53 tests usan una fixture sintética `.xls`. | Usar directamente una copia binaria de `gestoria.xlsx` y una librería OOXML que preserve el libro; probar contra hash y diff estructural del archivo real. |
| HRG-006 | Alta | Seguridad/integridad | A expande el payload completo dentro de `updatedData`; no hay esquema Zod ni allowlist en runtime. | `const updatedData: any = { ...payload }`. | A `PayrollControlService.ts:323-364`; A `payrollControlRoutes.ts:7-18` | Una petición directa puede intentar reasignar `employeeId`, `periodId`, `gestoriaCode` u otros campos, eludiendo la inmutabilidad lógica del nombre. | Validación Zod estricta, `.strict()`, allowlist por operación y exclusión explícita de identidad/empresa/periodo. |
| HRG-007 | Alta | Seguridad/integridad | La importación de B acepta `employeeId`/`employeeName` del payload sin comprobar existencia ni pertenencia a empresa. | Crea filas con valores suministrados directamente. | `GestoriaImportService.ts:77-160`, especialmente `129-133` | Nombres manipulables, filas desconectadas y asociaciones cruzadas. | Retirar la importación automática de esta versión; si se conserva después, resolver empleado por ID/código dentro del tenant y tomar el nombre solo de `Employee`. |
| HRG-008 | Alta | Periodos | A permite transiciones arbitrarias entre seis strings; `CLOSED→DRAFT` no exige motivo. B solo tiene `OPEN/CLOSED`. | A valida pertenencia a una lista, no una máquina de estados. B enum limitado. | A `PayrollControlService.ts:472-507`; B `schema.prisma:1335-1338` | Se puede reabrir sin permiso/motivo o perder trazabilidad; faltan En revisión, Exportado, Enviado y Reabierto en B. | Máquina de estados explícita, permiso `rrhh.period.reopen`, motivo obligatorio y auditoría transaccional. |
| HRG-009 | Alta | Cierre | El cierre no bloquea todas las mutaciones. | A `getOrInitPeriod` añade empleados faltantes incluso a periodos cerrados; restore solo bloquea `CLOSED`, no `SENT`; `EXPORTED` sigue editable. B permite actualizar observaciones/revisión y crear/editar conceptos en cerrado. | A `PayrollControlService.ts:38-193,319,413`; B `GestoriaConceptService.ts:97-190`; B `GestoriaRowService.ts:253-300` | Un histórico cerrado puede cambiar. | Un único guard de estado en backend aplicado a toda mutación; `WHERE status/version` en la misma transacción; tests de cada endpoint y estado. |
| HRG-010 | Alta | Concurrencia | En B se comprueba `OPEN` antes de la transacción de celdas; cierre y guardado pueden cruzarse. | `assertOpen` y después `$transaction`. | `GestoriaRowService.ts:311-378` | Un cambio puede confirmarse después del cierre. | Bloqueo optimista con `version`, o actualización condicional del periodo dentro de la misma transacción con aislamiento adecuado. |
| HRG-011 | Alta | Sobrescrituras | B no modela valor calculado/manual/efectivo ni restauración. A lo modela parcialmente, pero para campos base “restaurar” conserva el valor manual en el campo base. | B `GestoriaCell` solo tiene un valor. A actualiza simultáneamente base, manual e indicador. | B `schema.prisma:1474-1506`; A `PayrollControlService.ts:323-364,402-465` | No se puede demostrar ni restaurar el cálculo original de forma fiable. | Mantener `calculatedValue`, `manualValue`, `effectiveValue` derivado, motivo opcional y evento de override; nunca sobrescribir el calculado con el manual. |
| HRG-012 | Alta | Auditoría | Varias mutaciones y su auditoría no son atómicas; `AuditService` puede agotar reintentos sin abortar la mutación. | Logs posteriores a updates; auditoría diseñada para no lanzar al fallar. | `GestoriaPeriodService.ts:243-320`; `GestoriaRowService.ts:347-378`; `AuditService.ts` | Cambios de nómina sin evidencia de antes/después, usuario o fecha fiable. | Outbox/evento de auditoría en la misma transacción; old/new por campo; impedir cierre/exportación si la auditoría no queda persistida. |
| HRG-013 | Alta | Cálculos | “Productividad” y “Horas” no coinciden con el Excel. | Excel: `P=H/O`, `Q=O-P`. A: productividad calculada = variable positiva; horas = bruto-productividad. B no calcula P/Q/R. | Excel `JUNIO!P4,Q4,R4`; A `PayrollControlService.ts:263-275`; B `GestoriaSummaryService.ts:176-227` | Resultados distintos al procedimiento actual y mezcla potencial de ratio e importe. | Confirmar con RRHH la semántica de H/P/Q; implementar fórmula versionada y pruebas de aceptación con casos aprobados. |
| HRG-014 | Alta | Cálculos | Cálculos y agregados monetarios convierten `Decimal` a `Number`. | Uso extensivo de `Number`, sumas JS y `toFixed`. | A `PayrollControlService.ts:210-289`; B `GestoriaRowService.ts:94-117`; B `GestoriaSummaryService.ts:155-227`; B `GestoriaExportService.ts:191-252` | Errores binarios, redondeo no controlado y exportes no reproducibles. | Decimal extremo a extremo, política de escala/redondeo explícita y redondeo por concepto/total confirmado con RRHH. |
| HRG-015 | Alta | UX | El control general no implementa operaciones de hoja de cálculo. | No hay manejadores de teclado/rangos/pegado/undo; `EditableTable` solo renderiza inputs y debounce. | `EditableTable.tsx:153-218,428-556`; `PayrollControlPage.tsx:397-603` | Trabajo mensual sensiblemente más lento que Excel y propenso a errores. | Incorporar un grid maduro o completar selección matricial, clipboard TSV, navegación, fill, undo/redo, columnas y virtualización antes de producción. |
| HRG-016 | Alta | Exportación/histórico | Los logs de B no almacenan el archivo; descargar un log antiguo regenera con datos actuales. | Se elimina el temporal, se conserva metadato y el endpoint descarga regenerando. | `GestoriaExportService.ts:387-479,483-507`; `GestoriaController.ts:402-454` | “Histórico” no reproducible; una descarga posterior puede diferir del archivo aprobado. | Almacenar cada binario inmutable con SHA-256, tamaño, plantillaHash, snapshot de valores/mapeo y acceso tenant. |
| HRG-017 | Alta | Código empleado | No hay un código de gestoría confirmado y único en `Employee`. | A usa `subaccount465`, DNI o fragmento UUID; B no escribe códigos de empleado en la plantilla. | A `PayrollControlService.ts:129,604`; `schema.prisma` modelo `Employee` | No se puede asociar inequívocamente al trabajador. | Añadir `payrollAgencyEmployeeCode` con unicidad por empresa y proceso de conciliación contra B9:B91; no asumir que `subaccount465` equivale al código. |
| HRG-018 | Alta | Flexibilidad | A es rígida: columnas por concepto y `customConcepts` texto; `PayrollControlConceptConfig` no se usa. B es EAV configurable, pero no enlaza cálculos/overrides ni datos existentes. | Modelos y servicios de ambos intentos. | A `schema.prisma:1374-1497`; B `schema.prisma:1397-1506` | Añadir conceptos en A exige migración; adoptar B sin migración pierde semántica/histórico. | Diseñar un modelo final híbrido: campos estructurales tipados + definiciones configurables + valores mensuales + motor de cálculo/override versionado. Migrar A. |
| HRG-019 | Alta | Permisos/UX | El frontend de B protege por feature de lectura, pero muestra edición; los perfiles HR/manager tienen `gestoria: read` por defecto. | Las rutas UI usan `ProtectedRoute feature="gestoria"`; `COMPANY_STAFF_DEFAULTS` da read. | `frontend/src/App.tsx:220-224`; `shared/authz/index.ts:92-135,184-185` | RRHH ve controles que el backend rechaza o, si se amplía demasiado, recibe permisos de cierre/exportación no segregados. | Capabilities separadas read/write/close/reopen/export en frontend y backend; ocultar/deshabilitar acciones según permiso efectivo. |
| HRG-020 | Media | Edición masiva | “Marcar revisados” de B envía IDs de empleado, pero el backend los compara con el ID de fila. | Frontend construye `employeeIds`; backend filtra `id in employeeIds`. | `GestoriaControlPage.tsx:262-266`; `GestoriaBulkService.ts:72-100` | La operación informa éxito y actualiza 0 filas. | Usar `employeeId` en el filtro o enviar `rowIds`; devolver y comprobar recuento esperado. |
| HRG-021 | Media | Porcentajes | En `EditableTable`, mostrar porcentaje multiplica por 100, pero el parser almacena lo escrito sin dividir por 100. | Formato y parseo no son inversos; resumen espera 0..1. | `EditableTable.tsx` utilidades de formato/parseo; `GestoriaSummaryService.ts:123,192-197` | Introducir 17% puede almacenarse como 17 y mostrarse como 1700%. | Normalizar porcentaje a decimal al parsear, validar 0..1 o rango empresarial y cubrir ida/vuelta con test. |
| HRG-022 | Media | Horario | La pausa por defecto de 30 min no se aplica: controlador/filas vacías convierten ausencia en `0`, anulando `?? lunch`. | Se fuerza `discountMin: 0`. | `EmployeeScheduleController.ts:70-96`; `EmployeeScheduleService.ts:101-125,203-233` | Las horas extra se sobrecalculan 0,5 h en días laborables sin pausa explícita. | Preservar `null/undefined` y aplicar la política congelada del periodo; test de día 08:00–18:00 con pausa por defecto. |
| HRG-023 | Media | Multiempresa/horario | Los festivos de B se leen sin filtro de empresa/región. | Consulta solo por fecha. | `EmployeeScheduleService.ts:140-160` | Un festivo de una empresa puede convertir horas de otra en festivas. | Filtrar por nacional + región del centro + `companyId`; resolver precedencia determinista y guardar la regla aplicada. |
| HRG-024 | Media | Validación horario | El regex de hora acepta valores como `99:99`; el parser inválido cae a 0. | Validación formal sin rango horario. | `EmployeeScheduleController.ts:70-96`; parser de `EmployeeScheduleService.ts` | Se almacena medianoche o cálculo erróneo en lugar de rechazar. | Zod `HH:mm` con rango 00:00–23:59, coherencia de pares y reglas de cruce de medianoche. |
| HRG-025 | Media | Control horario | B crea `/employees/:id/schedule` independiente y un segundo `/gestoria/employee/...`, contra el requisito de pestaña única. | Rutas explícitas. | `frontend/src/App.tsx:221-233`; `Header.tsx:107-112` | Duplicación de ficha y más cambios de pantalla. | Conservar la integración en `EmployeeDetail` de A y hacerla consumir el agregado mensual final. Retirar rutas redundantes tras migrar. |
| HRG-026 | Media | Excel origen | `horario.xlsx` contiene `#VALUE!` cacheado en N3/N5/P5 de todas las hojas mensuales. | `SUMPRODUCT((J>0)*(J))` opera sobre celdas que devuelven texto vacío. | `horario.xlsx`, N3/N5/P5 de 13 hojas | El Excel de referencia no es una verdad matemática completamente fiable. | Confirmar con RRHH si solo se suman extras positivas; usar una fórmula robusta y documentar que la app corrige la anomalía aprobada. |
| HRG-027 | Media | Totales Excel | Varios subtotales del control tienen rangos inconsistentes. | Ej.: I3/J3 solo 4:5; P3 solo 4:6; O/P/R44 solo 45:62; P/R40 solo fila 41. | `2026 CONTROL (1).xlsx`, filas 3, 40 y 44 | Totales por grupo pueden omitir empleados. | Confirmación de RRHH antes de copiar literalmente; definir rangos por pertenencia de grupo, no por fórmulas manuales. |
| HRG-028 | Media | Rendimiento/guardado | B programa guardados por fila/celda sin cancelar timers al desmontar y puede solapar payloads completos de fila. | Timers y estado de trabajo local; sincronización mediante setState durante render. | `GestoriaControlPage.tsx:190-213`; `EditableTable.tsx:158-218` | Carreras, último guardado gana, pérdida silenciosa al navegar y renders frágiles. | Cola serial por fila con revisión/version, flush al navegar, indicador persistente, retry y protección `beforeunload`. |
| HRG-029 | Media | Nombre inmutable | A muestra el nombre desde `Employee`, pero permite alterar la asociación del registro por payload; B guarda `employeeName` mutable como snapshot y la importación lo acepta. | Véanse HRG-006/007. | A `PayrollControlService.ts:323`; B `schema.prisma:1433-1468`, `GestoriaImportService.ts:129-133` | No se cumple la protección backend frente a manipulación de payload. | Identidad de fila derivada e inmutable; nombre solo lectura desde `Employee` y snapshot controlado por backend para histórico. |
| HRG-030 | Media | Calidad | Prisma valida/genera y ambos builds pasan, pero migraciones y lints fallan. | Estado técnico reproducido en § Pruebas. | Migraciones y archivos de lint indicados abajo. | Compilar ofrece falsa confianza de desplegabilidad. | Resolver primero historial de migraciones y errores lint; introducir gates CI específicos del módulo. |
| HRG-031 | Media | Tests | Los tests no usan la plantilla real ni prueban API/tenant/cierre/fuente única/overrides/UX. | 53 backend B + 25 frontend B + 2 cálculo A pasan; 0 E2E específicos. | `GestoriaExportPipeline.test.ts:21-22`; suites listadas en § Pruebas | Regresiones críticas pasan CI. | Matriz de integración y E2E con dos empresas, periodo cerrado, concurrencia, plantilla real copiada y comparación de hashes/estilos. |
| HRG-032 | Baja | Fechas | A ofrece años fijos 2024–2027. | Lista hardcodeada. | A `EmployeeControlHorarioSection.tsx:135-143`; A `PayrollControlPage.tsx:248-254` | El módulo caduca y no permite históricos/futuros fuera del rango. | Generar rango configurable y validar año/mes en backend. |

# 4. Comparación con los Excel

## 4.1 Matriz funcional

| Campo o comportamiento | Excel | Aplicación | Estado | Observaciones |
| --- | --- | --- | --- | --- |
| Empleado actual | Manual en C2 de `horario`; nombres en D de control; código/nombre B:C en gestoría | A toma `Employee` y comparte registro. B usa snapshots y pantalla aparte. | Parcial | La identidad final debe proceder de `Employee`; código de gestoría aún no confirmado. |
| Empresa/año/mes | No normalizado entre libros | A y B modelan empresa+año+mes con unique. | Parcial | La base solo tiene A; B no está migrada. |
| Detalle diario | Fecha, 2 entradas, 2 salidas, trabajadas, descuento, laborales, extras, festivas, observaciones | Solo B lo modela; A no. | Parcial | B no comparte fuente con el control general y calcula mal la pausa por defecto. |
| Tarifa extra normal | `horario!N1`; control B | A columna mensual Decimal; B concepto configurable | Parcial | A congela valor al crear, pero restauración es defectuosa. |
| Tarifa festiva | `horario!O1`; control C | A y B la representan | Parcial | La plantilla de gestoría solo tiene un concepto 434, no distingue tarifas. |
| Horas extra normales | `horario!J`, control E | A mensual; B horario diario y concepto separado | Incorrecto | En B las dos vistas no comparten registro. |
| Horas sábado/domingo/festivo | `horario!K`, control F | A mensual; B cálculo diario | Incorrecto | Festivos sin tenant; código 434 no confirma si exporta importe agregado. |
| Importe horas | N5+O5 / control G | A y resumen B calculan tarifa×horas | Parcial | Coincide en lo básico, pero usan `Number` y no política de redondeo. |
| Variable positiva | Control H | A columna; B concepto | Parcial | El Excel no la incorpora a G/O; se usa en P como numerador. Requiere confirmación. |
| Variable negativa | Control I | A columna; B concepto | Parcial | A la exporta erróneamente como comisión; no participa en cálculo. |
| Dietas | Control J; gestoría I/604 | A y B | Parcial | En export A se escribe importe; B depende de concepto/mapeo. |
| Separador | Control K vacío | No necesario | Correcto | No es dato empresarial. |
| IRPF | Control L | A y B | Parcial | Fracción 0..1; B tiene bug de entrada porcentual. |
| TGSS | Control M | A y B | Parcial | Mismo problema de redondeo/porcentaje. |
| Porcentaje restante | Control N, sin cabecera, `1-L-M` | A calculado/override; B resumen calculado | Parcial | B no admite override; A sí pero restore imperfecto. |
| Bruto | Control O, `G/N` | A y B resumen | Parcial | No trata como el Excel H/I/J; división por cero se fuerza a 0/clamp. |
| Productividad | Control P, `H/O` | A usa H como importe; B no la calcula | Incorrecto | La fórmula Excel produce ratio, aunque la etiqueta/uso es ambiguo. |
| Horas | Control Q, `O-P` | A usa `gross-productivity` con productividad=H; B ausente | Incorrecto | Excel mezcla aparente importe y ratio. Debe confirmarse. |
| Comprobación | Control R, identidad neto-G | No representada como columna en A/B | Ausente | Campo útil para detectar incoherencias. |
| Diferencia | Control S, `O-G` | A y B resumen | Parcial | Coincide en fórmula básica. |
| Categoría | Control A | A snapshot editable; B snapshot editable | Parcial | Requisito permite editarla; debe conservar histórico y no sobrescribir Employee sin intención. |
| Nombre solo lectura/fijado | Control D | A: readonly+sticky en UI; B: primera columna sticky | Parcial | Backend no garantiza identidad por HRG-006/007. |
| Agrupaciones/subtotales | Filas por categoría con subtotales y total fila 1 | A agrupa por departamento; B agrupa por categoría | Parcial | Ninguno replica de forma completa departamento+categoría y subtotales configurables. |
| Sobrescrituras | Excel permite editar cualquier celda/fórmula | A intenta manual/calculado; B no modela overrides | Incorrecto | Falta antes/nuevo/efectivo/restauración fiable. |
| Estados de revisión | No estructurado | A periodo; B fila `isReviewed` | Parcial | Bulk de B no funciona y puede editarse cerrado. |
| Atrasos | Solo gestoría 044 | No hay campo funcional real; A exporta 0 | Ausente | Debe ser concepto configurable mensual. |
| Comisión | Solo gestoría 048 | A reutiliza variable negativa | Incorrecto | Conceptos empresariales distintos. |
| Gastos | Solo gestoría 182 | A exporta 0; B configurable | Parcial | Falta fuente mensual confirmada. |
| Anticipo semanal | Solo gestoría 791 | A exporta 0; B configurable | Parcial | Falta fuente mensual confirmada. |
| Otros conceptos | No presentes en columnas base | A `customConcepts` texto sin uso; B dinámicos | Parcial | Modelo final debe conservar flexibilidad de B con auditoría/cálculo. |
| Copiar/pegar rangos | Nativo Excel | No implementado | Ausente | Un input HTML solo copia una celda como texto. |
| Plantilla gestoría inmutable | Libro protegido, formatos, nombres definidos | A la lee en memoria; B busca otro formato | Incorrecto | Ninguno verifica hash ni estructura después. |
| Mapeo por código | B9:B91 | Ninguno | Ausente | Bloqueo crítico de exportación. |
| Histórico de exportaciones | No aplica al Excel manual | A no registra archivo; B registra metadatos y regenera | Incorrecto | Debe persistirse el binario exacto. |

## 4.2 Estructura real de `horario.xlsx`

- **14 hojas:** `DICIEMBRE 2025`, los 12 meses de 2026 y `FESTIVOS`.
- Hojas mensuales de 16 columnas A:P y filas 33–36 según el mes.
- Única combinación por hoja: `C2:D2`.
- Sin validaciones de datos, protección, paneles congelados ni formato condicional.
- Parámetros: empleado en C2, mes en F3, pausa en H3 (`00:30`), jornada en I3 (`08:00`), tarifas en N1 (`9 €`) y O1 (`10 €`).
- Cabeceras desde fila 5: Día, Fechas, Entrada 1, Salida 1, Entrada 2, Salida 2, H. trabajadas, Descontar, H. laborales, H. extra, H. extra festivos, Observaciones.
- `FESTIVOS!A1:A24` contiene fechas 2025/2026 sin etiqueta ni empresa/región.
- Cálculos diarios exactos, ejemplo fila 6:
  - `G6 = IF(AND(C6="",D6="",E6="",F6=""),0,(F6-E6+D6-C6)*24)`
  - `H6 = IF(OR(WEEKDAY($B6,2)>5,COUNTIF(FESTIVOS!$A:$A,$B6)>0),0,$H$3*24)`
  - `I6 = IF(OR(WEEKDAY($B6,2)>5,COUNTIF(FESTIVOS!$A:$A,$B6)>0),0,$I$3*24)`
  - `J6 = IF(OR(...),"",G6-I6-H6)`
  - `K6 = IF(OR(...),G6,"")`
  - `N3 = SUMPRODUCT((J6:J36>0)*(J6:J36))`
  - `O3 = SUM(K6:K36)`, `N5=N3*N1`, `O5=O3*O1`, `P5=N5+O5`.

Las 13 hojas mensuales tienen `#VALUE!` almacenado en N3, propagado a N5 y P5. La causa probable es la combinación de `SUMPRODUCT` con resultados texto `""`; esta interpretación debe confirmarse con RRHH antes de declarar que la aplicación debe copiar o corregir la fórmula.

## 4.3 Inventario exacto de columnas de `2026 CONTROL (1).xlsx`

Hoja única `JUNIO`. Datos funcionales A:S, filas 1–77; el rango usado aparente llega a 158×255 por estilos residuales.

| Columna | Cabecera/finalidad | Tipo observado | Fórmula por empleado |
| --- | --- | --- | --- |
| A | Categoría | Texto manual | — |
| B | H. EXT. (precio) | Decimal manual | — |
| C | H.S/D EXT (precio) | Decimal manual | — |
| D | Trabajador | Texto manual | — |
| E | H. EXT. (cantidad) | Decimal manual | — |
| F | H.S/D EXT (cantidad) | Decimal manual | — |
| G | total | Importe calculado | `B*E+C*F` |
| H | Variable Positiva | Decimal manual | — |
| I | Variable Negativa | Decimal manual | — |
| J | Dietas Normales | Importe manual | — |
| K | Vacía/separador | — | — |
| L | IRPF | Porcentaje manual | — |
| M | TGSS | Porcentaje manual | — |
| N | Sin cabecera; porcentaje disponible | Porcentaje calculado | `1-L-M` |
| O | BRUTO | Importe calculado | `G/N` |
| P | productividad | Decimal calculado | `H/O` |
| Q | horas | Decimal calculado | `O-P` |
| R | Sin cabecera; comprobación | Decimal calculado | `(O-(O*L+O*M))-G` |
| S | DIFERENCIA | Importe calculado | `O-G` |

No hay celdas combinadas, validaciones, protección, freeze panes, autofiltro, tabla ni formato condicional. Los grupos son Costureros (fila 3), Producción (17), Corte (21), Tapiceros (26), Carpinteros (37), Almacén (40) e Instaladores (44).

## 4.4 Estructura real de `gestoria.xlsx`

- Hoja: `Conceptos`.
- Cabecera de trabajadores: fila 8.
- Primera/última fila poblada de trabajador: 9/91; **83 trabajadores**.
- B: Código; C: Nombre.
- D: `044 - ATRASOS  (I)`.
- E: `048 - COMISION (I)`.
- F: `050 - PRODUC   (I)`.
- G: `182 - Gastos l (I)`.
- H: `434 - H.EXT. 1 (I)`.
- I: `604 - DIETAS   (I)`.
- J: `791 - ANT.SEM. (I)`.
- B7:C7 combinada; panel congelado en D9 (tres columnas y ocho filas).
- Hoja protegida; código/nombre bloqueados y zona de conceptos desbloqueada.
- Validación decimal `-999999999999.99..999999999999.99` en D9:IV1091.
- Formato de concepto `#,##0.00`; ancho B 8,41, C 43,7, D:GU aproximadamente 18,7.
- Área de impresión A1:J95, títulos A:C y filas 1:8, horizontal, escala 90.
- Nombres definidos relevantes: `CodEmpresa=D2`, `CodTrabajador1=B9`, `NomTrabajador1=C9`, `Concepto1=D8`.
- Contenido fijo: A1 identificador, D2 empresa 1207, E2 `DECORACIONES EGEA SL`, D5 fecha textual.

El sufijo `(I)`, el formato decimal y la validación permiten inferir con alta confianza que D:J esperan **importes**, no horas ni unidades. Aun así, para 434 debe confirmarse si la gestoría espera el importe total de todas las horas extra o solo una clase concreta.

# 5. Inventario de campos

## 5.1 Campos estructurales, mensuales y calculados

| Origen | Campo | Significado/tipo | Existe | Persistencia actual | Editable | Calculado | Override | Exporta / concepto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Todos | Empresa | FK/tenant | Sí A/B | A `PayrollControlPeriod.companyId`; B `GestoriaPeriod.companyId` | No en fila | No | No | D2, no resuelto correctamente |
| Todos | Año/mes | Enteros de periodo | Sí A/B | Periodo unique empresa+año+mes | Selector | No | No | Fecha/cabecera |
| Employee | Empleado | FK | Sí A/B | A record; B row nullable | No debería | No | No | Código/nombre |
| Employee | Nombre | Texto derivado | Sí | A relación live; B snapshot | UI no; backend vulnerable | No | No | C |
| Employee | Código gestoría | Código externo | No confirmado | A `gestoriaCode`/fallback; B ausente en Employee | Solo administración | No | No | B |
| Control | Categoría | Snapshot histórico/texto | Sí | A record; B row | Sí | No | No | No |
| Control | Departamento | Snapshot histórico/texto | Sí | A/B row | B sí/A agrupador | No | No | No |
| Horario | Fecha | Date | Solo B | `EmployeeScheduleEntry.date` | Sí | No | No | No |
| Horario | Entrada/salida 1/2 | Hora | Solo B | 4 strings | Sí | No | No | No |
| Horario | Horas trabajadas | Decimal | Solo B runtime | No persistido como resultado | Indirecto | Sí | No | No |
| Horario | Descuento/pausa | Minutos entero | Solo B | `discountMin` | Sí | No/default | No | No |
| Horario | Horas laborales | Decimal | Solo cálculo | No snapshot | No | Sí | No | No |
| Horario | H. extra normal diaria | Decimal | Solo B runtime | No agregado compartido | Indirecto | Sí | No | 434 debería recibir importe |
| Horario | H. festiva diaria | Decimal | Solo B runtime | No agregado compartido | Indirecto | Sí | No | 434 por confirmar |
| Horario | Observaciones | Texto | Sí | A mensual/B diaria y fila | Sí | No | No | No |
| Control | Precio HE normal | Decimal monetario | Sí | A columnas Decimal; B cell | Sí | No | A parcial/B no | No directo |
| Control | Precio HE festiva | Decimal monetario | Sí | A/B | Sí | No | A parcial/B no | No directo |
| Control | Cantidad HE normal | Decimal horas | Sí | A/B | Sí | No | A parcial/B no | Indirecto 434 |
| Control | Cantidad HE festiva | Decimal horas | Sí | A/B | Sí | No | A parcial/B no | Indirecto 434 |
| Control | Importe total HE | Decimal dinero | Sí | A calculado/manual; B summary/total | Requisito sí | Sí | A sí defectuoso/B no | H / 434 |
| Control | Variable positiva | Decimal ambiguo | Sí | A/B | Sí | No | A parcial/B no | F/050 potencial |
| Control | Variable negativa | Decimal ambiguo | Sí | A/B | Sí | No | A parcial/B no | No es automáticamente 048 |
| Control | Dietas | Decimal dinero | Sí | A/B | Sí | No | A parcial/B no | I / 604 |
| Control | IRPF | Decimal porcentaje | Sí | A/B | Sí | No | A parcial/B no | No |
| Control | TGSS | Decimal porcentaje | Sí | A/B | Sí | No | A parcial/B no | No |
| Control | % disponible | Decimal porcentaje | Sí | A/B summary | Requisito sí | Sí | A sí/B no | No |
| Control | Bruto | Decimal dinero | Sí | A/B summary | Requisito sí | Sí | A sí/B no | No |
| Control | Productividad | Semántica por confirmar | A campo/B concepto | A persistido; B no calculado | Sí | Excel sí | A sí/B no | F / 050 |
| Control | Horas (Q) | Semántica por confirmar | Solo A como `hoursAmount` | Decimal | A UI no | Sí | A modelo sí | No |
| Control | Comprobación (R) | Identidad/control | No | — | Requisito sí | Sí | No | No |
| Control | Diferencia | Decimal dinero | Sí | A/B summary | A UI no/B no campo | Sí | A modelo sí/B no | No |
| Control | Estado revisión | Boolean/estado | B fila | `isReviewed` | Sí | No | No | No |
| Control | Estado periodo | Enum/string | Sí | A seis estados; B dos | Acción | No | No | No |
| Concepto | Atrasos | Importe mensual | Solo configurable B | No datos actuales | Sí | No | Debería | D / 044 |
| Concepto | Comisión | Importe mensual | Solo configurable B | No datos actuales | Sí | No | Debería | E / 048 |
| Concepto | Gastos | Importe mensual | Solo configurable B | No datos actuales | Sí | No | Debería | G / 182 |
| Concepto | Anticipo semanal | Importe mensual | Solo configurable B | No datos actuales | Sí | No | Debería | J / 791 |
| Concepto | Otros | Valor mensual tipado | B permite tipos; A texto JSON | No modelo final | Sí | Según definición | Debería | Mapeable |
| Auditoría | Antes/nuevo/usuario/fecha | Evento | Parcial | A overrides + audit; B audit genérico | No | No | N/A | No |

## 5.2 Evaluación del modelo

La implementación A distingue muchos campos calculados/manuales, pero es excesivamente rígida y duplica tres valores por cada columna. `PayrollControlConceptConfig` no está conectado a los registros ni a la exportación. `customConcepts` es texto sin esquema.

La implementación B aporta una buena dirección para conceptos configurables (`GestoriaConcept` + `GestoriaCell`), pero mezcla el concepto de control RRHH con la exportación, no modela cálculos ni overrides y no incluye los datos existentes.

El modelo final recomendado debe separar:

1. **Estructura:** periodo, empresa, empleado, categoría/departamento históricos, estado y versión.
2. **Definición de concepto:** clave estable, etiqueta, tipo/unidad, precisión, vigencia, código de gestoría y regla de cálculo.
3. **Valor mensual:** concepto+registro, valor calculado y valor manual nullable.
4. **Valor efectivo:** derivado, no una tercera fuente mutable.
5. **Detalle diario opcional:** asociado al mismo registro mensual y preparado para una futura fuente de fichajes, sin activarla ahora.
6. **Histórico:** snapshot de tarifas/reglas y eventos de auditoría/exportación.

# 6. Cálculos

## 6.1 Fórmulas del control principal

Ejemplo común para comparar: B=10 €/h, C=12 €/h, E=5 h, F=2 h, H=20, L=17%, M=6,35%.

| Campo | Fórmula Excel | Fórmula aplicación | Ejemplo esperado Excel | Resultado app | Redondeo | Veredicto |
| --- | --- | --- | ---: | ---: | --- | --- |
| Importe horas G | `B*E+C*F` | A/B: igual | 74,00 | 74,00 | Excel solo formato; app `Number`/toFixed | Parcialmente correcto |
| % restante N | `1-L-M` | A igual; B `max(0,1-L-M)` | 0,7665 | 0,7665 | Sin ROUND | B difiere si negativo |
| Bruto O | `G/N` | A/B, si N≤0 devuelven 0 | 96,5427 | 96,54 visual | Excel daría división/negativo; app clamp | Parcial, política no aprobada |
| Productividad P | `H/O` | A `H`; B ausente | 0,20717 | A: 20,00 | Sin ROUND | Incorrecto |
| Horas Q | `O-P` | A `O-H`; B ausente | 96,3355 | A: 76,5427 | Sin ROUND | Incorrecto |
| Comprobación R | `(O-(O*L+O*M))-G` | Ausente | ≈0 | N/A | Error binario posible | Ausente |
| Diferencia S | `O-G` | A/B igual | 22,5427 | 22,54 visual | Sin ROUND explícito | Parcialmente correcto |
| Ratio global H1 | `(O1-G1)/G1` | Ausente | Según total | N/A | División por cero no tratada | Ausente |

### Tratamiento de vacíos y negativos

- El Excel usa residuos mínimos (`1e-15`) en numerosas celdas aparentemente vacías, evitando algunas divisiones por cero de forma accidental. No debe copiarse esta práctica.
- A y B convierten vacíos a cero.
- B limita N a cero; el Excel no.
- A limita cálculos dependientes cuando N≤0; no existe especificación empresarial que avale ese comportamiento.
- No hay una política común de escala, `ROUND`, redondeo bancario o redondeo por línea/total.
- H/I/J no se incorporan a G/O en el Excel. Antes de “corregirlo” se necesita confirmar si son informativos, pagos aparte o entradas para otros cálculos.

## 6.2 Fórmulas de horario

| Campo | Excel | B | Ejemplo | Veredicto |
| --- | --- | --- | --- | --- |
| Trabajadas | `(F-E+D-C)*24`, o 0 si los cuatro vacíos | Suma de intervalos y admite cruce de medianoche | 08:00–18:00 = 10 h | B mejora cruce de día, pero la diferencia debe aprobarse |
| Descuento | 0 en fin de semana/festivo; 0,5 h laborable | `discountMin ?? 30`, pero recibe 0 por defecto | 10 h laborable | Excel resta 0,5; B no resta nada |
| Jornada | 8 h laborable, 0 festivo | default 8 | 8 | Correcto parcialmente |
| Extra normal | `G-I-H`, incluso negativa; total solo suma positivas | `max(0,worked-discount-daily)` | 10−0,5−8=1,5 | B produce 2 por bug de descuento |
| Extra festiva | Todo G | Todo trabajado | 10 h sábado | Correcto si festivo/tenant se resuelve bien |

## 6.3 Totales y ambigüedades del Excel

Los subtotales no son uniformes:

- Fila 3: G/H/O/Q/S abarcan 4:14, pero I/J solo 4:5 y P solo 4:6.
- Fila 26: G/H/I/J abarcan 27:34, mientras O/P/Q/R/S abarcan 27:35.
- Fila 40: P/R solo fila 41, resto 41:42.
- Fila 44: G/H/I/J/Q/S abarcan 45:76, O/P/R solo 45:62, aunque existen empleados hasta 77.

No se afirma que todos sean errores: podrían reflejar exclusiones manuales. RRHH debe confirmar la pertenencia a grupos y el propósito de P/Q/R. La aplicación debe versionar una regla aprobada, no copiar rangos frágiles.

## 6.4 Tipos e histórico

- Prisma usa `Decimal` para importes de ambos modelos, pero los servicios convierten inmediatamente a `Number`.
- `Employee.weeklyHours` es `Float`, aunque no es un importe; puede ser aceptable para jornada, pero los cálculos mensuales deben usar Decimal.
- Las tarifas A se copian al registro mensual al inicializar y B se almacena por concepto/periodo, lo que permite congelarlas conceptualmente.
- A, sin embargo, crea registros faltantes al volver a leer un periodo, incluso cerrado, usando los defaults actuales (9/10). Esto rompe la garantía histórica.
- La fórmula/regla aplicada no tiene versión ni snapshot. Cambiar código cambia el recálculo histórico.

# 7. Experiencia de RRHH

## Flujo evaluado

Se inspeccionó el flujo de 20 empleados con periodo existente:

1. Selección de periodo.
2. Edición de tarifas, horas, variables, dietas e impuestos.
3. Revisión de subtotales.
4. Corrección de un valor.
5. Cierre y acceso a exportación.
6. Consulta desde el perfil.

No pudo ejecutarse como E2E contra la BD porque A contiene los datos pero no está en la rama activa, y B está en la rama activa pero sus tablas no existen. Esta incompatibilidad es en sí misma un fallo de aceptación.

## Medición aproximada

- A, con 20 empleados y 10 campos mensuales: aproximadamente **220–280 selecciones/blur** más scroll horizontal; cada valor se guarda al salir del input.
- B, si los conceptos ya existen: aproximadamente **240–320 interacciones**. Si el periodo es nuevo, hay que crear/configurar conceptos y añadir empleados, llevando el flujo por encima de **300–400 acciones**.
- Cambios de pantalla:
  - A: control general, perfil y exportación: 2–3.
  - B: periodos, control, conceptos, detalle de gestoría, horario independiente y exportación: 4–6.
- En Excel, una matriz preparada para 20 empleados puede pegarse en una sola operación y completarse con relleno/arrastre. La app exige edición celda a celda.

## Teclado y clipboard

| Capacidad | A | B |
| --- | --- | --- |
| Click directo en celda | Sí, input | Sí, input |
| Tab | Nativo | Nativo |
| Enter a siguiente celda | No | No |
| Flechas entre celdas | No | No |
| Copiar una celda | Texto del input | Texto del input |
| Copiar/pegar rango TSV | No | No |
| Pegar matriz Excel | No | No |
| Selección multicelda | No | No |
| Selección filas | No | Parcial; bulk revisado roto |
| Fill/repetir | No | Operación bulk limitada, no UX de rango |
| Borrar rango | No | No |
| Undo/redo | No | No |
| Nombre fijado | Sí | Sí |
| Cabecera vertical fijada | Sí en A | No de forma completa en B |
| Resize/reordenar/ocultar | No | Servicio de vistas existe, pero no está integrado como experiencia completa |
| Buscar | Nombre | Nombre/departamento/categoría |
| Ordenar | No | No operativo por columna |
| Agrupar | Departamento | Categoría |
| Subtotales/general | Sí parciales | Sí parciales |
| Guardando/error | Indicador global | Indicadores por celda/fila |
| Guardado confirmado | Breve | No estado durable claro |
| Retry | No | No |
| Protección al salir | No | No |
| Virtualización | No | No |

## Operaciones más lentas que Excel

1. Carga masiva de horas/variables.
2. Repetir IRPF/TGSS/tarifas en varios empleados.
3. Corregir un bloque de valores.
4. Comparar empleados no contiguos.
5. Reordenar y ocultar columnas para una tarea concreta.
6. Detectar pendientes: no hay reglas/colores/validaciones completas.
7. Recuperarse de un fallo: el DOM puede mostrar un valor que el servidor rechazó.
8. Navegar entre perfil, control y exportación.

## Riesgos humanos

- Creer que una operación masiva funcionó cuando actualizó 0 filas.
- Introducir 17 y almacenar 1700%.
- Abandonar la pantalla con timers pendientes.
- Sobrescribir el valor más reciente por guardados solapados.
- Editar el periodo/empresa equivocado por falta de contexto persistente.
- Exportar importes al empleado equivocado por mapeo secuencial.
- Confundir variable negativa con comisión.
- No detectar conceptos sin mapeo o empleados sin código.

## Clasificación de comodidad

**No apta para sustituir el Excel.**

Aunque las pantallas son utilizables para cambios aislados, el trabajo intensivo mensual de 20 o más empleados es claramente más lento que Excel y carece de controles de integridad suficientes.

## Recomendaciones UX prioritarias

1. Conservar una sola pantalla general y una sola pestaña dentro del perfil.
2. Grid con navegación Excel, clipboard TSV matricial, selección, fill, delete, undo/redo y guardado por lote transaccional.
3. Nombre y cabeceras fijados; columnas configurables y orden/filtro por cualquier campo.
4. Validación visual de pendientes y discrepancias.
5. Cola de guardado con versión, retry y protección al salir.
6. Vista previa de exportación por empleado/código/concepto antes de generar.

# 8. Exportación

## 8.1 Mapeo que exige la plantilla

| Dato | Ubicación real | Regla necesaria | Estado A | Estado B |
| --- | --- | --- | --- | --- |
| Empresa | D2/E2 | Código/nombre de la empresa del periodo | Parcial | No validado contra plantilla |
| Fecha | D5 | Fecha de generación/periodo según criterio RRHH | Parcial | No confirmado |
| Código trabajador | B9:B91 | Coincidencia exacta con código externo único | No; sobrescribe secuencial | No; ni lo escribe/mapea |
| Nombre | C9:C91 | Solo comprobación, no clave | Sobrescribe secuencial | Escribe por fila secuencial |
| 044 atrasos | D | Importe | Siempre 0 | Concepto dinámico si se configura |
| 048 comisión | E | Importe | Variable negativa, incorrecto | Concepto dinámico |
| 050 productividad | F | Importe | Productividad o variable positiva | Concepto dinámico |
| 182 gastos | G | Importe | Siempre 0 | Concepto dinámico |
| 434 H.EXT.1 | H | Importe de horas por confirmar | Total HE | Concepto dinámico |
| 604 dietas | I | Importe | Dietas | Concepto dinámico |
| 791 anticipo | J | Importe | Siempre 0 | Concepto dinámico |

## 8.2 Filas/columnas que modificarían los exportadores actuales

- A modifica D2/E2/D5 y, desde fila 9, B:J en orden de `employeeId`.
- B construye direcciones desde un mapeo y desplaza la fila base secuencialmente según orden departamento/nombre.
- Ninguno busca primero el código de la plantilla.
- A deja sin limpiar las filas restantes de la plantilla si hay menos registros, por lo que puede mezclar plantilla original con empleados reordenados.
- B no usa el archivo real y su script `.xls` escribe valores sin copiar explícitamente el estilo de la celda destino; la preservación no está demostrada.

## 8.3 Prevalidación y errores

| Comprobación | A | B |
| --- | --- | --- |
| Empleado sin código | No; usa fallbacks peligrosos | No existe código empleado |
| Código duplicado | No | No |
| Empleado no presente en plantilla | No | No |
| Empleado de plantilla no incluido | No | No |
| Concepto sin mapeo | No | Warning, pero permite generar |
| Vista previa por empleado/importe | No | Resumen/mapping, no reconciliación con filas reales |
| Preservación estructura | No verificada | No compatible con `.xlsx` real |
| Log usuario/fecha/periodo | Solo audit genérico | Sí metadatos |
| Binario histórico | No | No |
| No sobrescribir | Nombre fijo por periodo en descarga local | Temporales distintos, pero no se conservan |
| Reproducibilidad | No | No; regenera con datos actuales |
| Tenant al descargar log | N/A | `recordDownload(logId)` no comprueba que el log pertenezca al periodo/tenant |

## 8.4 Hash e inmutabilidad

| Archivo original | SHA-256 antes | SHA-256 después | Resultado |
| --- | --- | --- | --- |
| `horario.xlsx` | `9d8ebe364b3045156d39af2200c3839179284980d21985eeb332190a7c6794d3` | `9d8ebe364b3045156d39af2200c3839179284980d21985eeb332190a7c6794d3` | Idéntico; no se escribió |
| `2026 CONTROL (1).xlsx` | `45e9a31e93c4abfd0369657d8d2abf144f05198774aaa6c9b1f80c3000633fd9` | `45e9a31e93c4abfd0369657d8d2abf144f05198774aaa6c9b1f80c3000633fd9` | Idéntico; no se escribió |
| `gestoria.xlsx` | `cfdcc8d6355ca468b23dbd09c5b35fb20dde368a4444a64956d80d571d3c632d` | `cfdcc8d6355ca468b23dbd09c5b35fb20dde368a4444a64956d80d571d3c632d` | Idéntico; no se escribió |

No se generó una copia “válida” porque el exportador activo no admite la plantilla real. Por tanto, no es posible afirmar que formatos, bordes, protección, anchos, combinación, nombres definidos y contenido fijo se preserven; esa prueba queda fallida, no omitida como éxito.

# 9. Funciones faltantes

## Imprescindibles antes de producción

1. Resolver las dos implementaciones y migrar de forma segura los datos A.
2. Restaurar un historial de migraciones coherente; prohibir `db push`.
3. Fuente mensual única entre perfil y control general.
4. Aislamiento multiempresa en todas las consultas/mutaciones/exportaciones.
5. Identidad/nombre inmutables en backend y código de gestoría único por empresa.
6. Estados completos y máquina de transiciones con cierre/reapertura transaccional.
7. Auditoría atómica old/new/usuario/fecha para cada edición y override.
8. Modelo real de calculado/manual/efectivo y restauración.
9. Fórmulas aprobadas por RRHH, Decimal y política de redondeo.
10. Exportación de una copia del `.xlsx` real por coincidencia de código.
11. Prevalidación completa y vista previa de errores.
12. Conservación inmutable e histórica de cada archivo exportado.
13. Experiencia de grid con pegado matricial, teclado, rangos, undo/redo y guardado robusto.
14. Tests de tenant, cierre, concurrencia, flujo bidireccional y plantilla real.

## Correcciones recomendadas

1. Pausa por defecto y filtrado tenant de festivos.
2. Validación estricta de horas y cruces de medianoche.
3. Corregir porcentaje 17%/0,17.
4. Corregir bulk de revisión.
5. Evitar setState/ref durante render y limpiar timers.
6. Integrar vistas de columna, resize, orden, ocultación y filtros.
7. Eliminar importación automática de Excel de esta versión manual.
8. Eliminar fallback que genera una plantilla vacía.
9. Resolver errores lint globales y warnings del módulo.
10. Rango de años dinámico.

## Mejoras futuras

1. Conexión con fichajes/TimeEntry mediante adaptador, no acoplamiento del modelo mensual.
2. Reglas de festivos por centro/región.
3. Fórmulas configurables y versionadas con aprobación.
4. Comparador visual de exportaciones.
5. Doble aprobación del periodo.
6. Integración segura con almacenamiento de objetos para históricos.
7. Plantillas de vistas personales de columnas.

# 10. Plan de corrección

No se implementa ninguna acción en esta fase.

## Fase 0 — Contención y decisión (P0)

1. Congelar despliegue/migraciones del módulo.
2. Backup verificado de tablas `PayrollControl*` y `_prisma_migrations`.
3. Incorporar al repositorio la migración aplicada `20260727120000_add_payroll_control_module` sin recrearla ni recalcularla.
4. Decidir formalmente el modelo final. Recomendación: conservar la integración/fuente única de A y adoptar de B únicamente el patrón de conceptos configurables, permisos tenant y vistas, mediante una migración explícita.
5. Elaborar mapping de los 40 registros/71 overrides y reconciliar totales antes/después.

## Fase 1 — Dominio y seguridad (P0)

1. Definir agregado mensual único `company+year+month+employee`.
2. Diseñar conceptos estructurales/configurables y valores calculados/manuales.
3. Añadir código de gestoría único por empresa y conciliación con plantilla.
4. Implementar actor tenant en servicios y allowlists Zod estrictas.
5. Máquina de estados completa, versión optimista y permisos segregados.
6. Auditoría/outbox transaccional.

## Fase 2 — Migración de datos (P0)

1. Crear migración forward-only desde A al modelo final.
2. Migrar periodos, registros, snapshots, overrides y estados.
3. Verificar recuentos, sumas Decimal y hashes de snapshot.
4. Mantener tablas A en solo lectura durante una ventana de validación.
5. Retirar B duplicada y rutas/pantallas redundantes.

## Fase 3 — Cálculos y aceptación RRHH (P1)

1. Taller con RRHH sobre H/I/J/P/Q/R, subtotales anómalos y 434.
2. Documento de fórmulas versionado con redondeo/vacíos/negativos/división por cero.
3. Casos dorados tomados de Excel y aprobados.
4. Motor Decimal con snapshot de versión/reglas/tarifas por periodo.

## Fase 4 — UX de hoja de cálculo (P1)

1. Elegir grid con soporte real de teclado/clipboard/rangos.
2. Implementar nombre/cabecera fija, filtros, orden, agrupación, subtotales y columnas.
3. Guardado por lote versionado, estado guardando/guardado/error, retry y protección al salir.
4. Prueba de tarea con RRHH para 20 y 80 empleados; objetivo de tiempo igual o menor al Excel.

## Fase 5 — Exportación (P1)

1. Copia byte a byte de `gestoria.xlsx`.
2. Parser OOXML, índice B9:B91 y escritura solo D:J.
3. Validación de códigos/empleados/conceptos y preview.
4. Diff estructural: hojas, merges, styles, widths, validations, protection, names y contenido fijo.
5. Persistencia del binario, templateHash, outputHash, snapshot, usuario, fecha y periodo.
6. Descarga histórica exacta, nunca regenerada.

## Fase 6 — Verificación y salida (P1)

1. Unit tests de fórmulas y validadores.
2. Integración con PostgreSQL real y dos empresas.
3. Tests de cada mutación en cerrado y cada transición.
4. Concurrencia cierre/guardado.
5. E2E perfil→general→perfil y exportación real.
6. Lint/build/Prisma/migraciones limpios en CI.
7. Piloto paralelo con Excel durante al menos un cierre mensual.

# Anexo A. Pruebas técnicas ejecutadas

| Comando | Resultado | Error/observación | Consecuencia |
| --- | --- | --- | --- |
| `git branch --show-current` | PASS | `feature/obras-cambios` | Rama auditada identificada. |
| `git status --short` | PASS con worktree sucio | Numerosos cambios/untracked previos; todo B está sin commit | No puede considerarse artefacto versionado/desplegable. |
| `npm run prisma:validate` (backend) | PASS | Esquema B sintácticamente válido | No prueba coherencia con BD. |
| `npm run prisma:generate` (backend) | PASS | Cliente generado con esquema B | Puede dejar sin tipos A que sí existe en BD. |
| `npm run prisma:status` (backend) | FAIL | 33 migraciones locales; tres pendientes B; BD contiene `20260727120000_add_payroll_control_module` ausente localmente | Divergencia crítica; no desplegar. |
| Tests backend B (4 archivos) | PASS | 53/53 | Solo unitarios/mock/sintético. |
| Tests frontend B (2 archivos) | PASS | 25/25 | Cubren cálculo básico y blur, no UX Excel. |
| Test A `PayrollControlService.test.ts` | PASS | 2/2, usando dependencias temporales retiradas | Cobertura limitada a cálculo. |
| `npm run test:e2e -- --list` | PASS listado | 720 tests generales en 14 archivos; 0 de Gestoría/Control horario | No había E2E relacionada que ejecutar. |
| `npm run lint` backend | FAIL | 1128 problemas: 2 errores, 1126 warnings. Errores en `VacationReportService.test.ts:38,62`, fuera del módulo | Gate global rojo. |
| ESLint backend, archivos del módulo B | PASS con warnings | 36 warnings; destacan `any` y cálculo no usado en horario | Calidad insuficiente, aunque sin error local. |
| `npm run build` backend | PASS | TypeScript compila | No valida tablas reales. |
| `npm run lint` frontend | FAIL | 433 problemas: 1 error, 432 warnings. Error `templateVariables.ts:3` | Gate global rojo. |
| ESLint frontend, archivos B | PASS con warnings | 18 warnings; acceso a ref/setState durante render en `EditableTable.tsx:160-162` | Riesgo de render/estado. |
| `npm run build` frontend | PASS | Vite compila; chunks >500 kB | Compilación no equivale a usabilidad. |

Comandos deliberadamente no ejecutados:

- `prisma migrate deploy/dev`, `prisma db push`: alterarían la BD y el estado de migraciones durante una auditoría.
- Exportación real A: cambia el estado del periodo a `EXPORTED`.
- Exportación real B: no existe una plantilla `.xls` compatible; forzar una conversión invalidaría la prueba de preservación.
- 720 E2E generales: no hay casos del módulo y requieren un entorno de aplicación autenticado coherente que la divergencia de esquema impide.

# Anexo B. Evidencia de persistencia

Consulta de solo lectura a la base:

- `PayrollControlPeriod`: 2 periodos de julio de 2026 en empresas distintas.
- Estados: 1 `CLOSED`, 1 `DRAFT`.
- `PayrollControlRecord`: 40.
- `PayrollControlOverride`: 71.
- Distribución de overrides: `overtimeHours` 13, `overtimeRate` 12, `holidayOvertimeHours` 12, `holidayOvertimeRate` 11, `diets` 11, `positiveVariable` 11, `totalOvertimeAmount` 1.
- `PayrollControlConceptConfig`: 0.
- Tablas `GestoriaPeriod`, `GestoriaEmployeeRow`, `GestoriaCell` y `EmployeeScheduleEntry`: no existen en la BD inspeccionada.

Esto confirma persistencia real de A, pero también que la rama activa no representa el estado de los datos.

# Anexo C. Confirmaciones pendientes de RRHH

1. ¿H/I/J deben formar parte de bruto o se pagan/exportan aparte?
2. ¿`P=H/O` es realmente productividad como ratio?
3. ¿Q debe ser `O-P` aunque reste un ratio a un importe?
4. ¿R es únicamente una comprobación que debe ser cero?
5. ¿Los rangos incompletos de subtotales son exclusiones intencionadas?
6. ¿El código de B9:B91 corresponde a algún campo existente (`subaccount465`) o requiere uno nuevo?
7. ¿434 recibe importe total de HE normal+festiva, solo normal u otro cálculo?
8. ¿Variable negativa es un descuento interno y no comisión?
9. ¿Dietas, gastos, atrasos, comisiones y anticipos son importes brutos?
10. ¿Qué política de redondeo utiliza la gestoría: por concepto, por empleado o al total?

Hasta responder estas preguntas, cualquier fórmula o mapeo que vaya más allá de lo observado debe considerarse una hipótesis, no una regla confirmada.
