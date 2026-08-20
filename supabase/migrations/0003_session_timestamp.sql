-- Phase 5: session timestamp + autoplay sub-mode, to support time-of-day
-- effectiveness stats and the Language Readiness Score. Both columns are
-- nullable — existing rows predate this and simply have no value, same
-- pattern as mastered_at in 0002.

alter table sessions add column started_at timestamptz;
alter table sessions add column autoplay_mode text check (autoplay_mode in ('fast', 'standard', 'speaking'));
