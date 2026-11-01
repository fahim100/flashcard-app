-- FlashWords v2 update: smart review, Bangla meaning, delete account.
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to run again.

-- Bangla meaning
alter table public.cards add column if not exists meaning_bn text;

-- Smart review (spaced repetition) schedule
alter table public.cards add column if not exists due_at timestamptz not null default now();
alter table public.cards add column if not exists interval_days real not null default 0;
alter table public.cards add column if not exists ease real not null default 2.5;
alter table public.cards add column if not exists reps int not null default 0;
alter table public.cards add column if not exists lapses int not null default 0;
create index if not exists cards_due_idx on public.cards (user_id, due_at);

-- Lets a signed-in user delete their own account (their decks, cards and
-- quiz results are removed with it through "on delete cascade").
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

-- Make the API see the new columns right away.
notify pgrst, 'reload schema';
