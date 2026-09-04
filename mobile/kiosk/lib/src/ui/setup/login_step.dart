import 'package:flutter/material.dart';

import '../theme.dart';

/// Wizard step 2: the operator signs in with their queue-system account. The
/// account's tenant decides the product (hotel / school / hospital) — there is
/// no product picker anywhere in setup. The wizard owns the resulting session;
/// this widget only collects the credentials.
class LoginStep extends StatelessWidget {
  const LoginStep({
    super.key,
    required this.emailController,
    required this.passwordController,
    required this.busy,
    required this.error,
    required this.signedInAs,
    required this.onSubmit,
  });

  final TextEditingController emailController;
  final TextEditingController passwordController;
  final bool busy;
  final String? error;

  /// Non-null once a sign-in has succeeded (email + tenant name), so re-entering
  /// the step shows what is already connected.
  final String? signedInAs;

  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 8),
        Text('Sign in', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 6),
        const Text(
          'Use your queue-system account. The product this device shows is set '
          'by your account — you never pick it here.',
          style: TextStyle(color: KioskPalette.inkSoft),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: emailController,
          decoration: const InputDecoration(labelText: 'Email'),
          keyboardType: TextInputType.emailAddress,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: TextInputAction.next,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: passwordController,
          decoration: const InputDecoration(labelText: 'Password'),
          obscureText: true,
          autocorrect: false,
          enableSuggestions: false,
          onSubmitted: (_) => busy ? null : onSubmit(),
        ),
        const SizedBox(height: 16),
        FilledButton(
          onPressed: busy ? null : onSubmit,
          child: busy
              ? const SizedBox(
                  width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Sign in'),
        ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(error!, style: const TextStyle(color: KioskPalette.danger)),
          ),
        if (signedInAs != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: KioskPalette.success, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text('Signed in as $signedInAs')),
              ],
            ),
          ),
      ],
    );
  }
}
