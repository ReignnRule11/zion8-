import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../theme/tokens.dart';

class ShellDestination {
  const ShellDestination({
    required this.location,
    required this.label,
    required this.icon,
    this.selectedIcon,
  });

  final String location;
  final String label;
  final IconData icon;
  final IconData? selectedIcon;
}

class ResponsiveScaffold extends StatelessWidget {
  const ResponsiveScaffold({
    super.key,
    required this.navigationShell,
    required this.destinations,
  });

  final StatefulNavigationShell navigationShell;
  final List<ShellDestination> destinations;

  void _go(int index) => navigationShell.goBranch(index);

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= 1024) {
          return _rail(extended: true);
        }
        if (constraints.maxWidth >= 600) {
          return _rail();
        }
        return _bar();
      },
    );
  }

  Widget _bar() {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _go,
        destinations: [
          for (final dest in destinations)
            NavigationDestination(
              icon: Icon(dest.icon),
              selectedIcon: Icon(dest.selectedIcon ?? dest.icon),
              label: dest.label,
            ),
        ],
      ),
    );
  }

  Widget _rail({bool extended = false}) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: navigationShell.currentIndex,
            onDestinationSelected: _go,
            extended: extended,
            labelType: extended ? NavigationRailLabelType.none : NavigationRailLabelType.all,
            minWidth: ZionTokens.minTap,
            destinations: [
              for (final dest in destinations)
                NavigationRailDestination(
                  icon: Icon(dest.icon),
                  selectedIcon: Icon(dest.selectedIcon ?? dest.icon),
                  label: Text(dest.label),
                ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: navigationShell),
        ],
      ),
    );
  }
}
