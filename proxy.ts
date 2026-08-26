import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()

  // School device surfaces authenticate with the long-lived token in their own
  // URL (branch_token / screen_token / counter_token), exactly like
  // /counter/[token] and /display/[token]. They must stay reachable without a
  // Supabase session — a lobby kiosk and a ceiling-mounted TV never log in.
  const isSchoolDevice =
    pathname.startsWith('/school/kiosk') ||
    pathname.startsWith('/school/display') ||
    pathname.startsWith('/school/counter')

  // Protected customer-admin routes (require Supabase session)
  const isAdminRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/branches') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/users') ||
    pathname.startsWith('/analytics') ||
    pathname.startsWith('/branch') ||
    (pathname.startsWith('/school') && !isSchoolDevice)

  if (isAdminRoute && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Distributor routes — protected by dist_session cookie (checked in DAL)
  // We just ensure non-distributor public paths aren't wrapped in distributor layout
  // Real auth happens in requireDistributor() server-side

  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|.*\\.png$|.*\\.svg$|.*\\.ico$).*)',
  ],
}
