import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'api.dart';
import 'screens/claim.dart';
import 'screens/home.dart';
import 'screens/prizes.dart';
import 'screens/scan.dart';
import 'strings.dart';
import 'theme.dart';

/// En la versión web, el QR de la máquina abre `<wallet>/c#<token>`: se acredita al entrar.
String? _tokenFromUrl() {
  if (!kIsWeb) return null;
  final u = Uri.base;
  if (!u.path.endsWith('/c') && u.fragment.isEmpty) return null;
  return tokenFromScan(u.fragment);
}

void main() => runApp(KairosWallet(initialToken: _tokenFromUrl()));

class KairosWallet extends StatelessWidget {
  const KairosWallet({super.key, this.initialToken});
  final String? initialToken;
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Kairos Wallet',
        debugShowCheckedModeBanner: false,
        theme: buildTheme(Brightness.light),
        darkTheme: buildTheme(Brightness.dark),
        // La ruta inicial de la web trae el token tras el #: se ignora, la app decide qué mostrar.
        onGenerateInitialRoutes: (_) => [MaterialPageRoute(builder: (_) => Shell(initialToken: initialToken))],
        onGenerateRoute: (_) => MaterialPageRoute(builder: (_) => const Shell()),
      );
}

class Shell extends StatefulWidget {
  const Shell({super.key, this.initialToken});
  final String? initialToken;
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int _tab = 0;
  int _refresh = 0;

  @override
  void initState() {
    super.initState();
    final t = widget.initialToken;
    if (t != null) WidgetsBinding.instance.addPostFrameCallback((_) => _claim(t));
  }

  Future<void> _claim(String token) async {
    setState(() => _tab = 0);
    await Navigator.push(context, MaterialPageRoute(builder: (_) => ClaimScreen(token: token)));
    if (mounted) setState(() => _refresh++);
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      HomeScreen(refresh: _refresh, onScan: () => setState(() => _tab = 1), onPrizes: () => setState(() => _tab = 2)),
      // Se crea solo con la pestaña abierta: así la cámara no se queda encendida.
      _tab == 1 ? ScanScreen(onToken: _claim) : const SizedBox.shrink(),
      PrizesScreen(refresh: _refresh),
    ];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: _NavBar(index: _tab, onTap: (i) => setState(() => _tab = i)),
    );
  }
}

/// Barra inferior con el botón de escanear destacado al centro.
class _NavBar extends StatelessWidget {
  const _NavBar({required this.index, required this.onTap});
  final int index;
  final ValueChanged<int> onTap;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    Widget item(int i, IconData icon, IconData active, String label) {
      final on = index == i;
      return Expanded(
        child: InkWell(
          onTap: () => onTap(i),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(on ? active : icon, color: on ? K.primary : cs.onSurface.withValues(alpha: 0.6)),
              const SizedBox(height: 3),
              Text(label, style: body(12, color: on ? K.primary : cs.onSurface.withValues(alpha: 0.6), weight: FontWeight.w800)),
            ]),
          ),
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(color: cs.surface, border: Border(top: BorderSide(color: cs.outline, width: 1.5))),
      child: SafeArea(
        top: false,
        child: SizedBox(height: 66, child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          item(0, Icons.account_balance_wallet_outlined, Icons.account_balance_wallet, S.navHome),
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -14),
              child: Center(
                child: GestureDetector(
                  onTap: () => onTap(1),
                  child: Container(
                    width: 62,
                    height: 62,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: K.primary,
                      border: Border.all(color: cs.surface, width: 4),
                      boxShadow: [BoxShadow(color: K.primary.withValues(alpha: 0.45), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: const Icon(Icons.qr_code_scanner_rounded, color: Colors.white, size: 30),
                  ),
                ),
              ),
            ),
          ),
          item(2, Icons.card_giftcard_outlined, Icons.card_giftcard, S.navPrizes),
        ])),
      ),
    );
  }
}
