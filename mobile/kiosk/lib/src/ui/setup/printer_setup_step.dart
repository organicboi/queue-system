import 'dart:async';

import 'package:flutter/material.dart';

import '../../printing/discovery.dart';
import '../../printing/escpos_printer.dart';
import '../../printing/printer_settings.dart';
import '../theme.dart';

/// Printer configuration step: streams in auto-discovered candidates from all
/// three transports, falls back to manual entry, and lets the installer
/// confirm paper width with an actual calibration print rather than trusting
/// any printer's (frequently wrong) self-reported model info.
class PrinterSetupStep extends StatefulWidget {
  const PrinterSetupStep({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final PrinterSettings value;
  final ValueChanged<PrinterSettings> onChanged;

  @override
  State<PrinterSetupStep> createState() => _PrinterSetupStepState();
}

class _PrinterSetupStepState extends State<PrinterSetupStep> {
  final _found = <DiscoveredPrinter>[];
  StreamSubscription<DiscoveredPrinter>? _sub;
  bool _scanning = true;
  String? _calibrationResult;
  bool _testing = false;

  late TextEditingController _hostController;
  late TextEditingController _portController;

  @override
  void initState() {
    super.initState();
    _hostController = TextEditingController(text: widget.value.networkHost ?? '');
    _portController = TextEditingController(text: widget.value.networkPort.toString());
    _startScan();
  }

  void _startScan() {
    setState(() {
      _scanning = true;
      _found.clear();
    });
    _sub?.cancel();
    _sub = discoverPrinters().listen(
      (found) {
        if (!mounted) return;
        setState(() {
          _found.add(found);
          // Exactly one candidate so far and nothing chosen yet — pre-select
          // it so the common case (one printer on site) needs zero taps.
          if (_found.length == 1 && widget.value.transport == PrinterTransportKind.none) {
            widget.onChanged(found.applyTo(widget.value));
          }
        });
      },
      onDone: () {
        if (mounted) setState(() => _scanning = false);
      },
    );
  }

  @override
  void dispose() {
    _sub?.cancel();
    _hostController.dispose();
    _portController.dispose();
    super.dispose();
  }

  void _select(DiscoveredPrinter found) {
    widget.onChanged(found.applyTo(widget.value));
    if (found.transport == PrinterTransportKind.network) {
      _hostController.text = found.networkHost ?? '';
    }
  }

  Future<void> _testCalibration() async {
    setState(() {
      _testing = true;
      _calibrationResult = null;
    });
    final printer = EscPosPrinter(
      settings: widget.value,
      branchInfo: const BranchTicketInfo(
        schoolNameEn: '', schoolNameAr: '', ticketFooterEn: '', ticketFooterAr: '',
      ),
    );
    final attempt = await printer.printCalibration();
    final error = printer.lastCalibrationError;
    await printer.dispose();
    if (!mounted) return;
    setState(() {
      _testing = false;
      _calibrationResult = attempt.isFailure
          ? 'Could not print: ${error ?? 'unknown error'}'
          : 'Sent. Read the last ruler mark that printed: about 48 mm means a '
              '58 mm roll, about 72 mm means 80 mm. Set Paper to match — too '
              'wide and every ticket loses its right edge.';
    });
  }

  @override
  Widget build(BuildContext context) {
    final v = widget.value;
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Detected printers', style: Theme.of(context).textTheme.titleMedium),
              ),
              if (_scanning)
                const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              else
                TextButton.icon(
                  onPressed: _startScan,
                  icon: const Icon(Icons.refresh),
                  label: const Text('Rescan'),
                ),
            ],
          ),
          const SizedBox(height: 8),
          if (_found.isEmpty && !_scanning)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: Text('Nothing found automatically — enter details manually below.',
                  style: TextStyle(color: KioskPalette.inkSoft)),
            ),
          for (final found in _found)
            _CandidateTile(
              found: found,
              selected: _isSelected(found),
              onTap: () => _select(found),
            ),
          const SizedBox(height: 20),
          Text('Manual / network settings', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<PrinterTransportKind>(
            segments: const [
              ButtonSegment(value: PrinterTransportKind.network, label: Text('Network')),
              ButtonSegment(value: PrinterTransportKind.usb, label: Text('USB')),
              ButtonSegment(value: PrinterTransportKind.bluetooth, label: Text('Bluetooth')),
            ],
            selected: {v.transport == PrinterTransportKind.none ? PrinterTransportKind.network : v.transport},
            onSelectionChanged: (s) => widget.onChanged(v.copyWith(transport: s.first)),
          ),
          const SizedBox(height: 12),
          if (v.transport == PrinterTransportKind.network) ...[
            Row(
              children: [
                Expanded(
                  flex: 3,
                  child: TextField(
                    controller: _hostController,
                    decoration: const InputDecoration(labelText: 'Printer IP address'),
                    keyboardType: TextInputType.number,
                    onChanged: (t) => widget.onChanged(v.copyWith(networkHost: t)),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _portController,
                    decoration: const InputDecoration(labelText: 'Port'),
                    keyboardType: TextInputType.number,
                    onChanged: (t) =>
                        widget.onChanged(v.copyWith(networkPort: int.tryParse(t) ?? 9100)),
                  ),
                ),
              ],
            ),
          ] else
            Text(
              v.isConfigured
                  ? 'Selected: ${v.label ?? (v.transport == PrinterTransportKind.usb ? v.usbDeviceName : v.bluetoothName) ?? ''}'
                  : 'Pick a detected ${v.transport.label} printer above.',
              style: const TextStyle(color: KioskPalette.inkSoft),
            ),
          const SizedBox(height: 20),
          Text('Paper', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          SegmentedButton<PaperWidth>(
            segments: const [
              ButtonSegment(value: PaperWidth.mm58, label: Text('58 mm / 384 dots')),
              ButtonSegment(value: PaperWidth.mm80, label: Text('80 mm / 576 dots')),
            ],
            selected: {v.paper},
            onSelectionChanged: (s) => widget.onChanged(v.copyWith(paper: s.first)),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Has auto-cutter'),
            value: v.hasCutter,
            onChanged: (val) => widget.onChanged(v.copyWith(hasCutter: val)),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: v.isConfigured && !_testing ? _testCalibration : null,
            icon: _testing
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.receipt_long_outlined),
            label: const Text('Print calibration ticket'),
          ),
          if (_calibrationResult != null)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_calibrationResult!, style: const TextStyle(color: KioskPalette.inkSoft)),
            ),
        ],
      ),
    );
  }

  bool _isSelected(DiscoveredPrinter found) {
    final v = widget.value;
    if (v.transport != found.transport) return false;
    return switch (found.transport) {
      PrinterTransportKind.network => v.networkHost == found.networkHost,
      PrinterTransportKind.usb => v.usbDeviceName == found.usbDeviceName,
      PrinterTransportKind.bluetooth => v.bluetoothAddress == found.bluetoothAddress,
      PrinterTransportKind.none => false,
    };
  }
}

class _CandidateTile extends StatelessWidget {
  const _CandidateTile({required this.found, required this.selected, required this.onTap});
  final DiscoveredPrinter found;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      color: selected ? KioskPalette.primarySoft : KioskPalette.surface,
      child: ListTile(
        leading: Icon(
          switch (found.transport) {
            PrinterTransportKind.network => Icons.wifi_rounded,
            PrinterTransportKind.usb => Icons.usb_rounded,
            PrinterTransportKind.bluetooth => Icons.bluetooth_rounded,
            PrinterTransportKind.none => Icons.print_outlined,
          },
          color: selected ? KioskPalette.primary : KioskPalette.inkSoft,
        ),
        title: Text(found.label),
        trailing: selected ? const Icon(Icons.check_circle, color: KioskPalette.primary) : null,
        onTap: onTap,
      ),
    );
  }
}
