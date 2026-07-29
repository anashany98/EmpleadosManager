# Módulo "Preparación para gestoría"

> Sustituye el flujo manual de tres Excel (plantilla individual, control
> general, plantilla .xls de gestoría) por un módulo integrado de la
> aplicación.

## TL;DR

1. **Captura manual** de horas, precios, importes, dietas y demás
   conceptos por empleado y mes.
2. **Edición tipo hoja de cálculo** en el "control general" (mostrar /
   ocultar / reordenar columnas, selección múltiple, totales, búsqueda).
3. **Exportación a `.xls`** preservando la plantilla original de la
   gestoría (BIFF8) — el archivo se copia, se rellena y se descarga;
   la plantilla nunca se modifica.
4. **Bloqueo de periodos** (close / reopen con motivo obligatorio) y
   **auditoría** de cada cambio.
5. **Permisos** por rol (admin / hr / manager) y aislamiento por
   empresa (multi-tenant).

## Reemplaza qué

| Antes (manual)                                                       | Ahora (módulo)                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `2026 PLANTILLA MARCAJE EMPLEADO_24h.xlsx` (1 hoja × empleado × mes) | Vista "Detalle empleado" (`/gestoria/employee/:periodId/:employeeId`) |
| `2026 CONTROL.xlsx` (1 hoja con todos los empleados del mes)         | Vista "Control general" (`/gestoria/control/:periodId`)               |
| `E01207_210720_092848_00.XLS` (plantilla .xls de la gestoría)        | Exportación a gestoría (`/gestoria/export/:periodId`)                 |

## Variables de entorno

| Variable                     | Descripción                                                     | Por defecto                                      |
| ---------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| `GESTORIA_TEMPLATE_PATH`     | Ruta a la plantilla .xls (relativa al directorio del backend).  | `backend/assets/templates/gestoria_template.xls` |
| `GESTORIA_TEMPLATE_PASSWORD` | Contraseña de la plantilla si está cifrada. Si no, dejar vacía. | (vacía)                                          |
| `GESTORIA_PYTHON`            | Intérprete Python que ejecuta el script de export.              | `python`                                         |

### Configurar la contraseña en Coolify

1. Abre el servicio del backend en Coolify.
2. Ve a **Environment Variables** y añade:
   - `GESTORIA_TEMPLATE_PASSWORD` = (la contraseña que te dio la gestoría)
3. **Redeploy** el servicio.
4. El endpoint de exportación devolverá 503 con mensaje claro si la
   contraseña no está configurada cuando se intenta exportar.

## Estructura

```
backend/
├── scripts/
│   └── gestoria_export.py        # Helper Python (xlrd/xlwt/xlutils) para
│                                  # preservar la plantilla .xls original
├── src/
│   ├── controllers/
│   │   └── GestoriaController.ts
│   ├── routes/
│   │   └── gestoriaRoutes.ts
│   ├── schemas/
│   │   └── gestoriaSchemas.ts
│   ├── services/
│   │   ├── GestoriaPeriodService.ts
│   │   ├── GestoriaConceptService.ts
│   │   ├── GestoriaRowService.ts
│   │   ├── GestoriaBulkService.ts
│   │   ├── GestoriaViewService.ts
│   │   └── GestoriaExportService.ts
│   └── tests/unit/gestoria/
│       ├── GestoriaSchemas.test.ts
│       └── GestoriaExportPipeline.test.ts
├── tests/fixtures/
│   └── gestoria_template_synthetic.xls   # Plantilla sintética sin cifrar
│                                          # para tests E2E del export
└── assets/templates/
    └── gestoria_template.xls              # ← Aquí va la plantilla real
                                            #   (NO commitear si está cifrada;
                                            #    añadir al .gitignore o subir
                                            #    por canal seguro)

frontend/
└── src/
    ├── api/
    │   └── gestoria.ts
    ├── hooks/
    │   └── useGestoria.ts
    └── pages/
        ├── GestoriaPeriodsPage.tsx
        ├── GestoriaControlPage.tsx
        ├── GestoriaEmployeeDetailPage.tsx
        ├── GestoriaConceptsPage.tsx
        └── GestoriaExportPage.tsx

shared/authz/index.ts
  + module 'gestoria'
  + policies: gestoria.read | gestoria.write | gestoria.close | gestoria.export
  + features: gestoria, gestoriaExport
  + defaults: admin/hr/manager tienen gestoria: 'read' (write en admin)
```

## Modelo de datos

EAV (Entity-Attribute-Value) sobre `GestoriaCell` para soportar
columnas dinámicas sin migraciones:

- `GestoriaPeriod` — (empresa, año, mes) UNIQUE. Status OPEN|CLOSED.
- `GestoriaConcept` — `code`, `label`, `type` (HOURS|PRICE|AMOUNT|
  PERCENT|BOOLEAN|TEXT), `isSystem`, `isVisible`, `order`.
- `GestoriaEmployeeRow` — (periodo, empleado) UNIQUE. Snapshot
  inmutable de `employeeName`, `department`, `category`.
- `GestoriaCell` — (rowId, conceptId) UNIQUE. `numericValue` o
  `textValue` según el tipo del concepto. `sourceType` y
  `sourceRefId` quedan libres para la futura integración con
  `TimeEntry`.
