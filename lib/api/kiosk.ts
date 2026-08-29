import 'server-only'

// Shared helpers for the Flutter-kiosk API routes under app/api/kiosk/.
//
// The routes are thin wrappers around the existing school server actions
// (lib/actions/school-tokens.ts, lib/actions/school-read.ts) and DAL
// (lib/dal/school.ts). Those already do branch-token verification and DTO
// mapping — the route's only job is HTTP framing: parse the path/body, call
// the action, serialise the result, set a sane status code.

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

// The actions return plain English error strings, not codes. Map the few
// shapes that matter onto HTTP status so the app can branch on status without
// string-matching, while still showing the message verbatim.
export function errorStatus(message: string): number {
  const m = message.toLowerCase()
  // Unknown / disabled kiosk, or a token id that isn't addressable today.
  if (
    m.includes('not registered') ||
    m.includes('not active') ||
    m.includes('not issued today')
  ) {
    return 404
  }
  // The kiosk tried to amend a token a counter already owns.
  if (m.includes('at a counter right now') || m.includes('is already ')) {
    return 409
  }
  // Everything else is a validation / business-rule rejection.
  return 400
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch {
    return null
  }
}
