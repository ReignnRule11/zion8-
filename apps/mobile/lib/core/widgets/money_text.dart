import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

/// Integer minor units to a currency string, matching `formatMoney` on web.
class MoneyText extends StatelessWidget {
  const MoneyText({
    super.key,
    required this.minor,
    this.currency = 'USD',
    this.style,
  });

  final int minor;
  final String currency;
  final TextStyle? style;

  static String format(int minor, {String currency = 'USD'}) {
    return NumberFormat.simpleCurrency(name: currency).format(minor / 100);
  }

  @override
  Widget build(BuildContext context) {
    final text = format(minor, currency: currency);
    return Semantics(
      label: text,
      child: Text(text, style: style),
    );
  }
}
