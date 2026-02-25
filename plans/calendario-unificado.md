# Calendario Unificado - Nueva Página

**Fecha:** 2026-02-25  
**Tipo:** Nueva página independiente en la aplicación

---

## Descripción General

El Calendario Unificado será una página completamente nueva y separada en la aplicación, accesible desde el menú principal. Consolidará todos los eventos relacionados con RRHH en una sola vista.

---

## Ubicación en la Aplicación

### Ruta
```
/calendar  →  Página del Calendario Unificado
```

### Acceso
- **Sidebar**: Nuevo ítem "Calendario" con icono de calendario
- **Atajo**: `G then C` para ir directamente
- **Permiso**: Todos los usuarios autenticados

---

## Estructura de la Página

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER: Calendario                    [Hoy] [<] [Feb 2026] [>] │
├─────────────────────────────────────────────────────────────────┤
│ SIDEBAR (200px)  │           CALENDARIO PRINCIPAL               │
│                  │                                               │
│ □ Vacaciones     │    L   M   M   J   V   S   D                 │
│ □ Equipo         │    ───────────────────────────               │
│ □ Cumpleaños     │     1   2   3   4   5   6   7                │
│ □ Eventos        │         🎂  🏖️                              │
│ □ Feriados       │     8   9  10  11  12  13  14                │
│ □ Fichajes       │                     🎉                       │
│                  │    15  16  17  18  19  20  21                │
│ LEYENDA          │         🏖️                                  │
│ 🟢 Vacaciones    │    22  23  24  25  26  27  28                │
│ 🟢 Equipo        │                                               │
│ 🎂 Cumpleaños    │                                               │
│ 🎉 Eventos       │                                               │
│ ⚫ Feriados      │                                               │
│ 🟠 Fichajes      │                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes de la Página

### 1. Header del Calendario
- Título: "Calendario"
- Navegación: Botones anterior/siguiente y selector de mes/año
- Botón "Hoy": Volver al mes actual
- Selector de vista: Mes | Semana | Día

### 2. Sidebar de Filtros
- Checkboxes para mostrar/ocultar tipos de eventos
- Leyenda de colores
- Mini calendario para navegación rápida
- Lista de próximos eventos

### 3. Área Principal del Calendario
- Grid mensual con días
- Eventos como chips dentro de cada día
- Indicador de más eventos (+N más)
- Click en día abre modal con todos los eventos

### 4. Panel de Detalle (opcional)
- Se abre al hacer click en un evento
- Muestra información completa
- Acciones según tipo de evento

---

## Fuentes de Eventos

### 1. Vacaciones
| Origen | Datos |
|--------|-------|
| Tabla `Vacation` | `startDate`, `endDate`, `status` |
| Filtro | Solo aprobadas |
| Mostrar | Nombre del empleado |

**Vista:**
- Propias: Verde sólido
- Equipo: Verde claro con borde

### 2. Cumpleaños
| Origen | Datos |
|--------|-------|
| Tabla `Employee` | `birthDate` |
| Cálculo | Día y mes del cumpleaños |
| Mostrar | Nombre y edad que cumple |

**Vista:**
- Icono: 🎂
- Color: Rosa

### 3. Eventos Corporativos
| Origen | Datos |
|--------|-------|
| Nueva tabla `CalendarEvent` | `title`, `startDate`, `endDate` |
| Creados por | Admin/RRHH |
| Mostrar | Título y descripción |

**Vista:**
- Icono: 🎉
- Color: Azul

### 4. Feriados
| Origen | Datos |
|--------|-------|
| API externa o tabla | Días festivos locales |
| Configuración | País/región |
| Mostrar | Nombre del feriado |

**Vista:**
- Color: Gris
- Fondo del día diferente

### 5. Fichajes (opcional)
| Origen | Datos |
|--------|-------|
| Tabla `TimeEntry` | `date`, `entryTime`, `exitTime` |
| Mostrar | Horas trabajadas |

**Vista:**
- Color: Naranja
- Solo para el usuario actual

---

## Modelo de Datos

### Nueva Tabla: CalendarEvent

