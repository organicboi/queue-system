-- Ad media (common + branch-specific) is uploaded to the "common-bucket"
-- Storage bucket. It must be public because the public, unauthenticated
-- /display/[token] screens load ad images/videos directly by URL. All
-- uploads/deletes happen server-side via the service-role key (see
-- lib/storage/ads.ts), which bypasses RLS, so no insert/update/delete
-- policies are needed here — only the public-read flag.
--
-- Requires the bucket "common-bucket" to already exist (create it in the
-- Supabase dashboard under Storage first if this affects 0 rows).

UPDATE storage.buckets SET public = true WHERE id = 'common-bucket';
