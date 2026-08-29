import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:school_kiosk/src/printing/escpos.dart';

void main() {
  test('raster header encodes width-in-bytes and height little-endian', () {
    // 16 dots wide (2 bytes/row), 3 rows tall — small enough to hand-check.
    final bitmap = Uint8List.fromList([0xFF, 0x00, 0x81, 0x81, 0x00, 0xFF]);
    final bytes = EscPos.raster(widthDots: 16, heightDots: 3, bitmap: bitmap);

    // GS v 0, m=0, xL xH, yL yH, then the bitmap verbatim.
    expect(bytes.sublist(0, 4), [0x1D, 0x76, 0x30, 0x00]);
    expect(bytes[4], 2); // xL: bytesPerRow = 16/8 = 2
    expect(bytes[5], 0); // xH
    expect(bytes[6], 3); // yL: height = 3
    expect(bytes[7], 0); // yH
    expect(bytes.sublist(8), bitmap);
  });

  test('raster rejects a width that is not a multiple of 8 dots', () {
    expect(
      () => EscPos.raster(widthDots: 10, heightDots: 1, bitmap: Uint8List(2)),
      throwsA(isA<AssertionError>()),
    );
  });

  test('feed clamps to a single byte', () {
    expect(EscPos.feed(300), [0x1B, 0x64, 255]);
    expect(EscPos.feed(-5), [0x1B, 0x64, 0]);
  });

  test('PaperStatus decodes the documented status bits', () {
    expect(PaperStatus.fromByte(0x00).paperOut, isFalse);
    expect(PaperStatus.fromByte(0x00).coverOpen, isFalse);
    expect(PaperStatus.fromByte(0x60).paperOut, isTrue); // bits 5+6 set
    expect(PaperStatus.fromByte(0x04).coverOpen, isTrue); // bit 2 set
  });
}
