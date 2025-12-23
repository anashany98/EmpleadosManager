# NominasApp - Automatización de Asientos Contables

Aplicación Fullstack para importar nóminas desde Excel y generar asientos contables compatibles con CONTASOL.

## 🚀 Requisitos Previo

- **Docker Desktop** (Debe estar ejecutandose)
- Node.js 18+ (Opcional si se usa Docker)

## 🛠️ Instalación y Despliegue

1. **Clonar/Abrir el proyecto**
2. **Iniciar Docker Compose**:
   ```bash
   docker-compose up --build
   ```
   Esto levantará:
   - Base de Datos (Postgres): Puerto 5432
   - Backend (API Node): Puerto 3000
   - Frontend (React): Puerto 5173

3. **Acceder a la Web**:
   Abrir [http://localhost:5173](http://localhost:5173)

## 🔄 Flujo de Uso

1. **Gestión de Empleados**:
   - Ve a la sección de Empleados.
   - Crea un empleado asignándole un DNI y su Subcuenta 465 (ej: `465.1.0001`).

2. **Importar Nómina**:
   - Ve a "Importar Nómina".
   - Sube el Excel de la gestoría.
   - **Mapeo**: Asocia las columnas del Excel (ej: "Líquido a percibir") con los campos del sistema (ej: "Neto").
   - El sistema validará los importes y cuadrará el asiento.

3. **Generar y Exportar**:
   - Una vez validado, genera los asientos.
   - Descarga el archivo Excel (formato APU) listo para importar en CONTASOL.

## ⚠️ Solución de Problemas

- **Error de Conexión Docker**: Asegúrate de que Docker Desktop está iniciado y acepta conexiones.
- **Base de Datos**: Si falla la conexión, revisa que el puerto 5432 no esté ocupado.
- **Mapeo**: Si el Excel cambia de formato, puedes crear un nuevo perfil de mapeo.

## 🏗️ Arquitectura

- **Frontend**: React + Vite + TailwindCSS (Premium UI).
- **Backend**: Node.js + Express + Prisma.
- **DB**: PostgreSQL.
- **Infra**: Docker Compose.

---
Hecho con ❤️ por Antigravity.
