/// Raised by [KioskApi] when a request fails. [message] is safe to show to a
/// visitor — for 4xx it is the server action's own error string (verbatim),
/// for transport failures it is a generic retryable message.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.isNetwork = false});

  final String message;
  final int? statusCode;
  final bool isNetwork;

  /// The kiosk token / branch is unknown or disabled — a setup problem, not a
  /// transient one. The UI should send the operator back to the setup screen.
  bool get isUnregistered => statusCode == 404;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
