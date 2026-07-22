-- 0015_storage.sql
-- Supabase Storage buckets. Four buckets, split by sensitivity:
--
--   media          PUBLIC   product/CMS images. Served via CDN public URLs.
--   prescriptions  PRIVATE  health records. Signed URLs only, short TTL.
--   lab-reports    PRIVATE  health records. Signed URLs only, short TTL.
--   imports        PRIVATE  uploaded Excel files, retained for audit/replay.
--
-- Object access model (Supabase Auth, keyed on auth.uid()):
--
--   media          public = true handles reads; writes are service-role only.
--   prescriptions  path convention `<user_id>/<file>`: owners may upload and
--                  read their own folder (policies below). Pharmacist review
--                  reads go through the service role with an audit_log entry.
--   lab-reports    same path convention; owners READ only -- reports are
--                  uploaded by staff (service role), never by customers.
--   imports        service-role only. No policies.
--
-- Guarded on the storage schema existing, so the migration set still applies
-- on bare Postgres (CI shadow DB / local verification) where Supabase's
-- storage extension is absent.

do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present (bare Postgres) - skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    -- 2 MB: product photos; enforced again at upload in the app.
    ('media', 'media', true, 2 * 1024 * 1024,
     array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']),
    -- 10 MB: phone photos of paper prescriptions arrive large.
    ('prescriptions', 'prescriptions', false, 10 * 1024 * 1024,
     array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
    ('lab-reports', 'lab-reports', false, 10 * 1024 * 1024,
     array['application/pdf']),
    ('imports', 'imports', false, 10 * 1024 * 1024,
     array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           'application/vnd.ms-excel'])
  on conflict (id) do nothing;

  -- Owner-folder policies. (storage.foldername(name))[1] is the first path
  -- segment; the app writes objects as `<auth.uid()>/<uuid>.<ext>`.
  execute $pol$
    create policy prescriptions_upload_own on storage.objects for insert
      to authenticated
      with check (
        bucket_id = 'prescriptions'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $pol$;
  execute $pol$
    create policy prescriptions_read_own on storage.objects for select
      to authenticated
      using (
        bucket_id = 'prescriptions'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $pol$;
  execute $pol$
    create policy lab_reports_read_own on storage.objects for select
      to authenticated
      using (
        bucket_id = 'lab-reports'
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $pol$;
end $$;
