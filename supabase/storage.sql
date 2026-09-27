-- Run this once in Supabase SQL Editor, after schema.sql.
-- Creates a public bucket for candidate photos (public = viewable by anyone via URL,
-- but only your service-role key, used server-side, can upload/delete into it).

insert into storage.buckets (id, name, public)
values ('candidate-photos', 'candidate-photos', true)
on conflict (id) do nothing;
