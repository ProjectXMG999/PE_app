-- Phase 8: per-day review ledger.
--
-- One row per local-calendar day recording whether that day's review serving
-- was cleared (backlog emptied or the daily budget spent). Powers the
-- "czysta trasa" achievement (services/achievements.ts cleanDays) with a
-- faithful, monotonic streak instead of an estimate from lastSeen.
--
-- `date` is a local-calendar day key (YYYY-MM-DD) — see src/utils/day.ts.
-- On cross-device merge the flag is OR-ed: if either device cleared the day,
-- the day counts as cleared (src/services/progressSync.ts).
create table review_ledger (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  cleared boolean not null,
  cleared_at text,
  primary key (user_id, date)
);

alter table review_ledger enable row level security;

create policy "own rows" on review_ledger for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
