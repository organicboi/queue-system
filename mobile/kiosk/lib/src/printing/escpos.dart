import 'dart:typed_data';

/// Hand-rolled ESC/POS command bytes. Only the handful of commands the ticket
/// pipeline needs — a raster print, a feed, a cut, and a status query — so
/// this stays a ~100-line file instead of a dependency on a package built for
/// the text-mode printing this app deliberately avoids (see ticket_raster.dart
/// for why: per-tenant logos and Arabic shaping rule out ESC/POS text mode).
///
/// Byte values are the manufacturer-documented ESC/POS opcodes, common across
/// the ZY307 and the wider Epson-compatible ESC/POS printer family.
class EscPos {
  EscPos._();

  static const int _esc = 0x1B;
  static const int _gs = 0x1D;
  static const int _dle = 0x10;

  /// `ESC @` — reset the printer's internal state. Send once at the start of
  /// every job so a job that ran mid-error doesn't leave stray state behind.
  static Uint8List init() => Uint8List.fromList([_esc, 0x40]);

  /// `ESC d n` — feed n lines. Used for the trailing feed after the ticket
  /// content so it clears the tear bar (or, with an auto-cutter, just enough
  /// to clear the blade before cutting).
  static Uint8List feed(int lines) =>
      Uint8List.fromList([_esc, 0x64, lines.clamp(0, 255)]);

  /// `GS V 66 n` — partial cut with an n-dot feed built in. Only sent when the
  /// printer is configured with an auto-cutter (`PrinterSettings.hasCutter`);
  /// firing it on hardware without a cutter is a silent no-op on some clones
  /// but an error on others, so it's gated in the caller, not here.
  static Uint8List partialCut() => Uint8List.fromList([_gs, 0x56, 0x42, 0x00]);

  /// `DLE EOT n` — real-time status transmission. n=1 is printer status,
  /// n=4 is paper-sensor status. The printer replies with one status byte
  /// read back over the same connection (see [PaperStatus]/[PrinterStatus]).
  static Uint8List queryPrinterStatus() =>
      Uint8List.fromList([_dle, 0x04, 0x01]);
  static Uint8List queryPaperStatus() =>
      Uint8List.fromList([_dle, 0x04, 0x04]);

  /// `GS v 0 m xL xH yL yH <data>` — print a raster image. [widthDots] MUST be
  /// a multiple of 8 (the raster packs 8 pixels per byte); [bitmap] is
  /// `widthDots/8 * heightDots` bytes, MSB-first, one bit per dot, 1 = black.
  /// `m=0` is normal density — the only mode every ESC/POS clone supports.
  static Uint8List raster({
    required int widthDots,
    required int heightDots,
    required Uint8List bitmap,
  }) {
    assert(widthDots % 8 == 0, 'raster width must be a multiple of 8 dots');
    final bytesPerRow = widthDots ~/ 8;
    assert(bitmap.length == bytesPerRow * heightDots,
        'bitmap length must be bytesPerRow * heightDots');

    final header = Uint8List.fromList([
      _gs, 0x76, 0x30, 0x00, // GS v 0, m=0
      bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF, // xL xH
      heightDots & 0xFF, (heightDots >> 8) & 0xFF, // yL yH
    ]);

    final out = BytesBuilder();
    out.add(header);
    out.add(bitmap);
    return out.toBytes();
  }

  /// `GS I 67` — best-effort model/ID query, used only as a discovery hint.
  /// Many clones ignore or garble this, so callers must never rely on it.
  static Uint8List queryModelId() => Uint8List.fromList([_gs, 0x49, 0x43]);
}

/// Decoded reply to [EscPos.queryPaperStatus]. Bit layout per the ESC/POS
/// real-time status spec (bit 5 = paper-out / near-end depending on printer,
/// bit 2 = cover open — some clones swap these; this class exposes the
/// documented bits and callers only use it as a hint, never a hard fault).
class PaperStatus {
  const PaperStatus({required this.paperOut, required this.coverOpen});

  final bool paperOut;
  final bool coverOpen;

  factory PaperStatus.fromByte(int byte) => PaperStatus(
        paperOut: (byte & 0x60) != 0,
        coverOpen: (byte & 0x04) != 0,
      );
}
