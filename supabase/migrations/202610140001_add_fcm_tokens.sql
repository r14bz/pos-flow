-- Native Firebase Cloud Messaging device tokens for SEMAR Android.
-- Apply with: supabase db push

create table if not exists public.fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid references public.stores(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fcm_tokens_user_store_idx
  on public.fcm_tokens(user_id, store_id);

alter table public.fcm_tokens enable row level security;

grant select, insert, update, delete on public.fcm_tokens to authenticated;

drop policy if exists "Users can read own FCM tokens" on public.fcm_tokens;
create policy "Users can read own FCM tokens"
  on public.fcm_tokens for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can add own FCM tokens" on public.fcm_tokens;
create policy "Users can add own FCM tokens"
  on public.fcm_tokens for insert to authenticated
  with check (
    user_id = auth.uid()
    and (
      store_id is null
      or exists (
        select 1 from public.store_memberships sm
        where sm.store_id = fcm_tokens.store_id
          and sm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can update own FCM tokens" on public.fcm_tokens;
create policy "Users can update own FCM tokens"
  on public.fcm_tokens for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      store_id is null
      or exists (
        select 1 from public.store_memberships sm
        where sm.store_id = fcm_tokens.store_id
          and sm.user_id = auth.uid()
      )
    )
  );

drop policy if exists "Users can delete own FCM tokens" on public.fcm_tokens;
create policy "Users can delete own FCM tokens"
  on public.fcm_tokens for delete to authenticated
  using (user_id = auth.uid());
