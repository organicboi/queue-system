import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../state/providers.dart';

/// One-time provisioning. Manual entry for now; a QR-scan path can be added
/// later without touching KioskConfig (§9 open question).
class SetupScreen extends ConsumerStatefulWidget {
  const SetupScreen({super.key});

  @override
  ConsumerState<SetupScreen> createState() => _SetupScreenState();
}

class _SetupScreenState extends ConsumerState<SetupScreen> {
  late final TextEditingController _baseUrl;
  late final TextEditingController _token;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final cfg = ref.read(kioskConfigProvider).value;
    _baseUrl = TextEditingController(
      text: cfg?.baseUrl ?? AppConfig.defaultBaseUrl,
    );
    _token = TextEditingController(text: cfg?.branchToken ?? '');
  }

  @override
  void dispose() {
    _baseUrl.dispose();
    _token.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    await ref.read(kioskConfigProvider.notifier).setConfig(
          baseUrl: _baseUrl.text,
          branchToken: _token.text,
        );
    // _Root swaps to KioskScreen automatically once the config is complete.
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Kiosk setup',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enter this branch’s kiosk token. Ask the school '
                  'manager for it — it is the same token used in the web '
                  'kiosk URL.',
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _baseUrl,
                  decoration: const InputDecoration(
                    labelText: 'Server URL',
                    border: OutlineInputBorder(),
                  ),
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _token,
                  decoration: const InputDecoration(
                    labelText: 'Branch token',
                    border: OutlineInputBorder(),
                  ),
                  autocorrect: false,
                  enableSuggestions: false,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    child: _saving
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Save and start'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
