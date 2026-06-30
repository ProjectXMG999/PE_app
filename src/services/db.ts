import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { Session, WordProgress, PackageProgress } from '../types/progress'

interface PEDB extends DBSchema {
  sessions: {
    key: number
    value: Session
    indexes: { 'by-date': string; 'by-package': string }
  }
  wordProgress: {
    key: string
    value: WordProgress
    indexes: { 'by-package': string }
  }
  packageProgress: {
    key: string
    value: PackageProgress
  }
}

let dbPromise: Promise<IDBPDatabase<PEDB>> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PEDB>('PE_DB', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true })
          sessions.createIndex('by-date', 'date')
          sessions.createIndex('by-package', 'packageId')

          const wordProgress = db.createObjectStore('wordProgress', { keyPath: 'wordId' })
          wordProgress.createIndex('by-package', 'packageId')

          db.createObjectStore('packageProgress', { keyPath: 'packageId' })
        }
        // v2: masteredAt field — no store changes needed, field is optional and added at write time
      },
    })
  }
  return dbPromise
}

export async function saveSession(session: Omit<Session, 'id'>): Promise<void> {
  const db = await getDB()
  await db.add('sessions', session as Session)
}

export async function getSessions(days = 7): Promise<Session[]> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return all.filter(s => s.date >= cutoffStr)
}

export async function getAllSessions(): Promise<Session[]> {
  const db = await getDB()
  return db.getAll('sessions')
}

export async function saveWordProgress(wp: WordProgress): Promise<void> {
  const db = await getDB()
  await db.put('wordProgress', wp)
}

export async function getPackageWordProgress(packageId: string): Promise<WordProgress[]> {
  const db = await getDB()
  return db.getAllFromIndex('wordProgress', 'by-package', packageId)
}

export async function getTotalKnownWords(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('wordProgress')
  return all.filter(w => w.status === 'known').length
}

export async function savePackageProgress(pp: PackageProgress): Promise<void> {
  const db = await getDB()
  await db.put('packageProgress', pp)
}

export async function getPackageProgress(packageId: string): Promise<PackageProgress | undefined> {
  const db = await getDB()
  return db.get('packageProgress', packageId)
}

export async function getAllPackageProgress(): Promise<PackageProgress[]> {
  const db = await getDB()
  return db.getAll('packageProgress')
}

export async function resetAllProgress(): Promise<void> {
  const db = await getDB()
  await Promise.all([
    db.clear('wordProgress'),
    db.clear('packageProgress'),
    db.clear('sessions'),
  ])
}

export async function resetProgressForPackages(packageIds: string[]): Promise<void> {
  const db = await getDB()
  const tx1 = db.transaction('packageProgress', 'readwrite')
  await Promise.all(packageIds.map(id => tx1.store.delete(id)))
  await tx1.done

  const allWords = await db.getAll('wordProgress')
  const toDelete = allWords.filter(w => packageIds.includes(w.packageId)).map(w => w.wordId)
  const tx2 = db.transaction('wordProgress', 'readwrite')
  await Promise.all(toDelete.map(id => tx2.store.delete(id)))
  await tx2.done

  const allSessions = await db.getAll('sessions')
  const sessionsToDelete = allSessions.filter(s => packageIds.includes(s.packageId) && s.id != null).map(s => s.id!)
  const tx3 = db.transaction('sessions', 'readwrite')
  await Promise.all(sessionsToDelete.map(id => tx3.store.delete(id)))
  await tx3.done
}

export async function getStreak(): Promise<number> {
  const db = await getDB()
  const all = await db.getAll('sessions')
  if (all.length === 0) return 0

  const dates = [...new Set(all.map(s => s.date))].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Streak only counts if user studied today or yesterday
  if (dates[0] !== today && dates[0] !== yesterday) return 0

  let streak = 0
  let expected = dates[0] // start from most recent date

  for (const date of dates) {
    if (date === expected) {
      streak++
      // compute previous day
      const d = new Date(expected + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - 1)
      expected = d.toISOString().split('T')[0]
    } else {
      break
    }
  }
  return streak
}
