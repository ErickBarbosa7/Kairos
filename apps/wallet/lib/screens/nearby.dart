import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../api.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';
import 'home.dart';

/// «Cerca de ti»: negocios con Kairos cerca. El permiso de ubicación solo se pide al pulsar el botón.
class NearbyScreen extends StatefulWidget {
  const NearbyScreen({super.key});
  @override
  State<NearbyScreen> createState() => _NearbyScreenState();
}

enum _Phase { idle, loading, denied, off, done, error }

class _NearbyScreenState extends State<NearbyScreen> {
  _Phase _phase = _Phase.idle;
  List<NearbyStore> _stores = const [];
  Object? _error;

  Future<void> _search() async {
    setState(() => _phase = _Phase.loading);
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return setState(() => _phase = _Phase.off);
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) perm = await Geolocator.requestPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return setState(() => _phase = _Phase.denied);
      // Precisión baja: basta para saber qué hay cerca y gasta menos batería.
      final pos = await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.low, timeLimit: Duration(seconds: 12)));
      final list = await Api.instance.nearby(pos.latitude, pos.longitude);
      if (!mounted) return;
      setState(() {
        _stores = list;
        _phase = _Phase.done;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e;
        _phase = _Phase.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(22, 18, 22, 32), children: [
          PageHeader(S.nearbyTitle, S.nearbyItalic, kicker: S.nearbyKicker),
          const SizedBox(height: 22),
          ..._body(context),
          const SizedBox(height: 18),
          const Center(child: KairosSeal()),
        ]),
      );

  List<Widget> _body(BuildContext context) {
    switch (_phase) {
      case _Phase.idle:
        return [_Prompt(text: S.nearbyAsk, onTap: _search)];
      case _Phase.loading:
        return [const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator(strokeWidth: 3))), Center(child: Text(S.nearbyLoading, style: body(14)))];
      case _Phase.denied:
        return [_Prompt(text: S.nearbyDenied, onTap: _search)];
      case _Phase.off:
        return [_Prompt(text: S.nearbyOff, onTap: _search)];
      case _Phase.error:
        return [ErrorView(error: _error ?? '', onRetry: _search)];
      case _Phase.done:
        if (_stores.isEmpty) return [_Prompt(text: S.nearbyEmpty, onTap: _search)];
        return [
          for (final s in _stores) ...[_StoreCard(s: s), const SizedBox(height: 14)],
        ];
    }
  }
}

class _Prompt extends StatelessWidget {
  const _Prompt({required this.text, required this.onTap});
  final String text;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Icon(Icons.location_on_outlined, size: 36, color: K.primary),
            const SizedBox(height: 12),
            Text(text, style: body(16)),
            const SizedBox(height: 18),
            FilledButton.icon(onPressed: onTap, icon: const Icon(Icons.near_me_rounded), label: const Text(S.nearbyCta)),
          ]),
        ),
      );
}

class _StoreCard extends StatelessWidget {
  const _StoreCard({required this.s});
  final NearbyStore s;
  @override
  Widget build(BuildContext context) {
    final color = parseHex(s.primaryColor);
    final soft = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            BrandAvatar(name: s.name, url: s.logoUrl, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(s.name, style: display(22)),
                Text(s.storeName == s.name ? S.away(s.distanceKm) : '${s.storeName} · ${S.away(s.distanceKm)}', style: body(13, color: soft)),
              ]),
            ),
          ]),
          if (s.address != null && s.address!.isNotEmpty) ...[
            const SizedBox(height: 10),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(Icons.place_outlined, size: 16, color: soft),
              const SizedBox(width: 6),
              Expanded(child: Text(s.address!, style: body(13, color: soft))),
            ]),
          ],
          if (s.rewards.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(S.nearbyReward, style: body(12, color: soft, weight: FontWeight.w800)),
            const SizedBox(height: 6),
            Wrap(spacing: 8, runSpacing: 8, children: [
              for (final r in s.rewards)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(99)),
                  child: Text('${r.title} · ${S.pts(r.pointsCost)}', style: body(13)),
                ),
            ]),
          ],
        ]),
      ),
    );
  }
}
