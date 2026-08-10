-- Migration: Add Supabase auth user reference to application users

alter table if exists users
  add column if not exists auth_uid text;

alter table if exists users
  alter column password_hash drop not null;

create unique index if not exists users_auth_uid_idx on users(auth_uid);
