/// Todos los textos de la Wallet, en un solo lugar.
class S {
  static const appName = 'Kairos';
  static const navHome = 'Inicio';
  static const navScan = 'Escanear';
  static const navPrizes = 'Mis premios';
  static const retry = 'Reintentar';
  static const back = 'Volver';

  static const homeTitle = 'Tus';
  static const homeTitleItalic = 'puntos';
  static const homeKicker = 'Cada partida te acerca a tu próximo premio.';
  static const homeEmptyItalic = 'te espera';
  static const rewardsItalic = 'para ti';
  static const prizesItalic = 'premios';
  static const prizesKicker = 'Tus vales para recoger en caja.';
  static const youHavePrefix = 'Tienes ';
  static const homeEmptyTitle = 'Tu primera partida';
  static const homeEmptyBody =
      'Juega en una máquina Kairos y escanea el código QR de tu resultado. No necesitas crear cuenta.';
  static const homeSteps = ['Juega en la máquina', 'Escanea tu código', 'Canjea tus premios'];
  static const scanCta = 'Escanear un código';
  static const points = 'puntos';
  static String missing(int n, String reward) => 'Te faltan $n pts para $reward';
  static const allReached = '¡Ya alcanzas todos los premios!';
  static String canRedeem(int n) => n == 1 ? 'Puedes canjear 1 premio' : 'Puedes canjear $n premios';
  static String readyCoupons(int n) => n == 1 ? '1 premio listo para recoger' : '$n premios listos para recoger';
  static const seeRewards = 'Ver premios';

  static const claimWorking = 'Sumando tus puntos…';
  static const pointsWon = 'puntos sumados';
  static const visitCounted = 'visita registrada';
  static const youWon = '¡Ganaste un premio!';
  static const youWonItalic = '¡Ganaste un premio!';
  static const yourCode = 'Tu código';
  static const showCode = 'Muéstralo en caja para recogerlo.';
  static String unlocksAt(String w) => 'Se desbloquea $w, vuelve a recogerlo';
  static String validUntil(String w) => 'Válido hasta $w';
  static String balanceAt(int n, String name) => 'Ahora tienes $n pts en $name';
  static const reachedAll = '¡Ya puedes canjear premios con tus puntos!';
  static const seeAll = 'Ver mis puntos';
  static const keepSafe = 'Tus puntos se guardan en este teléfono.';

  static const saveTitle = 'Guarda tus puntos';
  static const saveBody = 'Crea una cuenta para recuperarlos si cambias de teléfono. Es opcional.';
  static const saveCta = 'Crear cuenta o entrar';
  static const accountTitle = 'Tu';
  static const accountItalic = 'cuenta';
  static const tabRegister = 'Crear cuenta';
  static const tabLogin = 'Entrar';
  static const fieldEmail = 'Correo';
  static const fieldPassword = 'Contraseña (mínimo 8)';
  static const fieldName = 'Nombre (opcional)';
  static const doRegister = 'Crear cuenta';
  static const doLogin = 'Entrar';
  static const registerHint = 'Tus puntos y premios actuales se quedan contigo.';
  static const loginHint = 'Si tienes puntos como invitado, se suman a tu cuenta.';
  static const continueGuest = 'Seguir sin cuenta';
  static const signedInAs = 'Sesión iniciada como';
  static const logout = 'Cerrar sesión';
  static const logoutConfirm = 'Tus puntos quedan guardados en tu cuenta. Vuelve a entrar cuando quieras.';
  static const invalidEmail = 'Escribe un correo válido.';
  static const shortPassword = 'La contraseña debe tener al menos 8 caracteres.';
  static const accountErrors = {
    'email_taken': 'Ese correo ya tiene una cuenta. Prueba en «Entrar».',
    'invalid_credentials': 'Correo o contraseña incorrectos.',
    'already_registered': 'Ya tienes una cuenta.',
    'offline': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
  };

  static const rewardsTitle = 'Premios';
  static String cost(int n) => '$n pts';
  static const redeem = 'Canjear';
  static String confirm(int n) => 'Se descontarán $n pts de tu saldo.';
  static const confirmYes = 'Sí, canjear';
  static const cancel = 'Cancelar';
  static String missingShort(int n) => 'Te faltan $n pts';
  static const rewardsEmpty = 'Este negocio aún no tiene premios para canjear.';
  static const redeemed = '¡Canjeado!';
  static const redeemedBody = 'Muestra este código en caja.';
  static String youHave(int n) => 'Tienes $n pts';

  static const prizesTitle = 'Mis';
  static const prizesEmpty = 'Todavía no tienes premios. Alcanza la meta en un juego o canjea tus puntos.';
  static const ready = 'Listos para recoger';
  static const locked = 'Próximamente';
  static const history = 'Historial';
  static String availableAt(String w) => 'Disponible $w';
  static String expires(String w) => 'Vence $w';
  static const status = {'PENDING': 'Pendiente', 'REDEEMED': 'Canjeado', 'EXPIRED': 'Vencido', 'CANCELLED': 'Cancelado'};

  static const scanTitle = 'Escanear';
  static const scanItalic = 'código';
  static const scanHint = 'Apunta al QR de la pantalla de la máquina.';
  static const scanDenied = 'No pudimos usar la cámara. Revisa el permiso en los ajustes del teléfono.';
  static const scanUnknown = 'Ese código no es de Kairos.';

  static const errors = {
    'qr_expired': ('El código venció', 'Los códigos duran 60 segundos. Juega otra vez para ganar uno nuevo.'),
    'conflict': ('Código ya usado', 'Este código ya se canjeó. Cada código sirve una sola vez.'),
    'daily_limit': ('Llegaste al límite de hoy', 'Ya sumaste todas las partidas de hoy en este negocio. ¡Vuelve mañana!'),
    'score_too_low': ('Puntaje muy bajo', 'Esta partida no alcanzó para sumar puntos. ¡Inténtalo otra vez!'),
    'machine_inactive': ('Máquina no disponible', 'Esta máquina está fuera de servicio. Avisa al personal.'),
    'subscription_expired': ('Negocio no disponible', 'Este negocio no puede acreditar puntos por ahora.'),
    'reward_sold_out': ('Premio agotado', 'Ese premio se acabó. Pide otro código.'),
    'qr_invalid': ('Código no válido', 'No pudimos leer este código. Escanea el de la pantalla de la máquina.'),
    'insufficient_points': ('Puntos insuficientes', 'Todavía no te alcanzan los puntos para este premio.'),
    'offline': ('Sin conexión', 'Revisa tu internet e inténtalo de nuevo.'),
  };
  static const genericError = ('Algo salió mal', 'Inténtalo de nuevo en un momento.');
}
