import 'package:flutter/material.dart';

import '../../api/app_api.dart';
import '../../config/device_vertical.dart';

/// Editor for the tenant's server-side settings for one facility. Deliberately a
/// thin, descriptor-driven map editor: the server contract is "accept a partial
/// patch, echo the DTO", so a new field the backend adds does not need an app
/// release — only a new row here to surface it.
class TenantSettingsForm extends StatefulWidget {
  const TenantSettingsForm({
    super.key,
    required this.vertical,
    required this.settings,
    required this.onSave,
  });

  final DeviceVertical vertical;
  final TenantSettings settings;
  final Future<void> Function(Map<String, dynamic> patch) onSave;

  @override
  State<TenantSettingsForm> createState() => _TenantSettingsFormState();
}

enum _FieldType { boolean, integer, text }

class _FieldSpec {
  const _FieldSpec(this.key, this.label, this.type);
  final String key;
  final String label;
  final _FieldType type;
}

class _TenantSettingsFormState extends State<TenantSettingsForm> {
  late Map<String, dynamic> _row;
  late List<String> _languages;
  final Map<String, TextEditingController> _text = {};
  final Map<String, bool> _bools = {};
  bool _saving = false;

  List<_FieldSpec> get _specs => [
        const _FieldSpec('kioskIdleSeconds', 'Kiosk idle seconds', _FieldType.integer),
        const _FieldSpec('priorityEnabled', 'Priority queue', _FieldType.boolean),
        const _FieldSpec('announceEnabled', 'Voice announcements', _FieldType.boolean),
        const _FieldSpec('printEnabled', 'Print tickets', _FieldType.boolean),
        const _FieldSpec('publicTrackingEnabled', 'Public tracking QR', _FieldType.boolean),
        const _FieldSpec('timezone', 'Timezone', _FieldType.text),
        if (widget.vertical == DeviceVertical.hospital) ...[
          const _FieldSpec('priorityGraceMinutes', 'Priority grace (min)', _FieldType.integer),
          const _FieldSpec('followupFreeDays', 'Free follow-up days', _FieldType.integer),
          const _FieldSpec('patientDataRetentionDays', 'Patient data retention (days)', _FieldType.integer),
        ],
      ];

  @override
  void initState() {
    super.initState();
    _row = Map<String, dynamic>.from(widget.settings.settings ?? const {});
    _languages = ((_row['languages'] as List?) ?? const ['en']).cast<String>();
    for (final spec in _specs) {
      final v = _row[spec.key];
      if (spec.type == _FieldType.boolean) {
        _bools[spec.key] = v == true;
      } else {
        _text[spec.key] = TextEditingController(text: v == null ? '' : '$v');
      }
    }
    // Ticket footer, one field per available language.
    final footer = (_row['ticketFooter'] as Map?)?.cast<String, dynamic>() ?? const {};
    for (final l in _availableLanguages) {
      _text['ticketFooter.$l'] =
          TextEditingController(text: (footer[l] ?? '').toString());
    }
  }

  List<String> get _availableLanguages =>
      widget.settings.availableLanguages.isEmpty
          ? const ['en']
          : widget.settings.availableLanguages;

  @override
  void dispose() {
    for (final c in _text.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final patch = <String, dynamic>{};
    for (final spec in _specs) {
      switch (spec.type) {
        case _FieldType.boolean:
          patch[spec.key] = _bools[spec.key] ?? false;
        case _FieldType.integer:
          final raw = _text[spec.key]!.text.trim();
          if (raw.isNotEmpty) {
            final n = int.tryParse(raw);
            if (n != null) patch[spec.key] = n;
          }
        case _FieldType.text:
          final raw = _text[spec.key]!.text.trim();
          if (raw.isNotEmpty) patch[spec.key] = raw;
      }
    }
    patch['languages'] = _languages;
    final footer = <String, String>{};
    for (final l in _availableLanguages) {
      final raw = _text['ticketFooter.$l']!.text.trim();
      if (raw.isNotEmpty) footer[l] = raw;
    }
    if (footer.isNotEmpty) patch['ticketFooter'] = footer;

    setState(() => _saving = true);
    await widget.onSave(patch);
    if (mounted) setState(() => _saving = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('Languages', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        Wrap(
          spacing: 8,
          children: [
            for (final l in _availableLanguages)
              FilterChip(
                label: Text(l.toUpperCase()),
                selected: _languages.contains(l),
                onSelected: (on) => setState(() {
                  if (on) {
                    if (!_languages.contains(l)) _languages = [..._languages, l];
                  } else if (_languages.length > 1) {
                    _languages = _languages.where((x) => x != l).toList();
                  }
                }),
              ),
          ],
        ),
        const SizedBox(height: 16),
        for (final spec in _specs) _field(spec),
        const SizedBox(height: 8),
        const Text('Ticket footer', style: TextStyle(fontWeight: FontWeight.w600)),
        for (final l in _availableLanguages)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: TextField(
              controller: _text['ticketFooter.$l'],
              decoration: InputDecoration(labelText: 'Footer (${l.toUpperCase()})'),
              maxLength: 200,
            ),
          ),
        const SizedBox(height: 12),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save settings'),
          ),
        ),
      ],
    );
  }

  Widget _field(_FieldSpec spec) {
    switch (spec.type) {
      case _FieldType.boolean:
        return SwitchListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(spec.label),
          value: _bools[spec.key] ?? false,
          onChanged: (v) => setState(() => _bools[spec.key] = v),
        );
      case _FieldType.integer:
        return Padding(
          padding: const EdgeInsets.only(top: 8),
          child: TextField(
            controller: _text[spec.key],
            decoration: InputDecoration(labelText: spec.label),
            keyboardType: TextInputType.number,
          ),
        );
      case _FieldType.text:
        return Padding(
          padding: const EdgeInsets.only(top: 8),
          child: TextField(
            controller: _text[spec.key],
            decoration: InputDecoration(labelText: spec.label),
          ),
        );
    }
  }
}
