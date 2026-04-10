# 👥 EmpleadosManager - Sistema de Gestión de RRHH

Sistema completo de gestión de empleados con nóminas, control de ausencias, horas extras y fichajes.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Características Principales

### 📊 Gestión de Empleados
- Ficha completa de empleado con datos personales, laborales y financieros
- Importación masiva desde Excel
- Seguimiento de documentación (DNI, carnet de conducir, contratos)
- Historial de cambios y auditoría

### 💰 Nóminas y Finanzas
- Importación de nóminas desde Excel
- Cálculo automático de costes
- Gestión de horas extras con tarifas por categoría
- Subcuentas contables (465)

### 📅 Gestión de Ausencias
- Calendario global de empresa
- Tipos: Vacaciones, Bajas médicas, Permisos, Horas médicas
- Cálculo automático de días laborables
- Cupo proporcional según fecha de alta
- Generación de justificantes PDF

### ⏰ Control de Fichajes
- Registro de entradas/salidas
- Gestión de pausas
- Cálculo automático de horas trabajadas
- Vista individual por empleado
- Calendario global de control horario
- Importación desde Excel

### 🏢 Multi-empresa
- Gestión de múltiples empresas
- Filtrado por empresa en dashboard
- Asignación de empleados por empresa

### 📈 Analytics y Reportes
- Dashboard con métricas clave
- Alertas automáticas (vencimientos, ausencias)
- Tendencias de contratación
- Informes de ausencias

## 🛠️ Tecnologías

### Frontend
- **React 18** + **TypeScript**
- **Vite** - Build tool ultrarrápido
- **TailwindCSS** - Styling
- **Framer Motion** - Animaciones
- **Recharts** - Gráficos
- **Lucide React** - Iconos
- **Sonner** - Notificaciones
- **jsPDF** - Generación de PDFs

### Backend
- **Node.js** + **Express** + **TypeScript**
- **Prisma ORM** - Base de datos
- **SQLite** - Base de datos (fácil de cambiar a PostgreSQL/MySQL)
- **Multer** - Upload de archivos
- **XLSX** - Procesamiento de Excel

## 📦 Instalación

### Requisitos Previos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0

### Pasos

1. **Clonar el repositorio**
```bash
git clone https://github.com/anashany98/EmpleadosManager.git
cd EmpleadosManager
```

2. **Instalar dependencias**

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
npm install

# Database
cd ../database
npm install
```

3. **Levantar infraestructura local**

```bash
npm run infra:up
```

Si `5432` o `6379` ya estÃ¡n ocupados por otro stack local, ajusta `.env` o `backend/.env`:

```bash
POSTGRES_PORT=55432
REDIS_PORT=6381
DATABASE_URL=postgresql://nominas:nominas_local_pw_2026@localhost:55432/nominas_db?schema=public
```

4. **Aplicar Prisma**

```bash
npm run db:generate
npm run db:migrate
```

4. **Iniciar la aplicación**

Abrir 2 terminales:

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
El backend correrá en `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
El frontend correrá en `http://localhost:5173`

5. **Acceder a la aplicación**
   
Abrir el navegador en `http://localhost:5173`

## 📚 Uso

### Importar Empleados
1. Ir a **Configuración** → **Importar Empleados**
2. Descargar la plantilla Excel
3. Rellenar los datos
4. Subir el archivo

### Registrar Ausencias
1. Ir a **Calendario**
2. Seleccionar empleado y rango de fechas
3. Elegir tipo de ausencia
4. Guardar

### Importar Fichajes
1. Ir a **Configuración** → **Importar Horas**
2. Subir Excel con columnas: DNI, Fecha, Entrada, Salida, Pausa
3. El sistema calculará automáticamente las horas

### Ver Fichajes
- **Vista Individual**: Abrir ficha de empleado → Pestaña "Fichajes"
- **Vista Global**: Menú → Fichajes

## 🗂️ Estructura del Proyecto

```
EmpleadosManager/
├── frontend/          # Aplicación React
│   ├── src/
│   │   ├── api/      # Cliente API
│   │   ├── components/  # Componentes reutilizables
│   │   ├── pages/    # Páginas principales
│   │   └── utils/    # Utilidades (festivos, etc.)
│   └── public/
├── backend/           # API Express
│   ├── src/
│   │   ├── controllers/  # Lógica de negocio
│   │   ├── routes/   # Definición de rutas
│   │   └── services/ # Servicios (validación, mapeo, etc.)
│   └── uploads/      # Archivos subidos
└── database/          # Configuración Prisma
    ├── prisma/
    │   └── schema.prisma  # Esquema de base de datos
    └── dev.db         # Base de datos SQLite (generada)
```

## 🔐 Seguridad

> [!IMPORTANT]
> El sistema implementa las siguientes medidas de seguridad para proteger los datos:
> - **Autenticación Robusta**: Uso de JWT con Refresh Tokens.
> - **Protección CSRF**: Implementada mediante middleware.
> - **Cifrado**: Datos sensibles (DNI, SS) cifrados en reposo.
> - **Políticas de Contraseña**: Validación de complejidad obligatoria.
> - **Control de Acceso**: Roles de administrador, manager y usuario común.

## 🚀 Despliegue

### Opción 1: Docker (Recomendado)

```bash
docker-compose up -d
```

### Opción 2: Manual

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
# Servir la carpeta dist/ con nginx o similar
```

## 📝 Roadmap

- [x] Sistema de autenticación y roles
- [x] Portal de autoservicio para empleados
- [x] Gestión de nóminas y exportación PDF
- [/] Gestión de documentos adjuntos (Próximamente)
- [/] Tests automatizados (En progreso)
- [ ] Aplicación móvil (Roadmap)
- [ ] Notificaciones por email avanzadas (Roadmap)

## 🤝 Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👨‍💻 Autor

**Anas Hany Lahroudy**
- GitHub: [@anashany98](https://github.com/anashany98)

## 🙏 Agradecimientos

- Iconos por [Lucide](https://lucide.dev/)
- UI inspirado en diseños modernos de RRHH
- Comunidad de React y Node.js

---

⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub!
