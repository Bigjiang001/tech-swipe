-- Hosted Supabase can grant anon EXECUTE through default privileges.
revoke all on function public.is_owner() from anon;
