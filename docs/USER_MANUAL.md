# Manual de Usuario - EmpleadosManager

## Sistema de Gestion de Recursos Humanos

**Version:** 1.0.0
**Ultima actualizacion:** Mayo 2026

---

## Tabla de Contenidos

1. [Introduccion](#1-introduccion)
2. [Primeros Pasos](#2-primeros-pasos)
3. [Modulo de Login y Autenticacion](#3-modulo-de-login-y-autenticacion)
4. [Dashboard Principal](#4-dashboard-principal)
5. [Gestion de Empleados](#5-gestion-de-empleados)
6. [Modulo de Nominas](#6-modulo-de-nominas)
7. [Control de Fichajes](#7-control-de-fichajes)
8. [Calendario Global](#8-calendario-global)
9. [Gestion de Vacaciones](#9-gestion-de-vacaciones)
10. [Gestion de Usuarios](#10-gestion-de-usuarios)
11. [Configuracion del Sistema](#11-configuracion-del-sistema)
12. [Reportes y Analitica](#12-reportes-y-analitica)
13. [Modo Kiosco](#13-modo-kiosco)
14. [Resolucion de Problemas](#14-resolucion-de-problemas)

---

## 1. Introduccion

### 1.1 Que es EmpleadosManager?

EmpleadosManager es un sistema completo de gestion de recursos humanos diseñado para facilitar la administracion de empleados, nominas, control de asistencia y ausencia en organizaciones de cualquier tamano.

### 1.2 Caracteristicas Principales

- **Gestion de Empleados:** Ficha completa con datos personales, laborales y financieros
- **Importacion Masiva:** Carga de empleados desde archivos Excel
- **Control de Fichajes:** Registro de entradas/salidas con geolocalizacion
- **Gestion de Nominas:** Importacion y calculo automatico de costes
- **Calendario Global:** Vista unificada de vacaciones, eventos y festivos
- **Multi-empresa:** Soporte para multiples empresas con un solo sistema
- **Roles y Permisos:** Control de acceso basado en roles (admin, manager, employee)
- **Reportes:** Generacion de informes en PDF y Excel
- **Modo Kiosco:** Punto de fichaje con reconocimiento facial

### 1.3 Requisitos del Sistema

**Para usuarios:**
- Navegador web moderno (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Conexion a internet para acceso al servidor
- Resolucion minima recomendada: 1280 x 720 px

**Para administradores:**
- Node.js 18+ (para desarrollo local)
- PostgreSQL 12+ (para produccion)
- Docker y Docker Compose (instalacion recomendada)

---

## 2. Primeros Pasos

### 2.1 Acceso al Sistema

1. Abre tu navegador web preferido
2. Navega a la URL proporcionada por tu administrador (ej: `http://localhost:5173` en desarrollo)
3. Veras la pantalla de login

![Pantalla de login](./screenshots/01-login-page.png)

### 2.2 Credenciales de Acceso

Tu administrador te proporcionara:
- **Email o DNI:** Identificador unico para el acceso
- **Contrasena:** Clave personal de seguridad

> **Nota:** Si aun no tienes cuenta, contacta con tu administrador de RRHH para que cree una para ti.

### 2.3 Seleccion de Idioma y Region

El sistema esta disponible en espanol (es-ES) por defecto. Los formatos de fecha, numero y moneda se adaptan automaticamente a la region espafiola.

### 2.4 Navegacion Basica

Una vez logueado, veras:

- **Barra lateral izquierda:** Menu de navegacion principal
- **Area de contenido:** Zona principal donde se muestran los datos
- **Barra superior:** Busqueda global, notificaciones y perfil de usuario

![Vista del dashboard](./screenshots/02-dashboard.png)

---

## 3. Modulo de Login y Autenticacion

### 3.1 Pagina de Login

La pagina de login (`/login`) es el punto de entrada al sistema.

**Campos del formulario:**
- **Email o DNI:** Puede usar su direccion de correo electronico institucional o su numero de DNI
- **Contrasena:** Clave personal (distingue mayusculas de minusculas)

**Funcionalidades:**
- Visualizador de contrasena (boton de ojo)
- Recordar email en el navegador
- Enlace de recuperacion de contrasena

### 3.2 Recuperacion de Contrasena

Si olvido su contrasena:

1. Haga clic en **"¿Activar cuenta o olvidaste tu contrasena?"**
2. Se le redirigira a la pagina de solicitud de reseteo
3. Ingrese su email o DNI
4. Recibira un enlace de recuperacion en su correo
5. Siga el enlace y establezca una nueva contrasena

![Pagina de solicitud de reseteo de contrasena](./screenshots/01-login-page.png)

### 3.3 Redireccion Basada en Roles

Segun el rol asignado, cada usuario ve un dashboard diferente:

| Rol | Dashboard | Permisos |
|-----|-----------|----------|
| **admin** | Panel de Control Completo | Gestion total del sistema |
| **manager** | Panel de Equipo | Gestion de su departamento |
| **employee** | Mi Dashboard | Autoservicio y consulta propia |

---

## 4. Dashboard Principal

El dashboard es la pantalla principal que se muestra tras el login. Hay tres variantes principales.

### 4.1 Dashboard de Usuario (Empleado)

**Ruta:** `/`

[SCREENSHOT: Dashboard para empleados con vista de metricas personales]

**Elementos visibles:**
- **Resumen de actividad:** Ultimas horas trabajadas
- **Mis vacaciones:** Saldo de dias disponibles
- **Mis fichajes:** Registro de entradas y salidas
- **Notificaciones:** Alertas personales

### 4.2 Dashboard de Administrador (Panel de Control)

**Ruta:** `/`

![Dashboard de administrador](./screenshots/02-dashboard.png)

**Secciones principales:**

1. **Selector de Empresa** (solo admins globales)
   - Lista desplegable en la esquina superior derecha
   - Permite filtrar datos por empresa

2. **Tarjetas de Metricas**
   - **Empleados:** Total de empleados activos
   - **Ausentes:** Personas que no trabajan hoy
   - **Alertas:** Requerimientos de atencion
   - **Nominas:** Coste del mes actual

3. **Acciones Rapidas**
   - Nuevo Empleado
   - Vacaciones
   - Informes
   - Fichajes

4. **Actividad Reciente**
   - Feed de ultimas acciones en el sistema
   - Tipos: creacion, actualizacion, eliminacion

5. **Alertas**
   - Lista de alertas pendientes
   - Contratos por vencer
   - Vacaciones pendientes de aprobar

### 4.3 Panel RRHH

**Ruta:** `/rrhh-dashboard`

![Panel especifico de RRHH](./screenshots/02-dashboard.png)

Este dashboard muestra metricas especificas del departamento de RRHH:
- Total empleados
- Nuevos este mes
- Ausencias pendientes
- Vacaciones activas

### 4.4 Analytics Dashboard

**Ruta:** `/analytics`

![Dashboard analitico con graficos y tendencias](./screenshots/09-analytics.png)

**Caracteristicas:**
- Selector de periodo (Mes, Trimestre, Ano)
- Tarjetas KPI con cambios porcentuales
- Graficos de tendencia
- Desglose por departamento
- Mapa de calor de ausencias
- Embudo de contratacion
- Distribucion de antiguedad

---

## 5. Gestion de Empleados

### 5.1 Lista de Empleados

**Ruta:** `/employees`

![Vista de lista de empleados con tabla y filtros](./screenshots/03-employees.png)

**Funcionalidades:**

1. **Barra de busqueda**
   - Busqueda por nombre, DNI, email
   - Resultados en tiempo real

2. **Filtros avanzados**
   - Estado (Activo/Inactivo)
   - Departamento
   - Centro de trabajo
   - Tipo de contrato
   - Empresa

3. **Importacion masiva**
   - Boton "Importar" en la esquina superior
   - Descarga de plantilla Excel
   - Carga de archivo con validacion
   - Revision de errores antes de importar

4. **Acciones masivas**
   - Seleccion multiple de empleados
   - Exportacion a Excel
   - Generacion de informes

### 5.2 Detalle de Empleado

**Ruta:** `/employees/:id`

[SCREENSHOT: Ficha completa de empleado con tabs]

Al hacer clic en un empleado, se abre su ficha completa organizada en pestanas:

#### Pestana Informacion (Info)

**Datos Personales:**
- Nombre completo
- DNI/NIE
- Fecha de nacimiento
- Genero
- Nacionalidad
- Estado civil

**Datos de Contacto:**
- Email personal
- Telefono movil
- Telefono fijo
- Direccion

**Datos Laborales:**
- Puesto de trabajo
- Departamento
- Centro de trabajo
- Categoria profesional
- Fecha de alta
- Tipo de contrato
- Jornada laboral

**Datos Bancarios:**
- Banco
- Numero de cuenta IBAN

#### Pestana Nominas (Payroll)

[SCREENSHOT: Pestana de nominas del empleado]

- Historial de nominas importadas
- Detalle de cada nomina (bruto, SS, IRPF, neto)
- Coste empresa total
- Descargar nomina en PDF

#### Pestana Documentos (Expediente)

[SCREENSHOT: Pestana de documentos y expediente]

- Lista de documentos adjuntos
- Tipos: DNI, contrato, carnet de conducir, certificados
- Subida de nuevos documentos
- Vista previa de documentos
- Fecha de caducidad de documentos

#### Pestana Checklist

[SCREENSHOT: Pestana de checklist de onboarding/offboarding]

- Lista de tareas pendientes
- Estado de cada tarea
- Marcar como completada
- Plantillas de checklist configurables

#### Pestana Fichajes

[SCREENSHOT: Pestana de fichajes del empleado]

- Calendario mensual de fichajes
- Lista de entradas/salidas
- Horas trabajadas por dia
- Minimo/Maximo/Promedio de horas

#### Pestana Vacaciones

[SCREENSHOT: Pestana de vacaciones del empleado]

- Saldo actual de vacaciones
- Historial de solicitudes
- Solicitar nuevas vacaciones
- Vacaciones disponibles

#### Pestana Operaciones

[SCREENSHOT: Pestana de operaciones]

- Historial de cambios
- Usuario que realizo cada cambio
- Fecha y hora del cambio

### 5.3 Crear Nuevo Empleado

**Ruta:** `/employees/new`

[SCREENSHOT: Formulario de creacion de nuevo empleado]

**Pasos:**

1. **Informacion Personal**
   - Complete todos los campos obligatorios (*)
   - El DNI se usa como identificador unico

2. **Informacion Laboral**
   - Seleccione empresa, departamento, puesto
   - Configure jornada y tipo de contrato

3. **Datos de Pago**
   - Ingrese datos bancarios para transferencias

4. **Documentacion**
   - Suba documentos iniciales (opcional)

5. **Revisar y Guardar**
   - Verifique todos los datos
   - Haga clic en "Crear Empleado"

> **Importante:** Una vez creado, el empleado recibira un email con instrucciones para activar su cuenta.

### 5.4 Importacion Masiva desde Excel

[SCREENSHOT: Asistente de importacion de empleados]

**Proceso:**

1. Haga clic en **Importar** en la lista de empleados
2. **Paso 1:** Descargue la plantilla Excel
3. **Paso 2:** Rellene los datos siguiendo las guias de la plantilla
4. **Paso 3:** Suba el archivo Excel
5. **Paso 4:** Revise la previsualizacion de datos
6. **Paso 5:** Confirme la importacion
7. **Resultado:** Ver resumen de registros importados

**Columnas requeridas en la plantilla:**
- DNI (identificador unico)
- Nombre
- Apellidos
- Email
- Fecha de alta

**Columnas opcionales:**
- Telefono
- Departamento
- Puesto
- Centro de trabajo
- IBAN

---

## 6. Modulo de Nominas

### 6.1 Importacion de Nominas

**Ruta:** `/import` o `/payroll-import`

![Pagina principal de importacion de nominas](./screenshots/05-payroll.png)

**Proceso de importacion (3 pasos):**

#### Paso 1: Subir archivo

1. Seleccione o arrastre el archivo Excel (.xlsx o .xls)
2. Verifique que el archivo se haya cargado correctamente
3. Haga clic en "Comenzar Importacion"

#### Paso 2: Mapear columnas

[SCREENSHOT: Pantalla de mapeo de columnas Excel a campos del sistema]

**Mapeo de datos del empleado:**
- **DNI / ID Empleado:** Columna que contiene el identificador
- **Nombre Empleado:** Columna con el nombre completo
- **Subcuenta (Opcional):** Para contabilidad

**Mapeo de importes economicos:**
- **Neto a Pagar:** Salario neto
- **Total Devengado (Bruto):** Salario bruto
- **Seg. Social Empresa:** Aportacion empresarial a SS
- **Seg. Social Trabajador:** Deduccion SS empleado
- **IRPF:** Retencion de impuestos

**Guardar perfil de mapeo:**
- Puede guardar la configuracion de mapeo como perfil
- Muy util si importa nominas del mismo origen regularmente

#### Paso 3: Revision

[SCREENSHOT: Pantalla de revision con estadisticas]

- Verificacion final de datos
- Estadisticas: registros procesados, errores
- Botones: Ver Detalle / Importar Otro Lote

### 6.2 Generacion Automatica desde Kiosco

Si usa elModo Kiosco, puede generar nominas automaticamente:

1. Seleccione el ano y mes
2. Haga clic en "Generar Nominas"
3. El sistema calculara en base a las horas fichadas

### 6.3 Detalle de Lote de Nomina

**Ruta:** `/payroll/batch/:batchId`

[SCREENSHOT: Detalle de un lote de nominas]

**Informacion visible:**
- Periodo (mes/ano)
- Total de nominas
- Coste total empresa
- Desglose por empleado

**Acciones:**
- Exportar a Excel
- Exportar a PDF
- Ver detalle individual de cada nomina

### 6.4 Costes Automatizados

El sistema calcula automaticamente:

- **Coste Empresa:** BRUTO + SS EMPRESA
- **Subcuenta 465:** Para exportacion contable
- **Horas Extra:** Tarifa segun categoria

---

## 7. Control de Fichajes

### 7.1 Vista de Control de Fichajes

**Ruta:** `/timesheet`

![Vista principal del control de fichajes](./screenshots/06-timesheet.png)

**Filtros disponibles:**
- **Departamento:** Todos o especifico
- **Empleado:** Todos o uno concreto
- **Mes:** Navegacion entre meses
- **Vista:** Calendario o Lista

### 7.2 Vista de Calendario

[SCREENSHOT: Vista de calendario mensual con fichajes]

- Grid de 7 columnas (Lunes a Domingo)
- Cada dia muestra:
  - Numero de personas que ficharon
  - Total de horas
- Los dias con fichajes se resaltan en azul
- Haga clic en un dia para ver el detalle

### 7.3 Vista de Lista

[SCREENSHOT: Vista en lista de fichajes]

**Columnas de la tabla:**
- Empleado
- Fecha
- Entrada (hora)
- Salida (hora)
- Pausa (duracion)
- Total (horas trabajadas)
- Ubicacion (icono de mapa si esta disponible)

### 7.4 Importacion de Fichajes

**Ruta:** `/settings` (seccion "Importador de Horas de Fichaje")

[SCREENSHOT: Importador de horas de fichaje]

**Requisitos del archivo Excel:**
- Columna **DNI** para identificar al empleado
- Columna **Fecha** (formato dia/mes/ano)
- Columna **Extr** para las horas extras
- Tamano maximo: 5MB

### 7.5 Anomalias de Fichajes

**Ruta:** `/anomalies` o `/attendance-reconciliation`

[SCREENSHOT: Pagina de reconciliation de asistencia]

El sistema detecta automaticamente:
- **Jornadas incompletas:** Sin hora de salida
- **Fichajes fuera de horario:** Entrada muy tarde o salida muy temprano
- **Excesos de jornada:** Mas horas de las programadas
- **Fichajes duplicados:** Entradas repetidas

**Acciones:**
- Revisar cada.anomalia
- Aprobar como valido
- Solicitar correccion

---

## 8. Calendario Global

**Ruta:** `/calendar`

![Calendario global con eventos](./screenshots/04-calendar.png)

### 8.1 Tipos de Eventos

El calendario muestra multiples tipos de eventos:

| Tipo | Color | Descripcion |
|------|-------|-------------|
| **Vacaciones** | Verde esmeralda | Ausencias aprobadas del equipo |
| **Vacaciones propias** | Verde oscuro | Sus propias vacaciones |
| **Cumpleanos** | Rosa | Cumpleanos de empleados |
| **Festivos** | Gris | Festivos de la empresa |
| **Eventos** | Azul | Eventos internos |
| **Fichajes** | Naranja | Registros de fichaje |

### 8.2 Navegacion

- **Flechas < >:** Mes anterior / siguiente
- **Boton "Hoy":** Volver al mes actual
- **Buscador:** Filtrar por nombre o evento
- **Filtro por departamento:** Solo admins y managers

### 8.3 Crear Evento

[SCREENSHOT: Modal de creacion de nuevo evento]

**Solo admins y managers pueden crear eventos.**

1. Haga clic en el boton **"+ Nuevo evento"**
2. Rellene el formulario:
   - Titulo del evento
   - Fecha de inicio
   - Fecha de fin
   - Tipo (Evento interno / Festivo empresa / Corporativo)
   - Ubicacion (opcional)
   - Descripcion (opcional)
3. Guarde el evento

### 8.4 Registrar Ausencia

**Solo admins y managers pueden registrar ausencias.**

1. Haga clic en **"+ Nueva ausencia"**
2. Seleccione el empleado
3. Configure:
   - Fecha de inicio
   - Fecha de fin
   - Tipo de ausencia (Vacaciones / Baja medica / Permiso / Hora medica)
   - Notas (opcional)
4. Guarde la ausencia

### 8.5 Sincronizacion de Vacaciones

Los empleados pueden sincronizar sus vacaciones con calendarios externos:

1. Haga clic en **"Sincronizar mis vacaciones"**
2. Se generara un enlace de suscripcion
3. Copie el enlace en Google Calendar, Outlook, etc.

---

## 9. Gestion de Vacaciones

**Ruta:** `/vacations`

![Portal de vacaciones para empleados](./screenshots/11-vacations.png)

### 9.1 Tipos de Ausencias

| Codigo | Nombre | Descripcion |
|--------|--------|-------------|
| VACATION | Vacaciones | Periodo de descanso anual |
| SICK_LEAVE | Baja medica | Incapacidad temporal por enfermedad |
| PERMIT | Permiso | Ausencia autorizada |
| MEDICAL_HOUR | Hora medica | Cita medica |

### 9.2 Solicitar Vacaciones (Empleado)

[SCREENSHOT: Formulario de solicitud de vacaciones]

1. Acceda al portal de vacaciones
2. Haga clic en **"Solicitar vacaciones"**
3. Complete:
   - Fecha de inicio
   - Fecha de fin
   - Tipo de ausencia
   - Notas adicionales (opcional)
4. Envie la solicitud

### 9.3 Aprobar/Rechazar Solicitudes (Manager/Admin)

[SCREENSHOT: Lista de solicitudes pendientes con acciones]

1. Vaya a la seccion de solicitudes pendientes
2. Revise cada solicitud:
   - Empleado solicitante
   - Periodo solicitado
   - Balance de vacaciones disponible
3. Acciones disponibles:
   - **Aprobar:** La ausencia queda confirmada
   - **Rechazar:** Se debe indicar un motivo
   - **Solicitar modificacion:** Pedir cambio de fechas

### 9.4 Mi Balance de Vacaciones

[SCREENSHOT: Seccion de balance personal de vacaciones]

Cada empleado puede ver:
- **Cupo anual:** Dias de vacaciones correspondientes
- **Dias arrastrados:** Vacaciones no usadas del ano anterior
- **Dias consumidos:** Ya disfrutados
- **Dias pendientes:** Disponibles para solicitar
- **Proyeccion:** Balance estimado tras solicitudes pendientes

### 9.5 Calendario de Vacaciones

Vista mensual con:
- Sus propias vacaciones aprobadas
- Las del equipo (solo managers)
- Festivos de la empresa
- Facilita la planificacion y cobertura

---

## 10. Gestion de Usuarios

**Ruta:** `/users`

![Gestion de usuarios](./screenshots/10-users.png)

### 10.1 Pestana Usuarios

[SCREENSHOT: Lista de usuarios del sistema]

**Lista de usuarios con:**
- Email
- Rol (admin / manager / employee)
- Perfil de permisos
- Estado (activo/inactivo)
- Fecha de creacion

**Acciones:**
- Crear nuevo usuario
- Editar usuario existente
- Asignar/perfil de permisos
- Activar/Desactivar usuario
- Eliminar usuario

### 10.2 Crear Nuevo Usuario

[SCREENSHOT: Formulario de creacion de usuario]

1. Haga clic en **"Nuevo usuario"**
2. Complete los datos:
   - Email (identificador unico)
   - Nombre
   - Rol inicial
   - Empresa asociada (si aplica)
   - Empleado relacionado (opcional)
3. El usuario recibira un email para activar su cuenta

### 10.3 Perfiles de Permisos

[SCREENSHOT: Pestana de perfiles de permisos]

**Propósito:**
Los perfiles permiten agrupar permisos y asignarlos rapidamente a usuarios.

**Perfiles predefinidos:**
- **Admin:** Acceso total
- **Manager:** Gestion de su equipo
- **Employee:** Solo autoservicio

**Crear perfil personalizado:**
1. Vaya a la pestana **Perfiles**
2. Haga clic en **"+ Nuevo perfil"**
3. Asigne un nombre
4. Configure los permisos por modulo:
   - Lectura (view)
   - Escritura (write)
   - Eliminacion (delete)
   - Administracion (admin)

### 10.4 Matriz de Permisos por Modulo

| Modulo | Admin | Manager | Employee |
|--------|-------|---------|----------|
| Dashboard | Ver todo | Ver equipo | Ver propio |
| Empleados | CRUD total | Ver/Editar equipo | Ver propio |
| Nominas | Importar/Ver | Ver equipo | Ver propio |
| Fichajes | Ver/Importar | Ver equipo | Ver propio |
| Vacaciones | Aprobar/Todo | Aprobar equipo | Solicitar |
| Calendario | Crear/Editar | Crear equipo | Ver propio |
| Reportes | Todos | Equipo | Propios |
| Configuracion | Total | - | - |

---

## 11. Configuracion del Sistema

**Ruta:** `/settings`

![Vista principal de configuracion](./screenshots/07-settings.png)

### 11.1 Tarifas de Horas Extras

[SCREENSHOT: Seccion de tarifas de horas extra]

Configure las tarifas por hora extra segun categoria profesional:

- **Dia Normal:** Tarifa para horas extra en dias laborales
- **Festivo / Fin de semana:** Tarifa incrementada para esos dias

El sistema usara estas tarifas automaticamente al calcular el coste de las horas extra.

### 11.2 Importador de Horas de Fichaje

(Descrito en seccion 7.4)

### 11.3 Configuracion de Correo (SMTP)

[SCREENSHOT: Seccion de configuracion SMTP]

**Parametros necesarios:**
- Servidor SMTP (ej: smtp.gmail.com)
- Puerto (generalmente 587 para TLS, 465 para SSL)
- Usuario / Email
- Contrasena
- Remitente (From)
- Usar SSL/TLS (marcar si aplica)

**Probar configuracion:**
1. Ingrese un email de prueba
2. Haga clic en "Enviar"
3. Verifique que el email llegue correctamente

> **Nota:** Si deja el servidor vacio, el sistema usara una cuenta "Fake" de Ethereal para pruebas.

### 11.4 Bandeja de Entrada (IMAP)

[SCREENSHOT: Configuracion de bandeja de entrada]

Configure la recepcion de documentos por correo:

**Escaner y Servidor:**
- Ruta de monitorizacion: Donde el escaner deposita los PDF

**Recepcion por Email (IMAP):**
- Habilitar recepcion por correo
- Servidor IMAP (ej: imap.gmail.com)
- Puerto (generalmente 993)
- Usuario / Email
- Contrasena

### 11.5 Plantillas de Documentos

**Ruta:** `/templates`

[SCREENSHOT: Gestion de plantillas de documentos]

Permite crear y gestionar plantillas para:
- Contratos de trabajo
- Cartas de advertencia
- Certificados de empresa
- Justificantes de ausencia

### 11.6 Backups

[SCREENSHOT: Seccion de gestion de backups]

- **Backup manual:** Crear una copia de seguridad ahora
- **Backup automatico:** Configurar programacion
- **Restaurar:** Recuperar datos de un backup anterior
- **Descargar:** Exportar backup a archivo local

---

## 12. Reportes y Analitica

### 12.1 Modulo de Reportes

**Ruta:** `/reports`

![Pagina principal de reportes](./screenshots/08-reports.png)

#### Tipos de Reportes Disponibles

1. **Asistencia y jornadas**
   - Resumen diario con horas trabajadas
   - Segmentos y jornadas incompletas
   - Rango de fechas personalizable

2. **Horas extra y coste**
   - Horas adicionales registradas
   - Tarifas aplicadas
   - Coste generado por periodo

3. **Vacaciones y saldos**
   - Cuota anual por empleado
   - Consumo y saldo disponible
   - Solicitudes registradas

4. **Coste empresa**
   - Bruto, SS empresa, IRPF, neto
   - Desglose por persona o departamento

5. **Bajas y ausencias**
   - Casos detallados con duracion
   - Motivo y seguimiento

6. **KPIs de organizacion**
   - Rotacion de personal
   - Tasa de absentismo
   - Analisis departamental

7. **Igualdad y diversidad**
   - Desglose por genero
   - Brecha salarial estimada
   - Media salarial por departamento

#### Generacion de Reportes

1. Seleccione el tipo de reporte del catalogo
2. Configure los filtros:
   - Empresa (si aplica)
   - Departamento
   - Periodo (fechas o ano/mes)
3. Haga clic en "Generar"
4. Espere a que se calculen las metricas

#### Exportar Reportes

[SCREENSHOT: Opciones de exportacion]

**Formatos disponibles:**
- **Excel:** Datos completos para analisis adicional
- **PDF:** Reporte formateado para impresion o envio

**Programacion de reportes:**
- Puede programar un reporte para generarse automaticamente
- Seleccione frecuencia (diaria, semanal, mensual)
- Configure destinatarios de email

### 12.2 Analisis de Datos (Analytics)

(Descrito en seccion 4.4)

---

## 13. Modo Kiosco

**Ruta:** `/kiosk`

[SCREENSHOT: Pantalla principal del kiosco de fichaje]

### 13.1 Que es elModo Kiosco?

ElModo Kiosco es un punto de fichaje inteligente que permite a los empleados registrar su entrada y salida usando reconocimiento facial.

### 13.2 Funcionalidades Principales

- **Reconocimiento facial:** Identificacion automatica del empleado
- **Confirmacion con sonrisa:** Doble verificacion de seguridad
- **Fichaje offline:** Funciona sin conexion a internet
- **Sincronizacion automatica:** Cuando vuelve la conexion, se envian los datos
- **Notificaciones de voz:** Confirmaciones audibles en espanol

### 13.3 Como Fichar (Empleado)

[SCREENSHOT: Secuencia de fichaje con sonrisa]

1. **Mire a la camara**
   - Se mostrara "Buscando cara..."
   - El sistema le identificara automaticamente

2. **Sonria para confirmar**
   - Al detectarle, el sistema pedira que sonria
   - Una vez confirmada su identidad, el fichaje se registra

3. **Reciba confirmacion**
   - Verá "ENTRADA" o "SALIDA" dependiendo de su estado
   - Escuchara confirmacion por voz

### 13.4 Fichaje con Problemas de Conexion

[SCREENSHOT: Indicador de modo offline]

Si no hay conexion a internet:
- El sistema guardara el fichaje localmente
- Aparecera icono de WifiOff en la esquina
- Cuando vuelva la conexion, se sincronizara automaticamente
- No necesita repetir el fichaje

### 13.5 Panel de Administracion del Kiosco

**Acceso:** Boton de engranaje en la esquina superior derecha

[SCREENSHOT: Panel de administracion del kiosco]

Funciones de administracion:
- Ver historial de fichajes del dia
- Estadisticas de uso
- Gestionar empleados enrolados
- Configurar parametros de camara
- Diagnosticar problemas de conexion

### 13.6 Requisitos Tecnicos

- **Camara:** Webcam con resolucion minima 720p
- **Iluminacion:** Ambiente bien iluminado (evitar contraluz)
- **Navegador:** Chrome o Edge recomendados
- **Reconocimiento facial:** El empleado debe estar enrolado previamente

---

## 14. Resolucion de Problemas

### 14.1 Problemas de Acceso

#### "Error al iniciar sesion"
- Verifique que su email o DNI este escrito correctamente
- Compruebe que Bloq Mayus no este activado
- Asegurese de que la contrasena sea correcta
- Si el problema persiste, use "Olvide mi contrasena"

#### "Error de conexion con el servidor"
- Verifique que el servidor este encendido
- Compruebe su conexion a internet
- Contacte al administrador si el problema continua

#### "Cuenta desactivada"
- Contacte al administrador de RRHH para activar su cuenta

### 14.2 Problemas con Empleados

#### "No puedo ver la lista de empleados"
- Verifique que tiene permisos de acceso
- Contacte al administrador si ve el mensaje de error

#### "Error al importar desde Excel"
- Compruebe que el formato sea .xlsx o .xls
- Verifique que las columnas requeridas esten presentes
- Asegurese de que el DNI no este duplicado en el archivo

### 14.3 Problemas con Nominas

#### "El mapeo de columnas no funciona"
- Guarde la configuracion como perfil para reutilizarla
- Verifique que los nombres de columna coincidan exactamente

#### "Las horas extra no se calculan"
- Configure las tarifas en Configuracion > Tarifas de Horas Extras
- Verifique que los empleados tengan categoria asignada

### 14.4 Problemas con Fichajes

#### "No aparecen fichajes de un empleado"
- Verifique que el empleado tenga DNI registrado
- Compruebe que el archivo de importacion contenga ese DNI

#### "El reloj no sincroniza"
- En el kiosco, verifique la conexion a internet
- Reinicie el dispositivo si el problema persiste

### 14.5 Problemas con el Kiosco

#### "No me reconoce el rostro"
- Asegurese de estar frente a la camara
- Verifique que haya suficiente iluminacion
- Contacte al administrador para re-enrolar su rostro

#### "Me reconoce como otra persona"
- Informe al administrador para revisar los enrollamientos
- Use el metodo alternativo (PIN/contrasena)

### 14.6 Contacto de Soporte

Si el problema no esta en esta lista:

1. **Para usuarios finales:** Contacte a su administrador de RRHH
2. **Para administradores:** Revise los logs del servidor en `backend/logs/`
3. **Errores criticos:** Verifique la conexion a la base de datos

---

## Anexo A: Glosario de Terminos

| Termino | Definicion |
|---------|------------|
| **BRUTO** | Salario total antes de deducciones |
| **SS (Seguridad Social)** | Aportaciones obligatorias a la Seguridad Social |
| **IRPF** | Impuesto sobre la Renta de Personas Fisicas |
| **NETO** | Salario final despues de todas las deducciones |
| **IBAN** | Numero de cuenta bancaria internacional |
| **Cupo** | Numero de dias de vacaciones correspondientes |
| **Arrastre** | Vacaciones no usadas que se arrastran al siguiente ano |
| **Turnover** | Tasa de rotacion de personal |
| **Absentismo** | Porcentaje de ausencias sobre jornada total |

## Anexo B: Atajos de Teclado

| Accion | Atajo |
|--------|-------|
| Buscar | `Ctrl + K` |
| Nueva empleado | `Ctrl + N` |
| Guardar | `Ctrl + S` |
| Volver al dashboard | `Ctrl + D` |
| Refrescar | `F5` |

## Anexo C: Formatos de Archivo Soportados

| Tipo | Formatos | Usado para |
|------|----------|------------|
| Excel | .xlsx, .xls | Importar empleados, nominas, fichajes |
| PDF | .pdf | Exportar reportes, nominas |
| Imagenes | .jpg, .png | Documentos de empleados |
| Calendario | .ics | Sincronizacion de vacaciones |

---

**Fin del Manual de Usuario**

*EmpleadosManager - Sistema de Gestion de Recursos Humanos*
*Version 1.0.0 - Mayo 2026*
