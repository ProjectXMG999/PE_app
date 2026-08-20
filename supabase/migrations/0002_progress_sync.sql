-- Phase 4: progress sync. Mirrors the IndexedDB stores in src/services/db.ts
-- (snake_case columns; translation to/from the camelCase TS types happens in
-- src/services/progressSync.ts, not here). Users read/write only their own rows.

create table sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  date text not null,
  words_completed int not null,
  mode text not null check (mode in ('fiszki', 'autoplay'))
);
create index sessions_user_idx on sessions(user_id);

create table word_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  word_id text not null,
  package_id text not null,
  seen_count int not null,
  last_seen text not null,
  status text not null check (status in ('new', 'learning', 'known')),
  primary key (user_id, word_id)
);
create index word_progress_user_package_idx on word_progress(user_id, package_id);

create table package_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  package_id text not null,
  started_at text not null,
  completed_at text,
  mastered_at text,
  current_index int not null,
  primary key (user_id, package_id)
);

alter table sessions enable row level security;
alter table word_progress enable row level security;
alter table package_progress enable row level security;

create policy "own rows" on sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on word_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows" on package_progress for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
