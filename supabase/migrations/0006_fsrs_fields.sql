-- Phase 8: FSRS scheduler.
--
-- Each word gains two numbers modelling its memory (see src/services/fsrs.ts):
--   stability  — days for recall probability to fall to the request retention
--   difficulty — 1..10, how intrinsically hard the word is
--
-- Nullable `real`, same pattern as 0004/0005: a row from an older client simply
-- has no value and the scheduler falls back to the interval ladder. camelCase
-- translation lives in src/services/progressSync.ts.
alter table word_progress add column stability real;
alter table word_progress add column difficulty real;
