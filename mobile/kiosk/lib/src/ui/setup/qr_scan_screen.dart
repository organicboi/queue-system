import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../config/provisioning_qr.dart';

/// Full-screen QR scanner for the provisioning payload
/// (`components/school/SchoolScreensManager.tsx` renders one per branch/screen
/// token). Returns the parsed payload via `Navigator.pop`, or null if the
/// installer backs out.
class QrScanScreen extends StatefulWidget {
  const QrScanScreen({super.key});

  @override
  State<QrScanScreen> createState() => _QrScanScreenState();
}

class _QrScanScreenState extends State<QrScanScreen> {
  bool _handled = false;

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final raw = barcode.rawValue;
      if (raw == null) continue;
      final payload = ProvisioningPayload.tryParse(raw);
      if (payload != null) {
        _handled = true;
        Navigator.of(context).pop(payload);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          MobileScanner(
            onDetect: _onDetect,
            errorBuilder: (context, error) => _ScanError(error: error),
          ),
          Positioned(
            top: 40,
            left: 16,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Text(
                'Scan the provisioning QR from the Screens page',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Camera permission and hardware failures are common on first use — a
/// full-screen stack trace is a bad first impression, and "permission
/// denied" is the one case worth a distinct message since the fix (open
/// system settings) isn't obvious from the default error screen.
class _ScanError extends StatelessWidget {
  const _ScanError({required this.error});
  final MobileScannerException error;

  @override
  Widget build(BuildContext context) {
    final deniedPermission = error.errorCode == MobileScannerErrorCode.permissionDenied;
    return Container(
      color: Colors.black,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.no_photography_outlined, color: Colors.white54, size: 40),
          const SizedBox(height: 16),
          Text(
            deniedPermission
                ? 'Camera permission is off for this app.\nEnable it in system settings, '
                    'or enter the token by hand instead.'
                : 'Could not open the camera. You can enter the token by hand instead.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 20),
          OutlinedButton(
            style: OutlinedButton.styleFrom(foregroundColor: Colors.white),
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Back'),
          ),
        ],
      ),
    );
  }
}
