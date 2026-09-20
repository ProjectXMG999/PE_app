import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  WORD_STATUSES, STUDY_MODES, AUTOPLAY_MODES, TRAIN_MODES,
} from '../types/progress'

/**
 * Four columns in the Supabase schema carry a CHECK constraint that mirrors a
 * TypeScript union. Nothing but this test connects them.
 *
 * It exists because they drifted, and the drift was expensive out of all
 * proportion to its size: `'smart'` was added to TrainMode and written by the
 * Inteligentny mode, but no migration widened the CHECK. Every such session was
 * rejected with 23514 — and because the session insert is the last write in
 * pullAndMergeProgress and its failure cleared `lastSyncedUserId`, the app
 * re-ran the doomed write and re-showed "Nie udało się zsynchronizować
 * postępu" on every boot, every tab refocus and every token refresh. The
 * offending value was a nine-character string literal, and it was invisible to
 * the compiler, to the linter and to every other test in this suite.
 *
 * Add a variant to one of the unions in types/progress.ts without a migration
 * and this test fails immediately, naming the value and the column.
 */

const MIGRATIONS = fileURLToPath(new URL('../../supabase/migrations', import.meta.url))

/** Migrations applied in order, concatenated — later files amend earlier ones
 *  (0010 drops and re-adds the train_mode constraint), so the last CHECK
 *  written for a column is the one in force. */
function migrationsInOrder(): string {
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort()
  return files.map(f => readFileSync(`${MIGRATIONS}/${f}`, 'utf8')).join('\n')
}

/**
 * The accepted values of the CHECK in force for `column`, or null if the column
 * has no value constraint at all.
 *
 * Deliberately naive about SQL: these constraints are all written as
 * `check (<column> in ('a', 'b'))` on one logical line, and a parser that only
 * understands that shape fails loudly on anything else rather than quietly
 * matching nothing.
 */
function acceptedValues(sql: string, column: string): string[] | null {
  const pattern = new RegExp(`check\\s*\\(\\s*${column}\\s+in\\s*\\(([^)]*)\\)`, 'gi')
  const matches = [...sql.matchAll(pattern)]
  if (matches.length === 0) return null
  const last = matches[matches.length - 1][1]
  return [...last.matchAll(/'([^']*)'/g)].map(m => m[1])
}

const COLUMNS: Array<[string, readonly string[]]> = [
  ['status', WORD_STATUSES],
  ['mode', STUDY_MODES],
  ['autoplay_mode', AUTOPLAY_MODES],
  ['train_mode', TRAIN_MODES],
]

describe('schema drift: every value the client can write is accepted by the database', () => {
  const sql = migrationsInOrder()

  it.each(COLUMNS)('%s', (column, union) => {
    const accepted = acceptedValues(sql, column)
    expect(accepted, `no CHECK found for ${column} — did the constraint move?`).not.toBeNull()

    // A one-directional assertion on purpose. The database accepting MORE than
    // the client can write is harmless (a retired variant, a value only a
    // server-side job writes); the client writing something the database
    // refuses is the bug this test is about.
    const rejected = union.filter(v => !accepted!.includes(v))
    expect(
      rejected,
      `${column}: the CHECK rejects ${JSON.stringify(rejected)}. ` +
      'Add a migration widening it before shipping the new variant.'
    ).toEqual([])
  })
})
