import 'package:flutter/material.dart';

import '../api.dart';
import '../models.dart';
import '../strings.dart';
import '../theme.dart';
import '../widgets.dart';

/// Cuenta opcional (spec wallet-login). Se cierra con `true` si la sesión cambió.
class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, this.me});
  /// Cuenta actual si ya hay sesión; null para un invitado.
  final Me? me;
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen> {
  bool _register = true, _busy = false, _hide = true;
  String? _error;
  final _email = TextEditingController(), _password = TextEditingController(), _name = TextEditingController();

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (!RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(email)) return setState(() => _error = S.invalidEmail);
    if (_password.text.length < 8) return setState(() => _error = S.shortPassword);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_register) {
        await Api.instance.register(email, _password.text, name: _name.text.trim());
      } else {
        await Api.instance.login(email, _password.text);
      }
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = S.accountErrors[e.code] ?? e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text(S.logout),
        content: const Text(S.logoutConfirm),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text(S.cancel)),
          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text(S.logout)),
        ],
      ),
    );
    if (ok != true) return;
    await Api.instance.logout();
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final me = widget.me;
    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0),
      body: SafeArea(
        child: ListView(padding: const EdgeInsets.fromLTRB(22, 0, 22, 32), children: [
          const Heading(S.accountTitle, S.accountItalic),
          const SizedBox(height: 22),
          if (me != null && !me.isGuest) ...[
            Text(S.signedInAs, style: body(14, color: cs.onSurface.withValues(alpha: 0.7))),
            const SizedBox(height: 4),
            Text(me.email ?? '', style: body(18, weight: FontWeight.w800)),
            const SizedBox(height: 24),
            OutlinedButton(onPressed: _logout, child: const Text(S.logout)),
          ] else ...[
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: true, label: Text(S.tabRegister)),
                ButtonSegment(value: false, label: Text(S.tabLogin)),
              ],
              selected: {_register},
              onSelectionChanged: (v) => setState(() {
                _register = v.first;
                _error = null;
              }),
            ),
            const SizedBox(height: 18),
            Text(_register ? S.registerHint : S.loginHint, style: body(14, color: cs.onSurface.withValues(alpha: 0.7))),
            const SizedBox(height: 16),
            if (_register) ...[
              TextField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: S.fieldName)),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              decoration: const InputDecoration(labelText: S.fieldEmail),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _password,
              obscureText: _hide,
              onSubmitted: (_) => _submit(),
              decoration: InputDecoration(
                labelText: S.fieldPassword,
                suffixIcon: IconButton(icon: Icon(_hide ? Icons.visibility_rounded : Icons.visibility_off_rounded), onPressed: () => setState(() => _hide = !_hide)),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: body(14, color: cs.error, weight: FontWeight.w700)),
            ],
            const SizedBox(height: 20),
            FilledButton(
              onPressed: _busy ? null : _submit,
              child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 3)) : Text(_register ? S.doRegister : S.doLogin),
            ),
            const SizedBox(height: 8),
            TextButton(onPressed: () => Navigator.pop(context, false), child: const Text(S.continueGuest)),
          ],
        ]),
      ),
    );
  }
}

/// Aviso discreto en Inicio: invita a crear cuenta (invitado) o muestra la sesión.
class AccountBanner extends StatelessWidget {
  const AccountBanner({super.key, required this.onChanged});
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) => FutureBuilder<Me>(
        future: Api.instance.me(),
        builder: (context, snap) {
          final me = snap.data;
          if (me == null) return const SizedBox.shrink();
          final cs = Theme.of(context).colorScheme;
          Future<void> open() async {
            final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => AccountScreen(me: me)));
            if (changed == true) onChanged();
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 18),
            child: InkWell(
              onTap: open,
              borderRadius: BorderRadius.circular(14),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(borderRadius: BorderRadius.circular(14), border: Border.all(color: cs.onSurface.withValues(alpha: 0.25), width: 1.5)),
                child: Row(children: [
                  Icon(me.isGuest ? Icons.cloud_upload_outlined : Icons.verified_user_outlined, color: K.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(me.isGuest ? S.saveTitle : (me.email ?? ''), style: body(15, weight: FontWeight.w800), overflow: TextOverflow.ellipsis),
                      if (me.isGuest) Text(S.saveBody, style: body(13, color: cs.onSurface.withValues(alpha: 0.7), weight: FontWeight.w500)),
                    ]),
                  ),
                  const Icon(Icons.chevron_right_rounded),
                ]),
              ),
            ),
          );
        },
      );
}


/// Botón de la esquina superior derecha: «Iniciar sesión» para un invitado, la inicial de la cuenta si ya entró.
class AccountButton extends StatelessWidget {
  const AccountButton({super.key, this.onChanged});
  final VoidCallback? onChanged;

  @override
  Widget build(BuildContext context) => FutureBuilder<Me>(
        future: Api.instance.me(),
        builder: (context, snap) {
          final me = snap.data;
          if (me == null) return const SizedBox.shrink();
          Future<void> open() async {
            final changed = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => AccountScreen(me: me)));
            if (changed == true) onChanged?.call();
          }

          if (me.isGuest) {
            return OutlinedButton.icon(
              onPressed: open,
              icon: const Icon(Icons.person_outline_rounded, size: 18),
              label: const Text(S.signIn),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, 40), padding: const EdgeInsets.symmetric(horizontal: 14), textStyle: body(14, weight: FontWeight.w800)),
            );
          }
          final label = (me.displayName?.trim().isNotEmpty ?? false) ? me.displayName! : (me.email ?? '?');
          return Semantics(
            button: true,
            label: S.myAccount,
            child: InkWell(
              onTap: open,
              customBorder: const CircleBorder(),
              child: Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: const BoxDecoration(shape: BoxShape.circle, color: K.primary),
                child: Text(label[0].toUpperCase(), style: display(20, color: Colors.white)),
              ),
            ),
          );
        },
      );
}
