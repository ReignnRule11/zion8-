import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zion8/core/widgets/status_badge.dart';

void main() {
  testWidgets('status badge announces the status', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: StatusBadge(status: 'POSTED'))),
    );
    expect(find.text('POSTED'), findsOneWidget);
    expect(find.bySemanticsLabel('Status POSTED'), findsOneWidget);
  });
}
