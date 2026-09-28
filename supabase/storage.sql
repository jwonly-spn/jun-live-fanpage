-- Public photo bucket: anyone can view, only the Edge Function (service role) writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fp-photos', 'fp-photos', true, 2097152, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];
