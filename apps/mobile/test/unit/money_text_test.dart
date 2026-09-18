import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/widgets/money_text.dart';

void main() {
  test('formats integer minor units like the web client', () {
    expect(MoneyText.format(1250), contains('12.50'));
    expect(MoneyText.format(0), contains('0.00'));
  });
}
