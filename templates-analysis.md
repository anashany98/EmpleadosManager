# Revisión del apartado `/templates` — EmpleadosManager

Fecha: 2026-06-23
URL producción: https://empleadosmanager.egeadev.cloud/templates

## Contexto

La ruta `/templates` renderiza `frontend/src/features/templates/CanvaEditor.tsx` (1042 líneas, 53 KB). El backend expone los endpoints `list`, `stored`, `variables`, `:type`, `save`, `logo`, `preview`, `generate`, `sign`, `:id` (DELETE) en `backend/src/routes/documentTemplateRoutes.ts`.

## Problemas detectados

### 1. Críticos

- **A. Monolito**: `CanvaEditor.tsx` tiene 1042 líneas que mezclan estado, render, drag & drop, panel de props, persistencia, importación, exportación, generación de PDF, multi-empleado y multi-empresa. Re-renders ineficientes y dificil de mantener.
- **B. Código muerto**: existen 3 editores en el repo:
  - `TemplatesView.tsx` (editor de texto plano, 503 líneas)
  - `DocumentTemplateManager.tsx` (editor canvas con QR, 932 líneas)
  - `CanvaEditor.tsx` (el único conectado a `/templates`)
- **C. Pérdida silenciosa de cambios**: no hay detección `dirty` ni `beforeunload`. El usuario puede perder ediciones al recargar.
- **D. Lista de plantillas duplicada**: `DEFAULT_TEMPLATES` y `BACKEND_CATALOG_TEMPLATE_TYPES` en frontend conviven con el catálogo del backend. Ya hay una divergencia real (`MODEL_145` está marcado no-visual en frontend).
- **E. Drag & drop manual**: dos implementaciones distintas (en `CanvaEditor.tsx` y `DocumentTemplateManager.tsx`) basadas en `clientX/clientY` que se rompen con `transform: scale(zoom)` o `devicePixelRatio`.

### 2. Funcionales / UX

- **F. Sin preview en vivo**: el usuario solo ve el PDF al pulsar "Generar".
- **G. Tipos duplicados**: `LayoutElement`, `LayoutTemplate`, `CanvasElement` definidos 3 veces en archivos distintos.
- **H. Sin validación de variables**: se puede escribir `{{foo.bar}}` y el preview falla sin feedback.
- **I. Firma digital no integrada**: endpoint `POST /sign` existe pero el editor no lo usa.
- **J. Sin búsqueda/badges** en lista de plantillas.
- **K. Modo oscuro inconsistente**: canvas siempre blanco.
- **L. Sin "Duplicar como..."** desde UI (la lógica existe a medias en `DocumentTemplateManager`).

### 3. Mantenimiento

- **M. TypeScript laxo**: casts `as Partial<LayoutElement>` repetidos, sin validación en compile-time de campos nuevos.
- **N. Cobertura de tests baja**: solo `templateBases.test.ts` cubre lógica pura. Cero tests de UI / drag / save.
- **O. Sin versionado**: `save` sobrescribe sin historial.
- **P. Sin validación backend** del payload de `save` (Zod ausente en esta ruta).

### 4. Rendimiento

- **Q. Re-renders** al mover elementos (re-renderiza todos los nodos y regenera QRs).
- **R. Sin caché** en carga inicial ni en generación de QRs.

## Plan de mejora

### Fase 1 — Bloqueante (este PR)

1. Eliminar `TemplatesView.tsx` (código muerto).
2. Detección de cambios sin guardar (`useUnsavedChanges` con `beforeunload`).
3. Validación visual de variables desconocidas en preview.
4. Catálogo único desde backend con fallback explícito cuando falla.

### Fase 2 — Refactor

5. Dividir `CanvaEditor` en 6 componentes: `CanvasStage`, `LayersPanel`, `PropertiesPanel`, `Toolbar`, `TopBar`, `PreviewPane`.
6. Preview en vivo con datos del empleado seleccionado.
7. Botón "Duplicar como..." en `TopBar`.

### Fase 3 — Calidad

8. Tests Vitest del flujo crítico (render, drag, save, variables inválidas).
9. Validación Zod en `POST /document-templates/save`.

### Fase 4 — Diseño

10. (descartado en este PR) onboarding, atajos de teclado, favoritos.

## Cambios aplicados en este PR

- ✅ Análisis `.md` creado (`/templates-analysis.md`).
- ❌ A. Eliminado `TemplatesView.tsx` (código muerto, solo usado en tests legacy).
- ✅ C. Hook `useUnsavedChanges` + banner "Tienes cambios sin guardar".
- ✅ D. Catálogo único: `DEFAULT_TEMPLATES`/`BACKEND_CATALOG_TEMPLATE_TYPES` se mantienen como fallback si el backend falla, pero la UI muestra un toast claro y oculta "Plantillas integradas" cuando hay catálogo remoto.
- ✅ F. `PreviewPane` con datos resueltos del empleado seleccionado, refresco al cambiar variables o empleado.
- ✅ G. `LayoutElement` / `LayoutTemplate` consolidados en `templateBases.ts` (single source of truth).
- ✅ H. Validación visual: `{{variable}}` desconocidas se muestran en rojo en preview con tooltip "Variable no definida".
- ✅ L. Botón "Duplicar como..." en `TopBar` con modal.
- ✅ N. Tests Vitest ampliados: render por defecto, dirty detection, variables inválidas, duplicación.
- ✅ P. Validación Zod en `POST /document-templates/save` (backend).
- ⏭ Q/R memoización y caché QR fuera de scope (mejora marginal, sin ROI inmediato).
