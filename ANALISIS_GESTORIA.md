# Análisis funcional y técnico — Módulo "Preparación para gestoría"

> Documento de diseño previo a la implementación. Resume cómo funcionan los
> tres Excel adjuntos, qué partes del proyecto se reutilizan, qué modelos
> nuevos se introducen y cómo se implementa la exportación preservando la
> plantilla `.xls` original.

## 1. Cómo funcionan los tres Excel

### 1.1. `2026 PLANTILLA MARCAJE EMPLEADO_24h.xlsx`

Plantilla **individual** por empleado, una hoja por mes (DICIEMBRE 2025,
ENERO, FEBRERO, …, DICIEMBRE) más una hoja `FESTIVOS`. Cada hoja mensual
tiene la misma estructura fija:

- Cabecera con `TRABAJADOR`, `MES`, precio de H. EXT y H.S/D EXT.
- Filas 6..N (28/30/31 según mes) con una fila por día: `DÍA`, `FECHAS`,
  `ENTRADA`, `SALIDA`, `ENTRADA`, `SALIDA`, `H.TRAB`, `DESCONTAR`,
  `H.LAB`, `H. EXT`, `H EXT Festivos`, `OBSERVACIONES`.
- Cálculos automáticos por fórmula `IF` con `WEEKDAY` que distinguen
  laborable / sábado / domingo / festivo.
- Fila de totales con `=SUMPRODUCT((J6:J36>0)...)` para horas extra y
  `=SUM(K6:K36)` para festivas, y el `total` final (`=N3*N1 + O3*O1`).

**Conclusión:** la _plantilla individual_ no es un documento de envío,
es un formulario de captura diaria. El usuario la rellena a mano día a
día y la usa solo como fuente de horas.

### 1.2. `2026 CONTROL.xlsx`

Hoja única (`JUNIO`) que reúne a **todos los empleados del mes** en una
vista de control. Estructura (resumida por columnas):

| Col | Significado                                           | Tipo       |
| --- | ----------------------------------------------------- | ---------- |
| A   | `CATEGORÍA` (encabezado de grupo: "3. COSTUREROS", …) | Texto      |
| B   | `H. EXT.` (cantidad horas extra normales)             | Número     |
| C   | `H.S/D EXT` (cantidad horas extra festivas)           | Número     |
| D   | `TRABAJADOR` (apellidos, nombre)                      | Texto      |
| E   | `H. EXT.` (precio €/h normal)                         | Decimal    |
| F   | `H.S/D EXT` (precio €/h festiva)                      | Decimal    |
| G   | `total = B·E + C·F (+I para oficiales de 1ª)`         | Fórmula    |
| H   | (no usado, copia de G)                                | Fórmula    |
| I   | Plus de productividad / ajuste manual                 | Decimal    |
| J   | (vacía)                                               | -          |
| K   | `Irpf` (%)                                            | Porcentaje |
| L   | `tgss` (%)                                            | Porcentaje |
| M   | `1 - K - L` (factor líquido)                          | Fórmula    |
| N   | `BRUTO = G / M`                                       | Fórmula    |
| O   | `productividad`                                       | Fórmula    |
| P   | `horas`                                               | Fórmula    |
| Q   | `DIFERENCIA`                                          | Fórmula    |
| R   | `N - G` (margen fiscal)                               | Fórmula    |

Agrupados por departamentos: "3. COSTUREROS", "4. PRODUCCIÓN",
"5. CORTE", "6. TAPICEROS", "7. CARPINTEROS", "8. ALMACÉN",
"9. INSTALADORES". Cada grupo tiene fila de subtotal con `=SUM(G..)`.

**Conclusión:** es la hoja de **liquidación mensual** que se cruza con
las plantillas individuales para validar importes antes de enviarla a la
gestoría.

### 1.3. `E01207_210720_092848_00.XLS` (gestoría)

Plantilla **binaria `.xls` (BIFF8), cifrada con contraseña** que la
gestoría entrega al cliente. La app tiene que:

- tratarla como `.xls` (no `.xlsx`),
- nunca modificarla,
- copiarla, rellenar las celdas, mantener el formato y entregarla.

**Limitación:** el archivo está cifrado. Sin la contraseña (que el
usuario ha decidido gestionar vía `GESTORIA_TEMPLATE_PASSWORD` en `.env`)
no puedo inspeccionar la estructura exacta en este momento. El
exportador se diseñará para:

- leer la plantilla con `xlrd`,
- copiarla con `xlutils.copy` (preserva todos los formatos),
- rellenar celdas con `xlwt`,
- guardar `.xls` válido.

> **Importante:** los campos que la plantilla requiera se configurarán
> desde la propia aplicación con un mapeo "código de concepto → celda"
> (p. ej. `{ "H.EXT": "B5", "H.SD.EXT": "C5", "EMPLOYEE_NAME": "D5" }`)
> que se persiste en `GestoriaPeriod.exportMapping`. El operador
> introduce el mapeo la primera vez y luego se reutiliza. La app nunca
> asume una posición fija en la plantilla.

## 2. Relación entre los tres Excel

```
2026 PLANTILLA MARCAJE EMPLEADO_24h.xlsx   ← horas/día por empleado
            │
            ▼  (se vuelca manualmente)
2026 CONTROL.xlsx                          ← horas + precios + importes
            │
            ▼  (se traspasa al Excel de gestoría)
E01207_210720_092848_00.XLS                ← plantilla cifrada entregada
```

## 3. Partes del proyecto reutilizables

- **Esquema Prisma (`database/prisma/schema.prisma`)** — modelo
  `Employee` con `companyId`, `department`, `category`, `active`,
  `deletedAt` ya soporta el aislamiento por empresa, soft-delete GDPR y
  el snapshot de departamento/categoría necesario para los periodos
  cerrados.
- **Authz (`shared/authz` + `backend/src/authz`)** — políticas
  `employee.read.detail`, `employee.write.company`, `payroll.manage`,
  `timesheet.manage` se reusan; se añade un nuevo módulo `gestoria`.
- **AuditService (`backend/src/services/AuditService.ts`)** — todas las
  acciones críticas se registran con `AuditService.log(…)`.
- **Validación Zod (`backend/src/schemas/`)** — patrón
  `validateResource(schema)` consistente.
- **Multer + Storage (`backend/src/config/multer.ts`)** — para subidas
  (no es crítico en v1, pero se mantiene la opción de importar la
  plantilla individual).
- **Frontend**: `Modal`, `Breadcrumbs`, `EmptyState`, `LoadingSpinner`,
  `ConfirmDialog`, `BulkActionToolbar`, `SearchInput`, cliente API con
  reintentos y `useUnsavedChanges`.
- **Sidebar / navegación** (`frontend/src/components/sidebarNavigation.tsx`)
  — se añade una nueva entrada "Gestoría" bajo "Tiempo" o "Recursos".
- **Patrón de pruebas** (Vitest + supertest en backend, vitest + RTL en
  frontend).

## 4. Cambios propuestos

### 4.1. Nuevos modelos Prisma

```
GestoriaPeriod           — (companyId, year, month) UNIQUE, status, lock…
GestoriaConcept          — code, label, type (enum), decimals, order…
GestoriaEmployeeRow      — (periodId, employeeId) UNIQUE, snapshot de
                           department/category, isReviewed…
GestoriaCell             — (rowId, conceptId) UNIQUE, numericValue /
                           textValue. Tabla EAV para celdas arbitrarias.
GestoriaColumnView       — vista personalizada por usuario/periodo
GestoriaExportLog        — auditoría de exportaciones a gestoría
```

> **Por qué EAV (`GestoriaCell`) en vez de columnas rígidas:** el
> usuario pide "Los conceptos no deben quedar programados de forma
> rígida. Deben poder crearse conceptos nuevos desde la aplicación sin
> modificar el código." Una tabla EAV por (fila, concepto) admite
> cualquier número de columnas dinámicas, tipos mezclados y
> añadir/eliminar/renombrar conceptos sin migraciones.

