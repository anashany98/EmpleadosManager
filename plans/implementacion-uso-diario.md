# Plan de Implementación: Atajos, Chat y Calendario

**Fecha:** 2026-02-25  
**Funcionalidades:** Atajos de Teclado, Chat Interno, Calendario Unificado

---

## 1. Atajos de Teclado

### Especificación Técnica

#### Atajos Globales
| Atajo | Acción | Contexto |
|-------|--------|----------|
| `Ctrl+K` | Abrir búsqueda global | Cualquier página |
| `Ctrl+/` | Mostrar ayuda de atajos | Cualquier página |
| `Esc` | Cerrar modal/menú abierto | Cualquier página |
| `?` | Mostrar todos los atajos | Fuera de input |

#### Atajos de Navegación
| Atajo | Acción | Contexto |
|-------|--------|----------|
| `G then D` | Ir al Dashboard | Cualquier página |
| `G then E` | Ir a Empleados | Cualquier página |
| `G then C` | Ir a Calendario | Cualquier página |
| `G then V` | Ir a Vacaciones | Cualquier página |
| `G then P` | Ir a Perfil | Cualquier página |

#### Atajos de Acción
| Atajo | Acción | Contexto |
|-------|--------|----------|
| `Ctrl+F` | Fichar / Registrar entrada | Cualquier página |
| `Ctrl+N` | Nuevo empleado | Página empleados |
| `Ctrl+S` | Guardar formulario | En formulario |
| `Ctrl+V` | Solicitar vacaciones | Cualquier página |
| `Delete` | Eliminar selección | En lista |

### Arquitectura Frontend

```
frontend/src/
  hooks/
    useKeyboardShortcuts.ts    # Hook principal
    shortcuts/
      globalShortcuts.ts       # Atajos globales
      navigationShortcuts.ts   # Navegación
      actionShortcuts.ts       # Acciones
  components/
    ShortcutHelp.tsx           # Modal de ayuda
    ShortcutBadge.tsx          # Badge en botones
```

### Implementación del Hook

```typescript
// frontend/src/hooks/useKeyboardShortcuts.ts
interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'action' | 'global';
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const match = shortcuts.find(s => 
        s.key.toLowerCase() === e.key.toLowerCase() &&
        !!s.ctrl === e.ctrlKey &&
        !!s.shift === e.shiftKey &&
        !!s.alt === e.altKey
      );
      if (match) {
        e.preventDefault();
        match.action();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcuts]);
}
```

### UI de Ayuda

- Modal con `Ctrl+/` o `?`
- Categorías: Navegación, Acciones, Global
- Badges en botones mostrando atajo
- Indicador visual cuando atajo está disponible

---

## 2. Chat Interno Básico

### Especificación Técnica

#### Funcionalidades MVP
- Chat 1 a 1 entre usuarios
- Mensajes en tiempo real
- Historial de conversaciones
- Indicador de escritura
- Notificaciones de mensaje nuevo

#### Modelo de Datos

```prisma
// database/prisma/schema.prisma

model ChatConversation {
  id          String   @id @default(uuid())
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  participants User[]  @relation("ConversationParticipants")
  messages     ChatMessage[]
  
  @@index([updatedAt])
}

model ChatMessage {
  id             String   @id @default(uuid())
  conversationId String
  senderId       String
  content        String
  createdAt      DateTime @default(now())
  readAt         DateTime?
  
  conversation ChatConversation @relation(fields: [conversationId], references: [id])
  sender       User             @relation("MessageSender")
  
  @@index([conversationId, createdAt])
  @@index([senderId])
}

model User {
  // ... existing fields
  
  conversations  ChatConversation[] @relation("ConversationParticipants")
  sentMessages   ChatMessage[]      @relation("MessageSender")
}
```

#### Arquitectura Backend

```
backend/src/
  controllers/
    ChatController.ts
  routes/
    chatRoutes.ts
  services/
    ChatService.ts
```

#### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/chat/conversations` | Listar conversaciones |
| POST | `/api/chat/conversations` | Crear conversación |
| GET | `/api/chat/conversations/:id/messages` | Obtener mensajes |
| POST | `/api/chat/conversations/:id/messages` | Enviar mensaje |
| PUT | `/api/chat/messages/:id/read` | Marcar como leído |
| GET | `/api/chat/stream` | SSE para tiempo real |

