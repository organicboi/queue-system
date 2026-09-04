import 'package:flutter/material.dart';

import '../../api/app_api.dart';
import '../../config/device_role.dart';
import '../theme.dart';

/// Wizard step 4: pick which facility (and, for a TV board, which screen) this
/// device serves. The choices come from the sign-in response — the operator
/// only sees branches/screens their account can manage.
class FacilityStep extends StatelessWidget {
  const FacilityStep({
    super.key,
    required this.role,
    required this.login,
    required this.branch,
    required this.screen,
    required this.webUrlController,
    required this.onBranch,
    required this.onScreen,
  });

  final DeviceRole? role;
  final AppLoginResult? login;
  final AppBranch? branch;
  final AppScreen? screen;
  final TextEditingController webUrlController;
  final ValueChanged<AppBranch?> onBranch;
  final ValueChanged<AppScreen?> onScreen;

  @override
  Widget build(BuildContext context) {
    if (role == DeviceRole.web) {
      return ListView(
        children: [
          const SizedBox(height: 8),
          Text('Page to display', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 20),
          TextField(
            controller: webUrlController,
            decoration: const InputDecoration(labelText: 'Web page URL'),
            keyboardType: TextInputType.url,
            autocorrect: false,
          ),
        ],
      );
    }

    final data = login;
    if (data == null) {
      return const Center(child: Text('Sign in first.'));
    }

    final branches = data.branches;
    final screens = (role == DeviceRole.display && branch != null)
        ? data.screensFor(branch!)
        : <AppScreen>[];

    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Which facility?', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text('Product: ${data.profile.vertical.label}',
            style: const TextStyle(color: KioskPalette.inkSoft)),
        const SizedBox(height: 20),
        if (branches.isEmpty)
          const Text('This account has no facilities to manage.',
              style: TextStyle(color: KioskPalette.danger))
        else
          DropdownButtonFormField<AppBranch>(
            initialValue: branch,
            decoration: const InputDecoration(labelText: 'Facility'),
            items: [
              for (final b in branches)
                DropdownMenuItem(value: b, child: Text(b.name)),
            ],
            onChanged: onBranch,
          ),
        if (role == DeviceRole.display) ...[
          const SizedBox(height: 16),
          if (branch == null)
            const Text('Pick a facility to see its screens.',
                style: TextStyle(color: KioskPalette.inkSoft))
          else if (screens.isEmpty)
            const Text(
              'No TV screens for this facility yet. Add one on the dashboard '
              'first, then come back.',
              style: TextStyle(color: KioskPalette.danger),
            )
          else
            DropdownButtonFormField<AppScreen>(
              initialValue: screen,
              decoration: const InputDecoration(labelText: 'Screen'),
              items: [
                for (final s in screens)
                  DropdownMenuItem(value: s, child: Text(s.name)),
              ],
              onChanged: onScreen,
            ),
        ],
      ],
    );
  }
}
