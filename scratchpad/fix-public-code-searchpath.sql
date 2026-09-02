-- Fix: kiosk "Could not issue a ticket"
-- claim_school_token() runs with SET search_path = public, so the public_code
-- column DEFAULT (gen_school_public_code -> gen_random_bytes) can't see pgcrypto
-- in the `extensions` schema. Pin it on the function itself.
CREATE OR REPLACE FUNCTION public.gen_school_public_code() RETURNS text
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  alphabet text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  len      int  := length(alphabet);
  code     text;
  i        int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, (get_byte(gen_random_bytes(1), 0) % len) + 1, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.school_tokens WHERE public_code = code);
  END LOOP;
  RETURN code;
END;
$$;
