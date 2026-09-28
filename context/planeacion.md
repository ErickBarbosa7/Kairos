Documento de Planeación por Etapas: Plataforma Kairos

Proyecto: Kairos - SaaS de Fidelización Gamificada B2B2C
Objetivo del Documento: Dividir el desarrollo en fases incrementales y lógicas. Cada fase debe tener entregables funcionales que puedan ser probados de manera independiente antes de pasar a la siguiente.

Fase 1: Cimientos y Arquitectura Base (Core & Super Admin)

Objetivo: Construir la base de datos que soportará el modelo Multitenant (múltiples negocios) y la API REST que servirá de puente para todo el sistema.

Paso 1.1 - Diseño de Base de Datos:

Crear el esquema relacional (PostgreSQL + Prisma).

Tablas principales: SuperAdmin, Tenants (Empresas), Users (Clientes finales), Rewards (Recompensas), Transactions (Historial de puntos).

Paso 1.2 - API REST (Autenticación y Rutas Base):

Configurar Node.js + Express.

Implementar login/registro y seguridad con JWT (JSON Web Tokens).

Paso 1.3 - Panel Super Admin (MVP):

Desarrollar el frontend básico (React/Tailwind) exclusivo para ti.

Funcionalidad: Crear, editar y suspender Tenants.

Hito de la Fase 1: La base de datos es capaz de aislar la información de la "Empresa A" y la "Empresa B". El Super Admin puede registrar nuevas empresas.

Fase 2: Ecosistema del Inquilino (Tenant Dashboard)

Objetivo: Darle a cada negocio su propio panel de control para gestionar su identidad y sus premios.

Paso 2.1 - Configuración de Marca (El "Camaleón"):

Formulario para que la empresa suba su logo (almacenamiento en nube, ej. AWS S3 o Cloudinary) y elija sus colores (Hex codes).

Paso 2.2 - CRUD de Recompensas:

Interfaz para crear catálogo: Título del premio, descripción, imagen y "Costo en Puntos".

Paso 2.3 - Punto de Validación (Caja):

Vista donde el empleado del mostrador puede ingresar o escanear un código OTP para marcar una recompensa como "Entregada".

Hito de la Fase 2: Un negocio puede iniciar sesión, personalizar su marca, agregar premios y prepararse para recibir clientes.

Fase 3: El Motor Gamificado (Terminal Arcade Física)

Objetivo: Desarrollar el juego en Unity que atraerá a los clientes, configurado dinámicamente según el negocio en el que se instale.

Paso 3.1 - Conexión API y UI Dinámica:

Script en C# que al arrancar el juego lea su variable de entorno store_id.

Petición GET a la API para descargar el logo y colores del Tenant, aplicándolos a los botones, fondos y menús del juego.

Paso 3.2 - Mecánicas Core de Juego:

Desarrollar el bucle de 1 minuto (ej. recolección de monedas, esquivar obstáculos).

Sistema interno de puntuación en Unity.

Paso 3.3 - Seguridad y Generación de QR:

Al perder (Game Over), tomar la puntuación y el store_id.

Firmar y encriptar estos datos en un JWT usando una llave secreta.

Convertir ese JWT en un código QR renderizado en pantalla (con tiempo de expiración corto para evitar fotos/fraudes).

Hito de la Fase 3: El ejecutable de Unity corre, se viste de la marca correcta, permite jugar y genera un QR seguro con los puntos al finalizar.

Fase 4: La Retención del Usuario (Wallet PWA)

Objetivo: La WebApp orientada al consumidor final para acumular puntos y canjear premios.

Paso 4.1 - Autenticación y Escáner QR:

Login/Registro rápido para el jugador (idealmente con Google/Apple o número de teléfono).

Integración de un lector de QR web (acceso a cámara).

Lógica para enviar el QR al backend, decodificar el JWT y sumar los puntos al perfil del usuario.

Paso 4.2 - Billetera Multimarca (Interfaz de Usuario):

La app detecta de qué tienda provienen los puntos escaneados y cambia el tema visual (Tailwind) a los colores de esa tienda.

Mostrar saldo actual y lista de recompensas disponibles del negocio.

Paso 4.3 - Lógica de Canje (OTP):

Botón de "Canjear". Si hay puntos suficientes, se restan del saldo.

Generar un código visual (One-Time Password) en pantalla que el usuario muestra en caja.

Hito de la Fase 4: Un usuario real puede escanear el QR de la máquina, ver sus puntos en el teléfono y pedir un premio.

Fase 5: Integración Final y Despliegue (End-to-End)

Objetivo: Conectar todo el flujo, asegurar la infraestructura y lanzar a producción.

Paso 5.1 - Pruebas E2E (End-to-End):

Simular el recorrido completo: El usuario juega, gana, escanea, canjea, y el negocio lo valida en su panel.

Paso 5.2 - Refinamiento de Seguridad:

Validar que un QR no pueda ser escaneado dos veces (Rate limiting / Blacklist de tokens).

Paso 5.3 - Despliegue (Hosting):

Subir el Backend y la DB a producción.

Desplegar el Frontend (Admin y PWA) en servicios como Vercel o Netlify.

Exportar la build final de Unity para la computadora o placa (ej. Raspberry Pi o Mini PC) que se usará en los muebles Arcade.