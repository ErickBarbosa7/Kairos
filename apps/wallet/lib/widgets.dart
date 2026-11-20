import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'models.dart';
import 'strings.dart';
import 'theme.dart';

/// Estado de una carga: cargando, error con reintento, o datos.
class Loader<T> extends StatefulWidget {
  const Loader({super.key, required this.load, required this.builder});
  final Future<T> Function() load;
  final Widget Function(BuildContext, T, Future<void> Function() reload) builder;
  @override
  State<Loader<T>> createState() => _LoaderState<T>();
}

class _LoaderState<T> extends State<Loader<T>> {
  late Future<T> _future = widget.load();
  Future<void> _reload() async {
    final f = widget.load();
    setState(() => _future = f);
    await f.then((_) {}, onError: (_) {});
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) return const Center(child: CircularProgressIndicator(strokeWidth: 3));
          if (snap.hasError) return ErrorView(error: snap.error!, onRetry: _reload);
          return widget.builder(context, snap.data as T, _reload);
        },
      );
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, required this.error, this.onRetry});
  final Object error;
  final VoidCallback? onRetry;
  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.wifi_off_rounded, size: 52, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 14),
            Text(error.toString(), textAlign: TextAlign.center, style: body(16)),
            if (onRetry != null) ...[
              const SizedBox(height: 18),
              OutlinedButton(onPressed: onRetry, child: const Text(S.retry)),
            ],
          ]),
        ),
      );
}

/// Título en dos voces: una palabra en cursiva serif (una por título, como pide el diseño).
class Heading extends StatelessWidget {
  const Heading(this.plain, this.italic, {super.key, this.size = 44});
  final String plain, italic;
  final double size;
  @override
  Widget build(BuildContext context) => Text.rich(
        TextSpan(children: [
          TextSpan(text: '$plain ', style: display(size)),
          TextSpan(text: italic, style: accent(size * 1.12, color: K.primary)),
        ]),
        style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
      );
}

/// Barra de avance: relleno animado y porcentaje. El texto siempre acompaña al color.
class Progress extends StatelessWidget {
  const Progress({super.key, required this.value, required this.max, required this.label, required this.color, this.textColor});
  final int value, max;
  final String label;
  final Color color;
  final Color? textColor;
  @override
  Widget build(BuildContext context) {
    final target = max <= 0 ? 0.0 : (value / max).clamp(0.0, 1.0);
    final fg = textColor ?? Theme.of(context).colorScheme.onSurface;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: target),
        duration: const Duration(milliseconds: 1100),
        curve: Curves.easeOutCubic,
        builder: (_, v, _) => Stack(children: [
          Container(height: 8, decoration: BoxDecoration(color: fg.withValues(alpha: 0.28), borderRadius: BorderRadius.circular(99))),
          FractionallySizedBox(
            widthFactor: v.clamp(0.04, 1.0),
            child: Container(
              height: 8,
              decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(99)),
            ),
          ),
        ]),
      ),
      const SizedBox(height: 10),
      Row(children: [
        Expanded(child: Text(label, style: body(14, color: fg, weight: FontWeight.w700))),
        Text('${(target * 100).round()}%', style: display(16, color: fg)),
      ]),
    ]);
  }
}

class BrandAvatar extends StatelessWidget {
  const BrandAvatar({super.key, required this.name, required this.color, this.url, this.size = 46});
  final String name;
  final String? url;
  final Color color;
  final double size;
  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(8)),
      child: Text(name.isEmpty ? '?' : name[0].toUpperCase(), style: display(size * 0.62, color: onColor(color))),
    );
    if (url == null) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(url!, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => fallback),
    );
  }
}

/// Tarjeta del color del negocio: color sólido, radio 20 y borde de 1 px (design.md: sin degradados ni brillos).
class BrandCard extends StatelessWidget {
  const BrandCard({super.key, required this.color, required this.child, this.padding = const EdgeInsets.all(20)});
  final Color color;
  final Widget child;
  final EdgeInsets padding;
  @override
  Widget build(BuildContext context) => Container(
        padding: padding,
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
        child: child,
      );
}

/// Ticket con muescas laterales y línea punteada, como un vale de arcade.
class TicketCard extends StatelessWidget {
  const TicketCard({super.key, required this.top, required this.bottom, this.accentColor, this.dim = false});
  final Widget top, bottom;
  final Color? accentColor;
  final bool dim;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Opacity(
      opacity: dim ? 0.78 : 1,
      child: CustomPaint(
        painter: _TicketPainter(fill: cs.surface, line: accentColor ?? cs.outline, bg: Theme.of(context).scaffoldBackgroundColor),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(padding: const EdgeInsets.fromLTRB(20, 20, 20, 22), child: top),
          Padding(padding: const EdgeInsets.fromLTRB(20, 24, 20, 20), child: bottom),
        ]),
      ),
    );
  }
}