- `GestoriaColumnView` — vista personalizada por usuario/periodo.
- `GestoriaExportLog` — auditoría de cada `.xls` generado
  (filename, sha256, tamaño, contador de descargas).

## Pipeline de exportación

```
Frontend (GestoriaExportPage)
   │
   │ 1. POST /api/gestoria/periods/:id/export/preview
   │    → { rowCount, totalAmount, missingMappings, sample }
   │
   │ 2. POST /api/gestoria/periods/:id/export
   │    → { logId, outputFilename, fileSize, fileHash, missingMappings }
   │
   │ 3. GET /api/gestoria/periods/:id/export/download?logId=…
   │    → application/vnd.ms-excel; attachment; filename=…
   ▼
Backend (GestoriaExportService)
   │
   │ Carga periodo + filas + celdas + conceptos
   │ Construye JSON con el exportMapping (códigos de concepto → celdas)
   │ Ejecuta como child_process:
   ▼
Python (gestoria_export.py)
   │
   │ 1. Si la plantilla está cifrada y GESTORIA_TEMPLATE_PASSWORD
   │    está definida → descifra con msoffcrypto-tool → tmp
   │ 2. xlrd.open_workbook(template, formatting_info=True)
   │ 3. xlutils.copy(book) → preserva TODOS los formatos
   │ 4. Escribe cada celda con xlwt
   │ 5. Guarda como .xls (BIFF8)
   │ 6. Calcula SHA-256 y tamaño
   ▼
Backend registra GestoriaExportLog y transmite el .xls al cliente
Frontend descarga + muestra en historial
```

## Decisiones técnicas

- **Por qué Python**: `exceljs` solo maneja `.xlsx`. La plantilla es
  `.xls` (BIFF8). `xlrd`+`xlwt`+`xlutils` son las herramientas nativas
  para `.xls` y `xlutils.copy` preserva 100% del formato.
- **Por qué EAV en `GestoriaCell`**: el usuario pidió "Los conceptos
  no deben quedar programados de forma rígida". Una tabla EAV permite
  añadir / renombrar / eliminar conceptos sin migraciones.
- **Snapshot inmutable**: `employeeName`, `department`, `category` se
  copian del `Employee` al crear la fila. Aunque el empleado cambie de
  departamento después, el periodo cerrado muestra el departamento
  que tenía al cierre.
- **Bloqueo del periodo**: `CLOSED` rechaza escrituras con HTTP 423
  (Locked). La reapertura exige `reason` ≥ 5 chars; la auditoría
  registra antes / después / motivo.
- **Permisos**: cuatro policies (`gestoria.read | write | close |
export`) con scope `company` para roles `admin / hr / manager`.
- **Auditoría**: cada escritura pasa por `AuditService.log(…)` con
  `entity: GESTORIA`. Reaperturas y exports se marcan con acciones
  específicas (`GESTORIA_PERIOD_CLOSE`, `GESTORIA_PERIOD_REOPEN`,
  `GESTORIA_EXPORT`, `GESTORIA_DOWNLOAD`).
- **Histórico de exports**: cada `.xls` se persiste con SHA-256,
  tamaño, nº de filas y contador de descargas. El archivo se borra
  del disco tras la transmisión (no se almacena).

## Limitaciones conocidas

- **Sin integración con fichajes**: la columna `sourceType` /
  `sourceRefId` en `GestoriaCell` queda libre para la integración
  futura con `TimeEntry`. La estructura de datos no cambia.
- **Contraseña de la plantilla real**: el test E2E verifica el
  pipeline con una plantilla sintética sin cifrar (generada por
  `output/make_synthetic_template.py`). La verificación con la
  plantilla real de la gestoría (cifrada) solo se puede hacer
  manualmente tras configurar `GESTORIA_TEMPLATE_PASSWORD`.
- **Mapeo de celdas**: se introduce desde la UI
  (`GestoriaPeriod.exportMapping`) porque la app no puede asumir
  posiciones fijas en una plantilla que no ha podido inspeccionar
  (está cifrada). La primera vez, el operador introduce el mapeo;
  luego se reutiliza para todos los meses.

## Cómo se usa

1. El operador va a **Gestoría → Nuevo periodo** y crea el mes.
2. Va a **Control general** y añade empleados al periodo.
3. Rellena las celdas (H.EXT, H.SD.EXT, precios, importes, …).
4. (Opcional) Define conceptos adicionales en **Conceptos** del
   periodo.
5. Cierra el periodo cuando todo esté revisado (los revisados se
   marcan con ✓).
6. Va a **Exportar**, asigna el mapeo de conceptos a celdas de la
   plantilla .xls (solo la primera vez), previsualiza y descarga
   el archivo para enviarlo a la gestoría.

## Tests

- `backend/src/tests/unit/gestoria/GestoriaSchemas.test.ts` —
  schemas Zod (sin DB).
- `backend/src/tests/unit/gestoria/GestoriaExportPipeline.test.ts`
  — pipeline E2E con plantilla sintética (generada por
  `output/make_synthetic_template.py`).

Para regenerar la plantilla sintética:

```bash
python output/make_synthetic_template.py
```

Para correr el test E2E manualmente:

```bash
python output/test_export_e2e.py
```
