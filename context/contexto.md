Documento de Contexto: Plataforma SaaS de Fidelización Gamificada

1. Resumen Ejecutivo

Un ecosistema de Software as a Service (SaaS) B2B2C diseñado para revolucionar la fidelización de clientes en negocios locales (cafeterías, fast-food, snacks). Sustituye las tradicionales y aburridas tarjetas de lealtad de cartón por una Terminal de Videojuegos Arcade en el mostrador físico. El sistema conecta la experiencia lúdica presencial con una billetera digital (WebApp) para el consumidor, gestionada de forma autónoma por cada empresa desde un panel administrativo en la nube, todo orquestado por una administración central (Super Admin).

2. El Problema

Para los negocios: Los programas de lealtad tradicionales (tarjetas de sellos) tienen baja tasa de adopción, son fáciles de perder, propensos al fraude y no generan una conexión emocional ni datos analíticos del cliente.

Para los consumidores: Descargar una aplicación nativa por cada tienda local que visitan es un punto de fricción insostenible.

3. La Solución (Modelo B2B2C)

Un ecosistema unificado de tres capas:

El Anzuelo (Terminal Arcade): Un juego rápido (1 min) en el local que atrae al cliente. Se adapta visualmente (colores/logos) a la tienda en la que está ubicado.

La Retención (Wallet PWA): Una aplicación web progresiva (sin descargas) donde el cliente escanea un QR generado por la máquina al perder, guardando sus puntos para canjearlos por premios.

El Control (Dashboard Multi-tenant): Un panel para que los dueños de los negocios gestionen sus premios, y un panel maestro para el creador del software (Super Admin) para gestionar las suscripciones de los negocios.

4. Tipos de Usuarios (Actores del Sistema)

A. Super Admin (Propietario del SaaS)

Rol: Administrador global de la plataforma.

Alcance: Tiene acceso a la base de datos completa. Da de alta nuevos negocios (Tenants), bloquea accesos por falta de pago, y visualiza la analítica global del crecimiento del software.

B. Tenant (Empresa / Dueño del Local - Cliente B2B)

Rol: Cliente que paga la suscripción del SaaS.

Alcance: Solo tiene acceso a los datos de su propia tienda. Configura su catálogo de premios (ej. "Café gratis - 500pts"), sube su logo, define sus colores corporativos y valida los cupones que sus clientes presentan en caja.

C. Consumidor Final (Cliente B2C)

Rol: El jugador y usuario de la Wallet.

Alcance: Juega en el local físico, escanea QRs y acumula puntos. Su interfaz se adapta gráficamente dependiendo del local que acaba de escanear. Solicita el canje de puntos por códigos temporales (OTP).

5. Arquitectura Lógica de Componentes

API Central & DB (Backend): El motor que procesa toda la lógica, validaciones de seguridad y almacena los datos de forma aislada por tenant_id.

Terminal Arcade "Camaleón" (Unity): Cliente físico. Consume datos de la API al iniciar para vestirse con la marca del local (store_id).

App Consumidor (Frontend PWA): Lector de QR, visualizador de saldo, catálogo dinámico de premios y generador de cupones de un solo uso.

App Admin (Frontend Dashboard): Interfaces separadas por roles (Super Admin vs Tenant) para la gestión operativa y analítica.

6. Flujo Core de Usuario (Customer Journey)

El cliente entra a "Cafetería X" y ve la máquina Arcade.

Juega una partida rápida. Al perder, la pantalla muestra su puntaje, empaquetado en un QR efímero y cifrado.

El cliente saca su teléfono, abre la WebApp (Wallet) y escanea el QR de la pantalla.

El backend valida el QR. La WebApp del cliente cambia a los colores de "Cafetería X" y le suma los puntos ganados.

El cliente ve que tiene puntos suficientes para una galleta. Presiona "Canjear" en su teléfono.

La WebApp genera un código de un solo uso en la pantalla del teléfono.

El empleado de la cafetería ve el código, le entrega la galleta y marca el cupón como "Canjeado" en su propio panel de mostrador.

7. Glosario Técnico Inicial

Tenant / Multitenancy: Arquitectura de software donde una sola instancia de la aplicación sirve a múltiples clientes (empresas).

JWT (JSON Web Token): Tecnología usada para encriptar los puntos dentro del QR que genera la máquina, evitando que un cliente intente inyectar puntos falsos.

OTP (One-Time Password): El código único que se genera al canjear un premio para evitar que el cliente lo cobre dos veces.

PWA (Progressive Web App): Tecnología web que se comporta como app móvil (acceso a cámara, icono en pantalla de inicio) pero se accede mediante una URL sin pasar por App Store/Play Store.