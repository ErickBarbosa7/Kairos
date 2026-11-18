import 'package:flutter/material.dart';

import '../api.dart';
import '../format.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';

class RewardsScreen extends StatefulWidget {
  const RewardsScreen({super.key, required this.balance});
  final Balance balance;
  @override
  State<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends State<RewardsScreen> {
  late int _points = widget.balance.balance;
  String? _confirming;
  bool _busy = false;
  String? _problem;
  ({String code, String title, DateTime validFrom})? _done;
  int _reload = 0;

  Future<void> _redeem(Reward r) async {
    setState(() {
      _busy = true;
      _problem = null;
    });
    try {
      final res = await Api.instance.redeem(r.id);
      setState(() {
        _points -= r.pointsCost;
        _done = (code: res.code, title: r.title, validFrom: res.validFrom);
        _confirming = null;
        _reload++;
      });
    } on ApiException catch (e) {
      setState(() {
        _problem = (S.errors[e.code] ?? (e.message, '')).$1;
        _confirming = null;
      });
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = parseHex(widget.balance.tenant.primaryColor);
    final on = onColor(color);
    final cs = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, scrolledUnderElevation: 0),
      body: Loader<List<Reward>>(
        key: ValueKey(_reload),
        load: () => Api.instance.rewards(widget.balance.tenant.id),
        builder: (context, rewards, _) => ListView(padding: const EdgeInsets.fromLTRB(22, 0, 22, 32), children: [
          Row(children: [
            BrandAvatar(name: widget.balance.tenant.name, url: widget.balance.tenant.logoUrl, color: color, size: 40),
            const SizedBox(width: 10),
            Expanded(child: Text(widget.balance.tenant.name, style: display(20, color: cs.onSurface.withValues(alpha: 0.65)))),
          ]),
          const SizedBox(height: 14),
          const Heading(S.rewardsTitle, S.rewardsItalic),
          const SizedBox(height: 6),
          Text.rich(TextSpan(children: [
            TextSpan(text: S.youHavePrefix, style: body(16, weight: FontWeight.w500)),
            TextSpan(text: '$_points ${S.points}', style: display(24, color: color)),
          ])),
          const SizedBox(height: 20),
          if (_done != null) ...[
            TicketCard(
              accentColor: K.successDark,
              top: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(S.redeemed, style: accent(34, color: K.success)),
                Text(_done!.title, style: display(28)),
              ]),
              bottom: Column(children: [
                CodeText(_done!.code),
                const SizedBox(height: 10),
                Text(_done!.validFrom.isAfter(DateTime.now()) ? S.unlocksAt(when(_done!.validFrom)) : S.redeemedBody, textAlign: TextAlign.center, style: body(14)),
              ]),
            ),
            const SizedBox(height: 18),
          ],
          if (_problem != null) ...[Text(_problem!, style: body(15, color: K.primary, weight: FontWeight.w800)), const SizedBox(height: 12)],
          if (rewards.isEmpty) Text(S.rewardsEmpty, style: body(16)),
          for (final r in rewards) ...[
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    if (r.imageUrl != null) ...[
                      ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(r.imageUrl!, width: 60, height: 60, fit: BoxFit.cover, errorBuilder: (_, _, _) => const SizedBox.shrink())),
                      const SizedBox(width: 14),
                    ],
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.title, style: display(26)),
                      if (r.description != null) Text(r.description!, style: body(13, weight: FontWeight.w500)),
                    ])),
                    const SizedBox(width: 10),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text('${r.pointsCost}', style: display(34, color: color, height: 0.9)),
                      Text(S.points, style: accent(18)),
                    ]),
                  ]),
                  const SizedBox(height: 16),
                  if (_points < r.pointsCost)
                    Progress(value: _points, max: r.pointsCost, label: S.missingShort(r.pointsCost - _points), color: color)
                  else if (_confirming == r.id) ...[
                    Text(S.confirm(r.pointsCost), style: body(14)),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(child: FilledButton(style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: on), onPressed: _busy ? null : () => _redeem(r), child: const Text(S.confirmYes))),
                      const SizedBox(width: 10),
                      OutlinedButton(style: OutlinedButton.styleFrom(minimumSize: const Size(100, 52)), onPressed: () => setState(() => _confirming = null), child: const Text(S.cancel)),
                    ]),
                  ] else
                    FilledButton(style: FilledButton.styleFrom(backgroundColor: color, foregroundColor: on), onPressed: () => setState(() => _confirming = r.id), child: const Text(S.redeem)),
                ]),
              ),
            ),
            const SizedBox(height: 14),
          ],
        ]),
      ),
    );
  }
}