#### Arquitectura Frontend

```
frontend/src/
  components/
    chat/
      ChatWidget.tsx        # Widget flotante
      ChatWindow.tsx        # Ventana de chat
      ChatList.tsx          # Lista conversaciones
      ChatMessage.tsx       # Mensaje individual
      ChatInput.tsx         # Input con emoji picker
  hooks/
    useChat.ts              # Hook para chat
    useChatStream.ts        # SSE connection
  contexts/
    ChatContext.tsx         # Estado global del chat
```

#### Widget de Chat

- Botón flotante en esquina inferior derecha
- Badge con contador de mensajes no leídos
- Ventana expandible/colapsable
- Lista de usuarios disponibles para chatear
- Búsqueda de conversaciones

#### Tiempo Real con SSE

```typescript
// backend/src/controllers/ChatController.ts
export const streamMessages = async (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const userId = req.user!.id;
  
  // Subscribe to user's message channel
  const unsubscribe = subscribeToUserMessages(userId, (message) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  });
  
  req.on('close', unsubscribe);
};
```

---

## 3. Calendario Unificado

### Especificación Técnica

#### Fuentes de Eventos

| Fuente | Tipo | Color |
|--------|------|-------|
| Vacaciones propias | vacaciones | Verde |
| Vacaciones equipo | vacaciones-equipo | Verde claro |
| Cumpleaños | cumpleaños | Rosa |
| Eventos corporativos | evento | Azul |
| Feriados | feriado | Gris |
| Fichajes | fichaje | Naranja |

#### Modelo de Datos

```prisma
// database/prisma/schema.prisma

model CalendarEvent {
  id          String   @id @default(uuid())
  title       String
  description String?
  startDate   DateTime
  endDate     DateTime
  allDay      Boolean  @default(true)
  type        String   // vacaciones, cumpleaños, evento, feriado
  color       String?
  companyId   String?
  createdBy   String?
  isPublic    Boolean  @default(false)
  
  company Company? @relation(fields: [companyId], references: [id])
  creator User?   @relation(fields: [createdBy], references: [id])
  
  @@index([companyId, startDate])
  @@index([type, startDate])
}
```

#### Arquitectura Backend

```
backend/src/
  controllers/
    CalendarController.ts    # Ya existe, extender
  services/
    CalendarService.ts       # Agregar eventos unificados
```

#### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/calendar/events` | Eventos unificados |
| GET | `/api/calendar/events/birthdays` | Cumpleaños del mes |
| GET | `/api/calendar/events/holidays` | Feriados |
| POST | `/api/calendar/events` | Crear evento corporativo |
| PUT | `/api/calendar/events/:id` | Editar evento |
| DELETE | `/api/calendar/events/:id` | Eliminar evento |

#### Arquitectura Frontend

```
frontend/src/
  components/
    calendar/
      UnifiedCalendar.tsx    # Calendario principal
      CalendarHeader.tsx     # Navegación mes/semana
      CalendarDay.tsx        # Día con eventos
      CalendarEvent.tsx      # Evento individual
      CalendarLegend.tsx     # Leyenda de colores
      BirthdayWidget.tsx     # Widget cumpleaños
  hooks/
    useCalendarEvents.ts     # Hook para eventos
```

#### Vista del Calendario

- **Vista mensual**: Grid con eventos como chips
- **Vista semanal**: Timeline con horas
- **Vista diaria**: Agenda detallada
- **Mini calendario**: En sidebar para navegación rápida

#### Widget de Cumpleaños

- Mostrar cumpleaños del mes actual
- Destacar cumpleaños de hoy
- Notificación el día del cumpleaños
- Opción de enviar felicitación

#### Integración con Vacaciones

- Mostrar vacaciones aprobadas del equipo
- Indicar quién está ausente hoy
- Filtro por departamento
- Exportar a iCal/Google Calendar

---

## Plan de Implementación

### Fase 1: Atajos de Teclado (2 días)

