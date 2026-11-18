import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home.dart';

class PrizesScreen extends StatelessWidget {
  const PrizesScreen({super.key, required this.refresh});
  final int refresh;
  @override
  Widget build(BuildContext context) => SafeArea(
        child: Loader<List<Coupon>>(
          key: ValueKey(refresh),
          load: Api.instance.coupons,
          builder: (context, all, reload) {
            final pending = all.where((c) => c.status == 'PENDING').toList();
            final ready = pending.where((c) => !c.locked).toList();
            final locked = pending.where((c) => c.locked).toList();
            final history = all.where((c) => c.status != 'PENDING').toList();
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.fromLTRB(22, 18, 22, 32), children: [
                const PageHeader(S.prizesTitle, S.prizesItalic, kicker: S.prizesKicker),
                const SizedBox(height: 22),
                if (all.isEmpty) Text(S.prizesEmpty, style: body(16)),
                _Group(S.ready, ready),
                _Group(S.locked, locked),
                _Group(S.history, history),
              ]),
            );
          },
        ),
      );
}

class _Group extends StatelessWidget {
  const _Group(this.title, this.items);
  final String title;
  final List<Coupon> items;
  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(padding: const EdgeInsets.only(top: 6, bottom: 12), child: Text(title, style: accent(28, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.75)))),
      for (final c in items) ...[_CouponCard(c: c), const SizedBox(height: 16)],
    ]);
  }
}

class _CouponCard extends StatelessWidget {
  const _CouponCard({required this.c});
  final Coupon c;
  @override
  Widget build(BuildContext context) {
    final active = c.status == 'PENDING';
    final color = parseHex(c.tenant.primaryColor);
    final cs = Theme.of(context).colorScheme;
    return TicketCard(
      dim: !active || c.locked,
      accentColor: active ? color : null,
      top: Row(children: [
        BrandAvatar(name: c.tenant.name, url: c.tenant.logoUrl, color: color, size: 42),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(c.title, style: display(24)),
          Text(c.tenant.name, style: body(13, color: cs.onSurface.withValues(alpha: 0.7))),
        ])),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          decoration: BoxDecoration(border: Border.all(color: cs.outline, width: 1.5), borderRadius: BorderRadius.circular(99)),
          child: Text(S.status[c.status] ?? c.status, style: body(11, weight: FontWeight.w800)),
        ),
      ]),
      bottom: active
          ? Column(children: [
              CodeText(c.code, dim: c.locked),
              const SizedBox(height: 10),
              Text(c.locked ? S.availableAt(when(c.validFrom)) : S.expires(day(c.expiresAt)), style: body(13, weight: FontWeight.w700)),
            ])
          : Text(S.expires(day(c.expiresAt)), textAlign: TextAlign.center, style: body(13)),
    );
  }
}
