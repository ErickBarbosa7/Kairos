import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Tokens de Kairos (packages/design/tokens.json). La Wallet usa la marca Kairos en su estructura
/// y el color de cada negocio en sus tarjetas.
class K {
  static const primary = Color(0xFF0F766E);
  static const reward = Color(0xFFFBBF24);
  static const night = Color(0xFF121614);
  static const nightRaised = Color(0xFF1B211E);
  static const nightLine = Color(0xFF2E3733);
  static const paper = Color(0xFFFAF7F2);
  static const paperRaised = Color(0xFFFFFFFF);
  static const paperLine = Color(0xFFE7E0D5);
  static const ink = Color(0xFF1C1917);
  static const inkSoft = Color(0xFF57534E);
  static const success = Color(0xFF15803D);
  static const successDark = Color(0xFF4ADE80);
  static const warning = Color(0xFFB45309);
}

/// Color que se lee sobre `bg` (blanco o casi negro, el de mayor contraste).
Color onColor(Color bg) => bg.computeLuminance() > 0.4 ? const Color(0xFF14132B) : Colors.white;

Color parseHex(String hex, {Color fallback = K.primary}) {
  final h = hex.replaceFirst('#', '');
  if (h.length != 6) return fallback;
  final v = int.tryParse(h, radix: 16);
  return v == null ? fallback : Color(0xFF000000 | v);
}

ThemeData buildTheme(Brightness b) {
  final dark = b == Brightness.dark;
  final bg = dark ? K.night : K.paper;
  final surface = dark ? K.nightRaised : K.paperRaised;
  final line = dark ? K.nightLine : K.paperLine;
  final text = dark ? const Color(0xFFF5F1EA) : K.ink;
  final scheme = ColorScheme.fromSeed(seedColor: K.primary, brightness: b).copyWith(
    primary: K.primary,
    onPrimary: Colors.white,
    surface: surface,
    onSurface: text,
    outline: line,
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    textTheme: GoogleFonts.figtreeTextTheme(ThemeData(brightness: b).textTheme).apply(bodyColor: text, displayColor: text),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: line, width: 1)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: surface,
      indicatorColor: K.primary.withValues(alpha: 0.16),
      labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: text)),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        side: BorderSide(color: line, width: 1),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
  );
}


/// Tipografía de Kairos (design.md): Figtree extra negrita para títulos y cifras, Instrument Serif cursiva
/// para una palabra de énfasis, Figtree para texto y JetBrains Mono para códigos.
TextStyle display(double size, {Color? color, double height = 1}) =>
    GoogleFonts.figtree(fontSize: size, fontWeight: FontWeight.w800, letterSpacing: -0.4, height: height, color: color);

TextStyle accent(double size, {Color? color}) =>
    GoogleFonts.instrumentSerif(fontSize: size, fontStyle: FontStyle.italic, height: 1, color: color);

TextStyle body(double size, {Color? color, FontWeight weight = FontWeight.w600}) =>
    GoogleFonts.figtree(fontSize: size, fontWeight: weight, color: color);

TextStyle mono(double size, {Color? color}) =>
    GoogleFonts.jetBrainsMono(fontSize: size, fontWeight: FontWeight.w700, letterSpacing: 4, color: color);