class _TicketPainter extends CustomPainter {
  _TicketPainter({required this.fill, required this.line, required this.bg});
  final Color fill, line, bg;
  // La muesca queda en la unión entre las dos mitades; se calcula con una altura estimada de la parte superior.
  @override
  void paint(Canvas canvas, Size size) {
    const r = 12.0, notch = 10.0;
    final y = size.height * 0.46;
    final path = Path()
      ..moveTo(r, 0)
      ..lineTo(size.width - r, 0)
      ..arcToPoint(Offset(size.width, r), radius: const Radius.circular(r))
      ..lineTo(size.width, y - notch)
      ..arcToPoint(Offset(size.width, y + notch), radius: const Radius.circular(notch), clockwise: false)
      ..lineTo(size.width, size.height - r)
      ..arcToPoint(Offset(size.width - r, size.height), radius: const Radius.circular(r))
      ..lineTo(r, size.height)
      ..arcToPoint(Offset(0, size.height - r), radius: const Radius.circular(r))
      ..lineTo(0, y + notch)
      ..arcToPoint(Offset(0, y - notch), radius: const Radius.circular(notch), clockwise: false)
      ..lineTo(0, r)
      ..arcToPoint(Offset(r, 0), radius: const Radius.circular(r))
      ..close();
        canvas.drawPath(path, Paint()..color = fill);
    canvas.drawPath(path, Paint()..style = PaintingStyle.stroke..strokeWidth = 1.5..color = line);
    final dash = Paint()..color = line.withValues(alpha: 0.7)..strokeWidth = 1.5;
    for (var x = notch + 6; x < size.width - notch - 6; x += 10) {
      canvas.drawLine(Offset(x, y), Offset(x + 5, y), dash);
    }
  }

  @override
  bool shouldRepaint(_TicketPainter old) => old.fill != fill || old.line != line;
}

/// Código de canje, en mono grande.
class CodeText extends StatelessWidget {
  const CodeText(this.code, {super.key, this.dim = false});
  final String code;
  final bool dim;
  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).colorScheme.onSurface;
    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Text(code.length == 6 ? '${code.substring(0, 3)} ${code.substring(3)}' : code, style: mono(44, color: dim ? c.withValues(alpha: 0.4) : c)),
    );
  }
}

/// Cifra que sube de 0 al valor.
class CountUp extends StatelessWidget {
  const CountUp({super.key, required this.value, required this.style, this.prefix = ''});
  final int value;
  final TextStyle style;
  final String prefix;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: value.toDouble()),
        duration: const Duration(milliseconds: 1000),
        curve: Curves.easeOutCubic,
        builder: (_, v, _) => Text('$prefix${v.round()}', style: style),
      );
}

/// Chispas de color que caen una vez: celebración al ganar.
class Confetti extends StatefulWidget {
  const Confetti({super.key});
  @override
  State<Confetti> createState() => _ConfettiState();
}

class _ConfettiState extends State<Confetti> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 2600))..forward();
  final _rng = math.Random(7);
  late final _bits = List.generate(70, (_) => (x: _rng.nextDouble(), v: 0.5 + _rng.nextDouble(), s: 5 + _rng.nextDouble() * 6, r: _rng.nextDouble() * 6, k: _rng.nextInt(4)));
  static const _colors = [K.reward, K.primary, Color(0xFFF97316), Color(0xFFFFFFFF)];

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: AnimatedBuilder(
          animation: _c,
          builder: (_, _) => CustomPaint(size: Size.infinite, painter: _ConfettiPainter(_bits, _c.value, _colors)),
        ),
      );
}

class _ConfettiPainter extends CustomPainter {
  _ConfettiPainter(this.bits, this.t, this.colors);
  final List<({double x, double v, double s, double r, int k})> bits;
  final double t;
  final List<Color> colors;
  @override
  void paint(Canvas canvas, Size size) {
    for (final b in bits) {
      final y = -20 + (size.height * 0.9) * (t * b.v);
      final x = b.x * size.width + math.sin(t * 8 + b.r) * 18;
      canvas.save();
      canvas.translate(x, y);
      canvas.rotate(b.r + t * 9 * b.v);
      canvas.drawRect(Rect.fromCenter(center: Offset.zero, width: b.s, height: b.s * 1.6), Paint()..color = colors[b.k].withValues(alpha: (1 - t).clamp(0, 1)));
      canvas.restore();
    }
  }

  @override
  bool shouldRepaint(_ConfettiPainter old) => old.t != t;
}


/// Marca Kairos discreta: solo el nombre en cursiva serif.
class KairosSeal extends StatelessWidget {
  const KairosSeal({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
        label: S.sealLabel,
        child: Text(S.appName, style: accent(24, color: Theme.of(context).colorScheme.onSurface)),
      );
}


/// Puntos de cada negocio donde el cliente ha jugado. `highlightTenantId` marca el negocio actual.
class PointsList extends StatelessWidget {
  const PointsList({super.key, required this.balances, required this.title, this.highlightTenantId, this.onTap});
  final List<Balance> balances;
  final String title;
  final String? highlightTenantId;
  final void Function(Balance)? onTap;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final soft = cs.onSurface.withValues(alpha: 0.65);
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: body(13, color: soft, weight: FontWeight.w800)),
          const SizedBox(height: 6),
          for (final b in balances)
            InkWell(
              onTap: onTap == null ? null : () => onTap!(b),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 9),
                child: Row(children: [
                  BrandAvatar(name: b.tenant.name, url: b.tenant.logoUrl, color: parseHex(b.tenant.primaryColor), size: 36),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(b.tenant.name, overflow: TextOverflow.ellipsis, style: body(15, weight: b.tenant.id == highlightTenantId ? FontWeight.w800 : FontWeight.w600)),
                  ),
                  if (b.tenant.id == highlightTenantId)
                    Padding(padding: const EdgeInsets.only(right: 8), child: Text(S.youAreHere, style: body(12, color: soft))),
                  Text('${b.balance}', style: display(24)),
                  const SizedBox(width: 4),
                  Text(S.points, style: body(12, color: soft)),
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}
