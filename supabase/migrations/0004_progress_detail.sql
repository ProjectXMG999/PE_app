-- Phase 6: the data foundation for the redesigned Postęp page — measured study
-- time, a review queue, and a daily time goal.
--
-- Every added column is nullable, same pattern as 0003: rows written by an older
-- client simply have no value, and an older client keeps working against this
-- schema. Translation to/from the camelCase TS types happens in
-- src/services/progressSync.ts, not here.

-- Real measured duration, replacing the words × 8 s estimate in useStats.ts.
alter table sessions add column duration_sec int;

-- Word Flash and Active Sentence both saved mode='fiszki' with no way to tell
-- them apart. 'review' is the cross-pack review queue rather than a single pack.
alter table sessions add column train_mode text
  check (train_mode in ('word-flash', 'active-sentence', 'review'));

-- Review bookkeeping. Note what is NOT here: nothing that can demote `status`.
-- A word the user once mastered stays 'known' forever — forgetting reschedules
-- it via next_review_at instead, so the route count never goes backwards.
alter table word_progress add column review_count int;
alter table word_progress add column lapse_count int;
alter table word_progress add column last_lapse_at text;
alter table word_progress add column next_review_at text;

-- Daily time ledger. Sessions only persist when a pack is finished, so this is
-- the only record of time spent in a session the user abandoned halfway.
-- `date` is a local-calendar day key (YYYY-MM-DD) — see src/utils/day.ts.
create table daily_time (
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  seconds_studied int not null,
  goal_sec int not null,
  goal_met_at text,
  primary key (user_id, date)
);

alter table daily_time enable row level security;

create policy "own rows" on daily_time for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