```prisma
model CalendarEvent {
  id          String   @id @default(uuid())
  title       String
  description String?
  location    String?
  startDate   DateTime
  endDate     DateTime
  allDay      Boolean  @default(true)
  type        String   // evento, feriado
  color       String?
  companyId   String
  createdBy   String
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  company Company @relation(fields: [companyId], references: [id])
  creator User    @relation(fields: [createdBy], references: [id])
  
  @@index([companyId, startDate])
  @@index([type])
}
```

### Modificaciones a Tablas Existentes

```prisma
model User {
  // ... existing fields
  createdEvents CalendarEvent[] @relation("EventCreator")
}

model Company {
  // ... existing fields
  calendarEvents CalendarEvent[]
}
```

---

## API Endpoints

### Nuevos Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/calendar/unified` | Todos los eventos unificados |
| GET | `/api/calendar/events` | Listar eventos corporativos |
| POST | `/api/calendar/events` | Crear evento corporativo |
| PUT | `/api/calendar/events/:id` | Actualizar evento |
| DELETE | `/api/calendar/events/:id` | Eliminar evento |
| GET | `/api/calendar/birthdays` | Cumpleaños del mes |
| GET | `/api/calendar/holidays` | Feriados del país |

### Endpoint Unificado

```typescript
// GET /api/calendar/unified?start=2026-02-01&end=2026-02-28
interface UnifiedCalendarResponse {
  vacations: {
    id: string;
    title: string;      // "Juan Pérez - Vacaciones"
    start: Date;
    end: Date;
    type: 'vacation-own' | 'vacation-team';
    color: string;
  }[];
  birthdays: {
    id: string;
    title: string;      // "🎂 María García (32)"
    date: Date;
    type: 'birthday';
    color: string;
  }[];
  events: {
    id: string;
    title: string;
    start: Date;
    end: Date;
    type: 'event';
    color: string;
    description?: string;
  }[];
  holidays: {
    id: string;
    title: string;      // "Día de la Constitución"
    date: Date;
    type: 'holiday';
    color: string;
  }[];
}
```

---

## Arquitectura Frontend

### Estructura de Archivos

```
frontend/src/
  pages/
    Calendar.tsx              # Página principal
  components/
    calendar/
      CalendarHeader.tsx      # Navegación y controles
      CalendarGrid.tsx        # Grid mensual
      CalendarDay.tsx         # Día individual
      CalendarEvent.tsx       # Evento chip
      CalendarSidebar.tsx     # Filtros y leyenda
      CalendarFilters.tsx     # Checkboxes de filtro
      CalendarLegend.tsx      # Leyenda de colores
      EventModal.tsx          # Modal de detalle
      EventForm.tsx           # Formulario crear/editar
      BirthdayList.tsx        # Lista de cumpleaños
      UpcomingEvents.tsx      # Próximos eventos
  hooks/
    useCalendarEvents.ts      # Hook para eventos
    useCalendarFilters.ts     # Estado de filtros
  types/
    calendar.ts               # Tipos TypeScript
```

### Componente Principal

```tsx
// frontend/src/pages/Calendar.tsx
export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [filters, setFilters] = useCalendarFilters();
  const { events, isLoading } = useCalendarEvents(currentDate, filters);
  
  return (
    <div className="calendar-page">
      <CalendarHeader 
        date={currentDate}
        onNavigate={setCurrentDate}
        view={view}
        onViewChange={setView}
      />
      <div className="calendar-content">
        <CalendarSidebar 
          filters={filters}
          onFilterChange={setFilters}
          events={events}
        />
        <CalendarGrid 
          date={currentDate}
          events={events}
          view={view}
        />
      </div>
    </div>
  );
}
```

---

## Funcionalidades Detalladas

### Vista Mensual
- Grid de 6 semanas (42 días)
- Días del mes anterior/posterior en gris
- Eventos como chips de colores
- Máximo 3 eventos visibles, resto en "+N más"
- Click en día abre modal con todos los eventos

### Vista Semanal
- 7 columnas, una por día
- Filas por hora (8:00 - 20:00)
- Eventos con duración visible
- Línea de hora actual
- Scroll a hora actual automático

