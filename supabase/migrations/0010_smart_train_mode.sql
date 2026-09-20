-- The Inteligentny mode was never allowed into the schema.
--
-- 0004 added `train_mode` with a CHECK listing the three exercises that existed
-- at the time. `smart` was later added to the TrainMode union in
-- src/types/progress.ts (the Inteligentny mixed cross-pack queue) and written
-- by src/pages/SmartSessionPage.tsx — but no migration ever widened the CHECK.
-- IndexedDB is schemaless and took the row happily, so nothing surfaced
-- locally.
--
-- The consequence was not a lost session, it was a recurring alarm. The session
-- insert is the LAST write in pullAndMergeProgress (src/services/progressSync.ts)
-- — all four upserts that carry actual learning progress land before it — so
-- every merge did its real work and then died on 23514. The catch in
-- useAuthStore.ts toasts "Nie udało się zsynchronizować postępu" and clears
-- `lastSyncedUserId`, which re-arms the retry; supabase-js emits
-- onAuthStateChange on every boot, every tab refocus and every hourly token
-- refresh. So: one toast per app open, forever, for a write with a 0% chance of
-- ever succeeding.
--
-- The constraint name is the one Postgres generates for a column-level CHECK on
-- `train_mode`; `if exists` keeps this migration idempotent if it was ever
-- renamed by hand.
alter table sessions drop constraint if exists sessions_train_mode_check;
alter table sessions add constraint sessions_train_mode_check
  check (train_mode in ('word-flash', 'active-sentence', 'review', 'smart'));
