import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../config/app_config.dart';
import '../../i18n/copy.dart';
import '../../state/providers.dart';
import '../theme.dart';

/// What a visitor sees when their tap could not be turned into a number.
///
/// It exists because the alternative — a spinner that stops and a snackbar
/// that slides away — reads as a broken kiosk. Three things are deliberate:
///
///  * It names the network as the cause when the network is the cause. A
///    parent who knows the building's Wi-Fi is down will wait; one who thinks
///    the software is broken walks away without a number.
///  * It watches [serverLinkProvider] live, so when the connection comes back
///    (the 6-second feed poll notices on its own) the dialog stops claiming
///    there is a problem and says so, without anyone touching it.
///  * It closes itself. Nobody is standing at a lobby terminal to dismiss a
///    modal, and the next visitor must meet the service grid.
class ConnectionDialog extends ConsumerStatefulWidget {
  const ConnectionDialog({
    super.key,
    required this.lang,
    required this.copy,
    required this.isNetwork,
    this.detail,
    this.offerRetry = true,
  });

  final String lang;
  final KioskCopy copy;

  /// True when the request never reached the server. Drives the whole message:
  /// "wait, this is the network" versus "the server said no".
  final bool isNetwork;

  /// The server's own explanation, for the non-network case. Null for network
  /// failures — a transport error's text means nothing to a visitor.
  final String? detail;

  /// Visitor-facing failures offer a retry; staff actions from the rail don't,
  /// because a half-applied amend should be re-checked against the rail rather
  /// than fired again blind.
  final bool offerRetry;

  @override
  ConsumerState<ConnectionDialog> createState() => _ConnectionDialogState();
}

class _ConnectionDialogState extends ConsumerState<ConnectionDialog> {
  Timer? _autoClose;

  @override
  void initState() {
    super.initState();
    _autoClose = Timer(AppConfig.errorDialogLinger, () {
      if (mounted) Navigator.of(context).pop(false);
    });
  }

  @override
  void dispose() {
    _autoClose?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copy = widget.copy;
    // Only meaningful for a network failure: for a server-side rejection the
    // link was never down, so "reconnected" would be answering a question the
    // visitor didn't ask.
    final recovered =
        widget.isNetwork && ref.watch(serverLinkProvider) == ServerLink.online;

    return Directionality(
      textDirection: KioskCopy.directionOf(widget.lang),
      child: AlertDialog(
        icon: Icon(
          widget.isNetwork ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
          size: 40,
          color: recovered ? KioskPalette.success : KioskPalette.danger,
        ),
        title: Text(
          widget.isNetwork ? copy.offlineTitle : copy.issueFailedTitle,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              widget.isNetwork
                  ? copy.offlineBody
                  : (widget.detail ?? copy.offlineBody),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 17, color: KioskPalette.inkSoft),
            ),
            if (widget.isNetwork) ...[
              const SizedBox(height: 18),
              _LinkLine(
                recovered: recovered,
                text: recovered ? copy.backOnline : copy.reconnecting,
              ),
            ],
          ],
        ),
        actionsAlignment: MainAxisAlignment.center,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(copy.closeLabel),
          ),
          if (widget.offerRetry)
            FilledButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: FilledButton.styleFrom(minimumSize: const Size(180, 52)),
              child: Text(copy.tryAgain),
            ),
        ],
      ),
    );
  }
}

/// The live half of the dialog: a spinner while the kiosk is still shut out,
/// a tick the moment the server answers again.
class _LinkLine extends StatelessWidget {
  const _LinkLine({required this.recovered, required this.text});

  final bool recovered;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        SizedBox(
          width: 18,
          height: 18,
          child: recovered
              ? const Icon(
                  Icons.check_circle_rounded,
                  size: 18,
                  color: KioskPalette.success,
                )
              : const CircularProgressIndicator(strokeWidth: 2.4),
        ),
        const SizedBox(width: 10),
        Flexible(
          child: Text(
            text,
            style: TextStyle(
              fontWeight: FontWeight.w600,
              color: recovered ? KioskPalette.success : KioskPalette.inkSoft,
            ),
          ),
        ),
      ],
    );
  }
}