### Vista Diaria
- Timeline completo del día
- Eventos con posición exacta
- Horas de trabajo resaltadas
- Lista de eventos del día en sidebar

### Filtros
- Por tipo de evento (checkboxes)
- Por departamento (vacaciones de equipo)
- Por empleado (búsqueda)
- Guardar preferencias en localStorage

### Crear Evento
- Click en día vacío
- Modal con formulario:
  - Título
  - Fecha inicio/fin
  - Todo el día o con hora
  - Descripción
  - Ubicación
  - Público/privado

### Ver Detalle
- Click en evento existente
- Modal con información completa
- Acciones: Editar, Eliminar (si tiene permiso)

---

## Integración con Funcionalidades Existentes

### Vacaciones
- Al aprobar vacaciones, aparecen automáticamente
- Click en vacaciones muestra detalle
- Desde calendario se puede solicitar vacaciones

### Fichajes
- Mostrar días con fichajes incompletos
- Click lleva a detalle de fichajes

### Notificaciones
- Notificar cumpleaños del día
- Notificar eventos próximos

---

## Permisos

| Rol | Ver Eventos | Crear Eventos | Editar/Eliminar |
|-----|-------------|---------------|-----------------|
| Empleado | Todos + propios | No | No |
| Manager | Todos + equipo | No | No |
| RRHH | Todos | Sí | Propios |
| Admin | Todos | Sí | Todos |

---

## Responsive Design

### Desktop (>1024px)
- Layout completo con sidebar
- Grid mensual amplio
- Todos los filtros visibles

### Tablet (768-1024px)
- Sidebar colapsable
- Grid adaptado
- Filtros en dropdown

### Mobile (<768px)
- Solo vista mensual simplificada
- Filtros en modal
- Lista de eventos del día
- Navegación por swipe

---

## Checklist de Implementación

### Backend
- [ ] Crear modelo `CalendarEvent` en Prisma
- [ ] Crear `CalendarService` para eventos unificados
- [ ] Extender `CalendarController` con nuevos endpoints
- [ ] Implementar endpoint de cumpleaños
- [ ] Implementar endpoint de feriados
- [ ] Migraciones de base de datos

### Frontend
- [ ] Crear página `Calendar.tsx`
- [ ] Crear `CalendarHeader` con navegación
- [ ] Crear `CalendarGrid` para vista mensual
- [ ] Crear `CalendarDay` para cada día
- [ ] Crear `CalendarEvent` para chips
- [ ] Crear `CalendarSidebar` con filtros
- [ ] Crear `EventModal` para detalles
- [ ] Crear `EventForm` para crear/editar
- [ ] Crear hook `useCalendarEvents`
- [ ] Añadir ruta `/calendar` en router
- [ ] Añadir ítem en Sidebar
- [ ] Implementar atajo `G then C`

### Integración
- [ ] Conectar con vacaciones existentes
- [ ] Conectar con fichajes existentes
- [ ] Añadir notificaciones de cumpleaños
- [ ] Tests de integración

---

## Archivos a Crear

| Archivo | Descripción |
|---------|-------------|
| `frontend/src/pages/Calendar.tsx` | Página principal |
| `frontend/src/components/calendar/CalendarHeader.tsx` | Header con navegación |
| `frontend/src/components/calendar/CalendarGrid.tsx` | Grid mensual |
| `frontend/src/components/calendar/CalendarDay.tsx` | Día individual |
| `frontend/src/components/calendar/CalendarEvent.tsx` | Chip de evento |
| `frontend/src/components/calendar/CalendarSidebar.tsx` | Sidebar con filtros |
| `frontend/src/components/calendar/EventModal.tsx` | Modal de detalle |
| `frontend/src/components/calendar/EventForm.tsx` | Formulario de evento |
| `frontend/src/hooks/useCalendarEvents.ts` | Hook para eventos |
| `frontend/src/types/calendar.ts` | Tipos TypeScript |
| `backend/src/services/CalendarService.ts` | Extender existente |

---

*Plan para el Calendario Unificado como página independiente.*