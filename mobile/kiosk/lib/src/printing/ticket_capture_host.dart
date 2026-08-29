import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

/// Renders a widget off-screen and hands back its raw RGBA pixels, without it
/// ever being visible — even for a frame.
///
/// The widget is mounted for real (inside this app's own tree, translated far
/// outside the viewport) rather than through a hand-built `RenderView` /
/// `PipelineOwner` pair. A fully independent render pipeline is the "more
/// correct" approach on paper, but attaching a second `RenderView` to the same
/// platform view is fragile across Flutter versions and easy to get subtly
/// wrong; mounting off-screen is the same trick most widget-to-image
/// utilities use in practice, and it gets normal layout/paint/text-shaping
/// for free — including the app's Arabic font fallback.
///
/// Must be mounted once near the app root (see `KioskApp`'s `MaterialApp`
/// builder) so it's always available when a print job needs it.
class TicketCaptureHost extends StatefulWidget {
  TicketCaptureHost({required this.child}) : super(key: _hostKey);

  final Widget child;

  static final GlobalKey<_TicketCaptureHostState> _hostKey = GlobalKey();

  /// Renders [ticket] at a fixed [width] (logical pixels — chosen so it maps
  /// 1:1 to raster dots, see ticket_raster.dart) and returns its pixels.
  static Future<CapturedTicket> capture(Widget ticket, {required double width}) {
    final state = _hostKey.currentState;
    if (state == null) {
      throw StateError('TicketCaptureHost is not mounted in the widget tree');
    }
    return state._capture(ticket, width);
  }

  @override
  State<TicketCaptureHost> createState() => _TicketCaptureHostState();
}

class CapturedTicket {
  const CapturedTicket({required this.width, required this.height, required this.rgba});
  final int width;
  final int height;

  /// Straight RGBA8888, top-to-bottom, no padding — `ui.ImageByteFormat.rawRgba`.
  final Uint8List rgba;
}

class _TicketCaptureHostState extends State<TicketCaptureHost> {
  final _boundaryKey = GlobalKey();
  Widget? _pending;
  double _width = 100;

  // Only one print job runs at a time (PrintQueue serialises them), but guard
  // against re-entrancy anyway rather than trusting the caller.
  bool _busy = false;

  Future<CapturedTicket> _capture(Widget ticket, double width) async {
    if (_busy) {
      throw StateError('TicketCaptureHost is already capturing a ticket');
    }
    _busy = true;
    try {
      setState(() {
        _pending = ticket;
        _width = width;
      });

      // Two frames: one to build+layout the newly-set widget, one to make
      // sure paint has actually happened before we read the boundary.
      await WidgetsBinding.instance.endOfFrame;
      await WidgetsBinding.instance.endOfFrame;

      final renderObject = _boundaryKey.currentContext?.findRenderObject();
      if (renderObject is! RenderRepaintBoundary) {
        throw StateError('Ticket capture boundary did not render');
      }
      final image = await renderObject.toImage(pixelRatio: 1.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
      if (byteData == null) {
        throw StateError('Failed to read back ticket pixels');
      }
      return CapturedTicket(
        width: image.width,
        height: image.height,
        rgba: byteData.buffer.asUint8List(),
      );
    } finally {
      setState(() => _pending = null);
      _busy = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        if (_pending != null)
          Positioned(
            // Far outside any real viewport — never visible, in either
            // orientation, on any device this app targets.
            left: -20000,
            top: 0,
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: RepaintBoundary(
                  key: _boundaryKey,
                  child: Material(
                    color: Colors.white,
                    child: SizedBox(width: _width, child: _pending),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
