// Values shared by server reads and client rendering. Kept out of
// lib/dal/school.ts because that module is `server-only`: importing a constant
// from it drags the service-role Supabase client into the browser bundle.

export const SCHOOL_TOKEN_PAGE_SIZE = 50
