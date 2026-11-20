import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  ApiException(this.status, this.code, this.message);
  final int status;
  final String code, message;
  @override
  String toString() => message;
}

/// Dirección de la API. Se cambia al compilar: `--dart-define=API_URL=https://api.tu-dominio.com`.
String _apiBase() {
  const fromEnv = String.fromEnvironment('API_URL');
  if (fromEnv.isNotEmpty) return fromEnv;
  if (kIsWeb) return '${Uri.base.scheme}://${Uri.base.host}:3000';
  if (defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:3000'; // el PC visto desde el emulador
  return 'http://localhost:3000';
}

/// Cliente de la API de Kairos. Sin fricción: si no hay sesión, crea una de invitado al instante.
class Api {
  Api._();
  static final Api instance = Api._();
  static const _tokenKey = 'kairos-wallet-token';

  final String base = _apiBase();
  String? _token;
  Future<String>? _creating;

  Future<String> _session() async {
    if (_token != null) return _token!;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    if (_token != null) return _token!;
    return _creating ??= _raw('POST', '/wallet/guest').then((d) async {
      _token = d['token'] as String;
      await prefs.setString(_tokenKey, _token!);
      return _token!;
    }).whenComplete(() => _creating = null);
  }

  Future<dynamic> _raw(String method, String path, {Object? body, String? token}) async {
    final uri = Uri.parse('$base$path');
    final headers = {
      if (body != null) 'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
    };
    http.Response res;
    try {
      final send = switch (method) {
        'POST' => http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body)),
        _ => http.get(uri, headers: headers),
      };
      res = await send.timeout(const Duration(seconds: 15));
    } catch (_) {
      throw ApiException(0, 'offline', 'No hay conexión. Revisa tu internet e inténtalo de nuevo.');
    }
    final data = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final e = data is Map ? data['error'] as Map? : null;
      throw ApiException(res.statusCode, (e?['code'] ?? 'error') as String, (e?['message'] ?? 'Algo salió mal.') as String);
    }
    return data;
  }

  /// Llamada con sesión. Si el servidor ya no reconoce el token, se descarta y se crea otro.
  Future<dynamic> _call(String method, String path, {Object? body}) async {
    try {
      return await _raw(method, path, body: body, token: await _session());
    } on ApiException catch (e) {
      if (e.status != 401) rethrow;
      _token = null;
      (await SharedPreferences.getInstance()).remove(_tokenKey);
      return _raw(method, path, body: body, token: await _session());
    }
  }

  /// Negocios cercanos. Es una ruta pública: no necesita sesión. La ubicación no se guarda en ningún lado.
  Future<List<NearbyStore>> nearby(double lat, double lng, {double radiusKm = 10}) async =>
      ((await _raw('GET', '/public/stores/nearby?lat=$lat&lng=$lng&radius=$radiusKm'))['data'] as List).map((e) => NearbyStore.fromJson(e)).toList();

  Future<Me> me() async => Me.fromJson(await _call('GET', '/wallet/me'));

  /// Convierte al invitado actual en cuenta. Conserva sus puntos.
  Future<Me> register(String email, String password, {String? name}) async {
    final d = await _call('POST', '/wallet/register', body: {'email': email, 'password': password, if (name != null && name.isNotEmpty) 'displayName': name});
    return _adopt(d);
  }

  /// Inicia sesión. Si hay un invitado con puntos en este dispositivo, la API los suma a la cuenta.
  Future<Me> login(String email, String password) async {
    final prefs = await SharedPreferences.getInstance();
    _token ??= prefs.getString(_tokenKey);
    final d = await _raw('POST', '/wallet/login', body: {'email': email, 'password': password}, token: _token);
    return _adopt(d);
  }

  /// Manda un código al correo. La respuesta es la misma exista o no la cuenta.
  Future<void> forgotPassword(String email) => _raw('POST', '/wallet/forgot-password', body: {'email': email});

  Future<void> resetPassword(String email, String code, String password) =>
      _raw('POST', '/wallet/reset-password', body: {'email': email, 'code': code, 'password': password});

  /// Cierra la sesión de este dispositivo. La próxima vez se crea un invitado nuevo.
  Future<void> logout() async {
    _token = null;
    await (await SharedPreferences.getInstance()).remove(_tokenKey);
  }

  Future<Me> _adopt(dynamic d) async {
    _token = d['token'] as String;
    await (await SharedPreferences.getInstance()).setString(_tokenKey, _token!);
    return Me.fromJson(d['me']);
  }

  Future<List<Balance>> balances() async =>
      ((await _call('GET', '/wallet/balances'))['data'] as List).map((e) => Balance.fromJson(e)).toList();

  Future<List<Reward>> rewards(String tenantId) async =>
      ((await _call('GET', '/wallet/rewards?tenantId=$tenantId'))['data'] as List).map((e) => Reward.fromJson(e)).toList();

  Future<List<Coupon>> coupons() async =>
      ((await _call('GET', '/wallet/coupons'))['data'] as List).map((e) => Coupon.fromJson(e)).toList();

  Future<ClaimResult> claim(String qr) async => ClaimResult.fromJson(await _call('POST', '/wallet/claims', body: {'qr': qr}));

  Future<({String code, DateTime validFrom})> redeem(String rewardId) async {
    final d = await _call('POST', '/wallet/redeem', body: {'rewardId': rewardId});
    return (code: d['coupon']['code'] as String, validFrom: DateTime.parse(d['coupon']['validFrom']).toLocal());
  }
}

/// Saca el token de un QR: puede ser el enlace de la Wallet (`…/c#token`) o el token a secas.
String? tokenFromScan(String raw) {
  final text = raw.trim();
  final hash = text.indexOf('#');
  final candidate = hash >= 0 ? text.substring(hash + 1) : text;
  return RegExp(r'^[\w-]+\.[\w-]+\.[\w-]+$').hasMatch(candidate) ? candidate : null;
}