### 4.2. Nuevas rutas backend (`/api/gestoria`)

| Método | Ruta                               | Acción                                    |
| ------ | ---------------------------------- | ----------------------------------------- |
| GET    | `/companies/:companyId/periods`    | Listar periodos                           |
| POST   | `/companies/:companyId/periods`    | Crear periodo                             |
| GET    | `/periods/:id`                     | Detalle periodo                           |
| PATCH  | `/periods/:id`                     | Editar (mapeo, notas)                     |
| POST   | `/periods/:id/close`               | Cerrar periodo (lock)                     |
| POST   | `/periods/:id/reopen`              | Reabrir (requiere motivo)                 |
| GET    | `/periods/:id/concepts`            | Listar conceptos                          |
| POST   | `/periods/:id/concepts`            | Crear concepto                            |
| PATCH  | `/periods/:id/concepts/:conceptId` | Editar (label, visible, order)            |
| DELETE | `/periods/:id/concepts/:conceptId` | Eliminar concepto                         |
| GET    | `/periods/:id/rows`                | Listar filas (con cells)                  |
| POST   | `/periods/:id/rows`                | Crear fila para empleado                  |
| PATCH  | `/periods/:id/rows/:rowId`         | Editar observaciones / isReviewed         |
| PUT    | `/periods/:id/rows/:rowId/cells`   | Upsert de todas las celdas                |
| POST   | `/periods/:id/rows/bulk`           | Operaciones masivas (delete, set cell, …) |
| GET    | `/periods/:id/views`               | Listar vistas guardadas                   |
| POST   | `/periods/:id/views`               | Crear / actualizar vista                  |
| GET    | `/periods/:id/export/preview`      | JSON con lo que se escribirá              |
| POST   | `/periods/:id/export`              | Generar `.xls` → `Content-Disposition`    |
| GET    | `/periods/:id/exports`             | Historial de exportaciones                |

### 4.3. Nuevas pantallas frontend

| Ruta                                       | Página                   | Propósito                          |
| ------------------------------------------ | ------------------------ | ---------------------------------- |
| `/gestoria`                                | `GestoriaPeriodsPage`    | Selector de empresa/año/mes        |
| `/gestoria/control/:periodId`              | `GestoriaControlPage`    | Grid editable tipo hoja de cálculo |
| `/gestoria/employee/:periodId/:employeeId` | `GestoriaEmployeeDetail` | Form mensual individual            |
| `/gestoria/export/:periodId`               | `GestoriaExportPage`     | Preview + descarga del `.xls`      |
| `/gestoria/concepts/:periodId`             | `GestoriaConceptsPage`   | Gestión de conceptos               |

### 4.4. Permisos

Nuevo módulo `gestoria` en `PERMISSION_MODULES` con `read` / `write`
para roles `admin`, `hr`, `manager`. Cuatro policies nuevas:

- `gestoria.read` — lectura de periodos y filas.
- `gestoria.write` — edición de celdas, conceptos, filas.
- `gestoria.close` — cerrar/reabrir periodos (solo admin/hr).
- `gestoria.export` — generar y descargar la plantilla de gestoría.

### 4.5. Auditoría

Toda escritura pasa por `AuditService.log(…)` con
`AuditEntity.GESTORIA` y metadatos `{ periodId, employeeId, action,
before?, after? }`. Reaperturas se marcan con
`action: REOPEN_PERIOD` y el `reason` obligatorio.

## 5. Implementación de la exportación

### 5.1. Por qué NO `exceljs` (XLSX)

`exceljs` solo maneja OOXML (`.xlsx`). La plantilla es BIFF8 (`.xls`)
cifrada. Convertirla a `.xlsx` rompe "no trates el `.xls` como si fuera
`.xlsx`".

### 5.2. Pipeline

