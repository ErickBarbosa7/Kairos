import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../api.dart';
import '../strings.dart';
import '../theme.dart';
import 'home.dart';

/// Escáner de la app. Al leer un QR de Kairos devuelve su token.
class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key, required this.onToken});
  final void Function(String token) onToken;
  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final _controller = MobileScannerController(formats: const [BarcodeFormat.qrCode]);
  String _message = S.scanHint;
  bool _handled = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final code in capture.barcodes) {
      final raw = code.rawValue;
      if (raw == null) continue;
      final token = tokenFromScan(raw);
      if (token != null) {
        _handled = true;
        widget.onToken(token);
        return;
      }
      setState(() => _message = S.scanUnknown);
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 18, 22, 18),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const PageHeader(S.scanTitle, S.scanItalic),
            const SizedBox(height: 18),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Stack(fit: StackFit.expand, children: [
                  MobileScanner(
                    controller: _controller,
                    onDetect: _onDetect,
                    errorBuilder: (_, _) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(S.scanDenied, textAlign: TextAlign.center, style: body(15)))),
                  ),
                  const IgnorePointer(child: _Viewfinder()),
                ]),
              ),
            ),
            const SizedBox(height: 14),
            Text(_message, style: body(15, weight: FontWeight.w700)),
          ]),
        ),
      );
}

/// Marco con esquinas para apuntar al QR.
class _Viewfinder extends StatelessWidget {
  const _Viewfinder();
  @override
  Widget build(BuildContext context) => CustomPaint(painter: _CornersPainter());
}

class _CornersPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final side = size.shortestSide * 0.62;
    final r = Rect.fromCenter(center: size.center(Offset.zero), width: side, height: side);
    final p = Paint()
      ..color = K.reward
      ..style = PaintingStyle.stroke
      ..strokeWidth = 5
      ..strokeCap = StrokeCap.round;
    const l = 34.0;
    for (final (x, y, dx, dy) in [(r.left, r.top, 1.0, 1.0), (r.right, r.top, -1.0, 1.0), (r.left, r.bottom, 1.0, -1.0), (r.right, r.bottom, -1.0, -1.0)]) {
      canvas.drawLine(Offset(x, y), Offset(x + dx * l, y), p);
      canvas.drawLine(Offset(x, y), Offset(x, y + dy * l), p);
    }
  }

  @override
  bool shouldRepaint(_) => false;
}
