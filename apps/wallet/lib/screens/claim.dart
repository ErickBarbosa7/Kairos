import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';

/// Acredita un QR y celebra el resultado. Muestra el avance hacia el siguiente premio: es lo que invita a volver.
class ClaimScreen extends StatefulWidget {
  const ClaimScreen({super.key, required this.token});
  final String token;
  @override
  State<ClaimScreen> createState() => _ClaimScreenState();
}

class _ClaimScreenState extends State<ClaimScreen> {
  late final Future<(ClaimResult, List<Balance>)> _future = _run();

  Future<(ClaimResult, List<Balance>)> _run() async {
    final result = await Api.instance.claim(widget.token);
    var all = <Balance>[];
    try {
      all = await Api.instance.balances();
    } catch (_) {
      // El avance es un extra: si falla, el resultado se muestra igual.
    }
    return (result, all);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: FutureBuilder(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(S.claimWorking, style: accent(28)),
                ]));
              }
              if (snap.hasError) return _Failure(error: snap.error!);
              final (result, all) = snap.data!;
              return _Success(result: result, balance: all.where((b) => b.tenant.id == result.tenantId).firstOrNull, all: all);
            },
          ),
        ),
      );
}

class _Failure extends StatelessWidget {
  const _Failure({required this.error});
  final Object error;
  @override
  Widget build(BuildContext context) {
    final code = error is ApiException ? (error as ApiException).code : '';
    final (title, body_) = S.errors[code] ?? S.genericError;
    return Padding(
      padding: const EdgeInsets.all(26),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.hourglass_empty_rounded, size: 56, color: K.warning),
        const SizedBox(height: 14),
        Text(title, style: display(44)),
        const SizedBox(height: 8),
        Text(body_, style: body(17, weight: FontWeight.w500)),
        const SizedBox(height: 28),
        FilledButton(onPressed: () => Navigator.pop(context), child: const Text(S.seeAll)),
      ]),
    );
  }
}

class _Success extends StatelessWidget {
  const _Success({required this.result, required this.balance, required this.all});
  final ClaimResult result;
  final Balance? balance;
  final List<Balance> all;
  @override
  Widget build(BuildContext context) {
    final color = parseHex(balance?.tenant.primaryColor ?? '#B91C1C');
    final on = onColor(color);
    final next = balance?.next;
    final won = result.rewardTitle != null && result.couponCode != null;
    final locked = result.validFrom?.isAfter(DateTime.now()) ?? false;
    return Stack(children: [
      ListView(padding: const EdgeInsets.fromLTRB(22, 22, 22, 32), children: [
        _Pop(
          child: BrandCard(
            color: color,
            padding: const EdgeInsets.fromLTRB(22, 26, 22, 26),
            child: Column(children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(color: on.withValues(alpha: 0.16), borderRadius: BorderRadius.circular(99)),
                child: Text(result.tenantName, style: display(16, color: on)),
              ),
              const SizedBox(height: 12),
              if (result.points > 0) ...[
                CountUp(value: result.points, prefix: '+', style: display(120, color: on, height: 0.85)),
                const SizedBox(height: 16),
                Text(S.pointsWon, style: accent(36, color: on)),
              ] else
                Text(S.visitCounted, style: accent(40, color: on)),
              const SizedBox(height: 14),
              Text(S.balanceAt(result.balance, result.tenantName), style: body(15, color: on.withValues(alpha: 0.92))),
            ]),
          ),
        ),
        if (won) ...[
          const SizedBox(height: 20),
          _Pop(
            delay: 300,
            child: TicketCard(
              accentColor: K.reward,
              top: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(S.youWonItalic, style: accent(34, color: K.warning)),
                const SizedBox(height: 2),
                Text(result.rewardTitle!, style: display(40, height: 0.95)),
              ]),
              bottom: Column(children: [
                Text(S.yourCode, style: body(13, weight: FontWeight.w800)),
                const SizedBox(height: 6),
                CodeText(result.couponCode!),
                const SizedBox(height: 12),
                Text(locked ? S.unlocksAt(when(result.validFrom!)) : S.showCode, textAlign: TextAlign.center, style: body(14, weight: FontWeight.w800)),
                if (result.expiresAt != null) Text(S.validUntil(day(result.expiresAt!)), style: body(13, weight: FontWeight.w500)),
              ]),
            ),
          ),
        ],
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: next != null
                ? Progress(value: balance!.balance, max: next.pointsCost, label: S.missing(next.missing, next.title), color: color)
                : Text(S.reachedAll, style: body(15, color: K.success, weight: FontWeight.w800)),
          ),
        ),
        if (all.length > 1) ...[
          const SizedBox(height: 20),
          PointsList(balances: all, title: S.myPointsOthers, highlightTenantId: result.tenantId),
        ],
        const SizedBox(height: 14),
        Text(S.keepSafe, style: body(13, weight: FontWeight.w500)),
        const SizedBox(height: 18),
        FilledButton(onPressed: () => Navigator.pop(context), child: const Text(S.seeAll)),
      ]),
      if (result.points > 0 || won) const Positioned.fill(child: Confetti()),
    ]);
  }
}

/// Entrada con rebote suave.
class _Pop extends StatelessWidget {
  const _Pop({required this.child, this.delay = 0});
  final Widget child;
  final int delay;
  @override
  Widget build(BuildContext context) => TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: Duration(milliseconds: 600 + delay),
        curve: Interval(delay / (600 + delay), 1, curve: Curves.easeOutBack),
        builder: (_, v, c) => Opacity(opacity: v.clamp(0.0, 1.0), child: Transform.translate(offset: Offset(0, 24 * (1 - v)), child: Transform.scale(scale: 0.94 + 0.06 * v, child: c))),
        child: child,
      );
}
