import 'package:flutter/material.dart';

import '../../theme.dart';

/// Bottom marquee — scrolls [message] right-to-left continuously. Simple
/// linear-scroll implementation (an `AnimationController` driving a
/// `Transform.translate`) rather than a package: it's one behaviour, and the
/// RK3566-class hardware this runs on has no GPU headroom to spare on a
/// fancier text-scrolling widget.
class BoardTicker extends StatefulWidget {
  const BoardTicker({super.key, required this.message});
  final String message;

  @override
  State<BoardTicker> createState() => _BoardTickerState();
}

class _BoardTickerState extends State<BoardTicker> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 20))
      ..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.message.trim().isEmpty) return const SizedBox.shrink();
    return Container(
      height: 44,
      color: KioskPalette.ink,
      child: ClipRect(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return LayoutBuilder(builder: (context, constraints) {
              final textPainter = TextPainter(
                text: TextSpan(text: widget.message, style: const TextStyle(fontSize: 18)),
                textDirection: TextDirection.ltr,
              )..layout();
              final totalWidth = constraints.maxWidth + textPainter.width;
              final dx = constraints.maxWidth - _controller.value * totalWidth;
              return Stack(
                children: [
                  Positioned(
                    left: dx,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: Text(
                        widget.message,
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ),
                ],
              );
            });
          },
        ),
      ),
    );
  }
}