**Día 1:**
- [ ] Crear hook `useKeyboardShortcuts`
- [ ] Implementar atajos globales (Ctrl+K, Ctrl+/, Esc)
- [ ] Crear componente `ShortcutHelp`

**Día 2:**
- [ ] Implementar atajos de navegación (G+tecla)
- [ ] Implementar atajos de acción (Ctrl+F, Ctrl+N)
- [ ] Añadir badges de atajos en botones
- [ ] Tests de integración

### Fase 2: Chat Interno (3 días)

**Día 1:**
- [ ] Crear modelos en Prisma
- [ ] Implementar `ChatService` y `ChatController`
- [ ] Crear rutas de API

**Día 2:**
- [ ] Crear `ChatContext` y hooks
- [ ] Implementar `ChatWidget` flotante
- [ ] Crear `ChatWindow` y `ChatList`

**Día 3:**
- [ ] Implementar SSE para tiempo real
- [ ] Añadir indicador de escritura
- [ ] Notificaciones de mensajes nuevos
- [ ] Tests de integración

### Fase 3: Calendario Unificado (3 días)

**Día 1:**
- [ ] Extender modelo `CalendarEvent`
- [ ] Crear servicio de eventos unificados
- [ ] API endpoints

**Día 2:**
- [ ] Crear `UnifiedCalendar` componente
- [ ] Implementar vistas mes/semana/día
- [ ] Integrar vacaciones existentes

**Día 3:**
- [ ] Widget de cumpleaños
- [ ] Integración con feriados
- [ ] Exportar a iCal
- [ ] Tests de integración

---

## Dependencias

### Nuevas Dependencias Frontend

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.0.0",      // Drag & drop para chat
    "date-fns": "^2.30.0",          // Ya instalado
    "react-calendar": "^4.6.0"      // Calendario base
  }
}
```

### Nuevas Dependencias Backend

```json
{
  "dependencies": {
    "sse": "^0.2.0"                 // Server-Sent Events
  }
}
```

---

## Archivos a Crear/Modificar

### Nuevos Archivos

| Archivo | Descripción |
|---------|-------------|
| `frontend/src/hooks/useKeyboardShortcuts.ts` | Hook de atajos |
| `frontend/src/components/ShortcutHelp.tsx` | Modal de ayuda |
| `frontend/src/components/chat/ChatWidget.tsx` | Widget de chat |
| `frontend/src/components/chat/ChatWindow.tsx` | Ventana de chat |
| `frontend/src/components/calendar/UnifiedCalendar.tsx` | Calendario |
| `backend/src/controllers/ChatController.ts` | Controlador chat |
| `backend/src/services/ChatService.ts` | Servicio chat |

### Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `database/prisma/schema.prisma` | Añadir modelos Chat y CalendarEvent |
| `backend/src/index.ts` | Registrar rutas de chat |
| `frontend/src/App.tsx` | Añadir ChatProvider y widget |
| `frontend/src/components/Header.tsx` | Añadir badge de chat |
| `backend/src/controllers/CalendarController.ts` | Extender para eventos |

---

## Checklist de Implementación

### Atajos de Teclado
- [ ] Hook `useKeyboardShortcuts` implementado
- [ ] Atajos globales funcionando
- [ ] Atajos de navegación funcionando
- [ ] Modal de ayuda con `Ctrl+/`
- [ ] Badges en botones
- [ ] Tests unitarios

### Chat Interno
- [ ] Modelos de datos creados
- [ ] API REST funcionando
- [ ] SSE para tiempo real
- [ ] Widget flotante
- [ ] Lista de conversaciones
- [ ] Envío/recepción mensajes
- [ ] Indicador de escritura
- [ ] Notificaciones
- [ ] Tests unitarios

### Calendario Unificado
- [ ] Modelo CalendarEvent creado
- [ ] API de eventos funcionando
- [ ] Vista mensual
- [ ] Vista semanal
- [ ] Integración vacaciones
- [ ] Widget cumpleaños
- [ ] Feriados nacionales
- [ ] Exportar iCal
- [ ] Tests unitarios

---

*Plan de implementación para Atajos de Teclado, Chat Interno y Calendario Unificado.*