-- FlashWords database setup.
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to run again: it only creates what is missing.

create table if not exists public.decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete cascade,
  word text not null check (char_length(word) between 1 and 100),
  meaning text not null default '',
  synonyms text[] not null default '{}',
  example text,
  part_of_speech text,
  phonetic text,
  audio_url text,
  status text not null default 'new' check (status in ('new', 'learning', 'known')),
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id uuid references public.decks (id) on delete set null,
  question_type text not null,
  mode text not null,
  total int not null,
  correct int not null,
  wrong_card_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists cards_user_idx on public.cards (user_id);
create index if not exists cards_deck_idx on public.cards (deck_id);
create index if not exists decks_user_idx on public.decks (user_id);
create index if not exists quiz_results_user_idx on public.quiz_results (user_id, created_at desc);

-- Row Level Security: every user can only see and change their own rows.
alter table public.decks enable row level security;
alter table public.cards enable row level security;
alter table public.quiz_results enable row level security;

drop policy if exists "Own decks" on public.decks;
create policy "Own decks" on public.decks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own cards" on public.cards;
create policy "Own cards" on public.cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own quiz results" on public.quiz_results;
create policy "Own quiz results" on public.quiz_results
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
