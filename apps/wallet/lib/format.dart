const _days = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const _months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

String _time(DateTime d) {
  final h = d.hour % 12 == 0 ? 12 : d.hour % 12;
  return '$h:${d.minute.toString().padLeft(2, '0')} ${d.hour < 12 ? 'a. m.' : 'p. m.'}';
}

/// "hoy a las 6:00 p. m." / "vie 13 nov, 6:00 a. m."
String when(DateTime d) {
  final now = DateTime.now();
  if (d.year == now.year && d.month == now.month && d.day == now.day) return 'hoy a las ${_time(d)}';
  return '${_days[d.weekday - 1]} ${d.day} ${_months[d.month - 1]}, ${_time(d)}';
}

String day(DateTime d) => '${d.day} ${_months[d.month - 1]}';