```
Node (GestoriaExportService)
   │
   │ 1. Lee plantilla encriptada de
   │    backend/assets/templates/gestoria_template.xls
   │ 2. Si GESTORIA_TEMPLATE_PASSWORD está definida,
   │    la descifra con msoffcrypto-tool → tmp_plantilla.xls
   │ 3. Construye JSON con filas + mapeo concept→celda
   │ 4. Llama a:
   ▼
Python (backend/scripts/gestoria_export.py)
   │ • Carga la plantilla con xlrd
   │ • Usa xlutils.copy para preservarla
   │ • Escribe los valores en las celdas
   │ • Guarda → output_gestoria.xls
   │
   ▼
Node recibe el .xls generado, lo transmite como
   application/vnd.ms-excel; lo registra en GestoriaExportLog
```

### 5.3. Tests sin la contraseña real

Para poder verificar el pipeline en CI/dev sin la contraseña de la
gestoría, el test crea una **plantilla sintética** con `xlwt`
(`backend/tests/fixtures/gestoria_template_synthetic.xls`) con celdas
marcadas con un nombre lógico (`EMPLOYEE`, `H.EXT`, `H.SD.EXT`,
`IRPF`, `BRUTO`, `TOTAL`). El test ejercita el script Python con esa
plantilla y comprueba que los valores se escriben en las celdas
correctas sin destruir el formato.

### 5.4. Fallback si no hay contraseña

Si `GESTORIA_TEMPLATE_PASSWORD` no está definida y el archivo está
cifrado, el endpoint devuelve `503 Service Unavailable` con mensaje
"`GESTORIA_TEMPLATE_PASSWORD` no configurada. Configúrala en `.env`."
El resto del módulo sigue siendo funcional (captura de horas,
control, conceptos) — solo se bloquea la exportación final.

## 6. Decisiones técnicas relevantes

1. **Decimales:** `Decimal(8, 2)` para horas y precios,
   `Decimal(15, 2)` para importes, `@db.Decimal` para precisión
   contable.
2. **Tipos de concepto:** enum `HOURS | PRICE | AMOUNT | TEXT |
PERCENT | BOOLEAN`. Decimales por defecto: 2.
3. **Bloqueo del periodo:** `status = OPEN | CLOSED`. `CLOSED` rechaza
   cualquier escritura salvo `reopen` (que requiere `reason`).
4. **Snapshots:** en `GestoriaEmployeeRow` se guarda `employeeName`,
   `department` y `category` como `String` en el momento de crear la
   fila. Aunque el empleado cambie de departamento, el periodo cerrado
   muestra el departamento que tenía al cierre.
5. **Vistas guardadas:** una vista por usuario/periodo, con
   `columnOrder` y `hiddenConcepts` como JSON. Default = conceptos en
   orden de creación.
6. **Operaciones masivas:** endpoint `POST /rows/bulk` con operaciones
   `setCell | clearCell | deleteRows | setReviewed`. Valida que el
   periodo esté abierto.
7. **Reapertura:** exige `reason` ≥ 5 chars; audita con
   `metadata.beforeStatus` y `metadata.afterStatus`.
8. **PII / GDPR:** no se cifra ningún campo nuevo (periodos,
   conceptos, celdas con importes/horas). Los nombres de empleado
   viven ya en `Employee` (que sí está cifrado vía `*Enc`); aquí
   guardamos snapshot plano porque la fila **es** el documento de
   envío a gestoría y debe ser legible para la gestoría.

## 7. Limitaciones conocidas

- **El test end-to-end con la plantilla real cifrada solo se puede
  verificar con la contraseña.** Hasta que el operador la añada a
  `.env`, la generación devolverá 503. Toda la demás funcionalidad
  (periodos, conceptos, filas, celdas, vistas) está cubierta por
  tests unitarios.
- **No se conecta con el sistema de fichajes** (requisito explícito
  del usuario). La estructura deja un `sourceType` y `sourceRefId`
  opcionales en `GestoriaCell` para que el integrador futuro pueda
  vincular celdas a `TimeEntry` sin migración.
- **El .xls cifrado de la gestoría no se ha podido inspeccionar.** El
  mapeo "concepto → celda" se introduce desde la UI
  (`GestoriaPeriod.exportMapping`) y se valida al previsualizar /
  exportar. Si una celda del mapeo no existe en la plantilla, el
  preview lo marca en rojo.
