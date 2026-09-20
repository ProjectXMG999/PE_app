-- Phase 9: "Oznacz cały poziom jako opanowany".
--
-- Two nullable timestamps on word_progress, same additive pattern as
-- 0005/0006 — a row from an older client simply has no value.
--   declared_known_at   — status:'known' was asserted by a bulk declaration
--                          (pack "Znam wszystko" or level mastery), not
--                          earned by actually answering the word. Cleared on
--                          any real review/lapse. See src/services/review.ts.
--   declared_retired_at — retired_at was forced by a level-mastery
--                          declaration rather than earned via durable FSRS
--                          stability.
--
-- The undo snapshot itself (services/db.ts `levelMastery` store) is
-- deliberately NOT mirrored here — it stays local to the device that made
-- the declaration. camelCase translation lives in src/services/progressSync.ts.
alter table word_progress add column declared_known_at timestamptz;
alter table word_progress add column declared_retired_at timestamptz;
