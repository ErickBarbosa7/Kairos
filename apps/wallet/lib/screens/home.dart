import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';
import 'account.dart';
import 'rewards.dart';

/// Cabecera común: marca Kairos arriba y título en dos voces.
class PageHeader extends StatelessWidget {
  const PageHeader(this.plain, this.italic, {super.key, this.kicker});
  final String plain, italic;
  final String? kicker;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const KairosSeal(),
        const SizedBox(height: 18),
        Heading(plain, italic),
        if (kicker != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(kicker!, style: body(15, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7)))),
      ]);
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.onScan, required this.onPrizes, required this.onAccountChanged, required this.refresh});
  final VoidCallback onScan, onPrizes, onAccountChanged;
  /// Cambia cada vez que hay datos nuevos (por ejemplo tras acreditar un QR).
  final int refresh;

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Loader<List<Balance>>(
          key: ValueKey(refresh),
          load: Api.instance.balances,
          builder: (context, list, reload) => RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(22, 18, 22, 32), children: [
              const PageHeader(S.homeTitle, S.homeTitleItalic, kicker: S.homeKicker),
              const SizedBox(height: 22),
              AccountBanner(key: ValueKey(refresh), onChanged: onAccountChanged),
              if (list.isEmpty) _Empty(onScan: onScan),
              for (final b in list) ...[
                _BalanceCard(b: b, onPrizes: onPrizes),
                const SizedBox(height: 18),
              ],
              const SizedBox(height: 8),
              const Center(child: KairosSeal()),
            ]),
          ),
        ),
      );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.onScan});
  final VoidCallback onScan;
  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      BrandCard(
        color: K.primary,
        padding: const EdgeInsets.fromLTRB(24, 26, 24, 26),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Icon(Icons.sports_esports_rounded, color: Colors.white, size: 40),
          const SizedBox(height: 14),
          Text(S.homeEmptyTitle, style: display(34, color: Colors.white)),
          const SizedBox(height: 6),
          Text(S.homeEmptyItalic, style: accent(34, color: K.reward)),
          const SizedBox(height: 12),
          Text(S.homeEmptyBody, style: body(15, color: Colors.white.withValues(alpha: 0.9), weight: FontWeight.w500)),
        ]),
      ),
      const SizedBox(height: 22),
      for (final (i, step) in S.homeSteps.indexed)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: cs.onSurface, width: 1.5)),
              child: Text('${i + 1}', style: accent(24)),
            ),
            const SizedBox(width: 14),
            Text(step, style: body(17, weight: FontWeight.w700)),
          ]),
        ),
      const SizedBox(height: 10),
      FilledButton.icon(onPressed: onScan, icon: const Icon(Icons.qr_code_scanner_rounded), label: const Text(S.scanCta)),
    ]);
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.b, required this.onPrizes});
  final Balance b;
  final VoidCallback onPrizes;
  @override
  Widget build(BuildContext context) {
    final color = parseHex(b.tenant.primaryColor);
    final on = onColor(color);
    final next = b.next;
    return BrandCard(
      color: color,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          BrandAvatar(name: b.tenant.name, url: b.tenant.logoUrl, color: on.withValues(alpha: 0.18)),
          const SizedBox(width: 12),
          Expanded(child: Text(b.tenant.name, style: display(26, color: on))),
          if (b.readyCoupons > 0)
            GestureDetector(
              onTap: onPrizes,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: on, borderRadius: BorderRadius.circular(99)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.card_giftcard_rounded, size: 16, color: color),
                  const SizedBox(width: 4),
                  Text('${b.readyCoupons}', style: display(18, color: color)),
                ]),
              ),
            ),
        ]),
        const SizedBox(height: 22),
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          CountUp(value: b.balance, style: display(92, color: on, height: 0.85)),
          const SizedBox(width: 10),
          Padding(padding: const EdgeInsets.only(bottom: 6), child: Text(S.points, style: accent(30, color: on.withValues(alpha: 0.9)))),
        ]),
        const SizedBox(height: 22),
        if (next != null)
          Progress(value: b.balance, max: next.pointsCost, label: S.missing(next.missing, next.title), color: K.reward, textColor: on)
        else
          Text(S.allReached, style: body(15, color: on, weight: FontWeight.w800)),
        for (final c in b.campaigns) ...[
          const SizedBox(height: 12),
          Text('🔥 $c', style: body(15, color: on, weight: FontWeight.w800)),
        ],
        if (b.affordable > 0) ...[
          const SizedBox(height: 12),
          Text('✨ ${S.canRedeem(b.affordable)}', style: body(15, color: on, weight: FontWeight.w800)),
        ],
        const SizedBox(height: 18),
        FilledButton(
          style: FilledButton.styleFrom(backgroundColor: on, foregroundColor: color),
          onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => RewardsScreen(balance: b))),
          child: const Text(S.seeRewards),
        ),
      ]),
    );
  }
}
