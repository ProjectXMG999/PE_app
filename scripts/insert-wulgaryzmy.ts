import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const CSV_PATH = path.join(ROOT, 'database/database/Baza Wizard (prawdopodobnie najnowsza baza, bez zdań) KOPIA  - Cała baza.csv')

// 6 packs × 10 words = 60 wulgaryzmów
const WULG: [string, string][][] = [
  // Wulgaryzmy 1
  [['Shit','Gówno, szajs'],['Bullshit','Gówno prawda'],['Fuck','Kurwa, pieprzyć'],['Fuck you!','Pierdol się'],['Damn','Cholerny, przeklęty'],['Fucking great!','Zajebiste'],['Dickhead','Kretyn'],['Son of a bitch','Sukinsyn'],['Motherfucker','Skurwysyn'],['Dick','Kutas']],
  // Wulgaryzmy 2
  [['Cock','Chuj'],['Pussy','Cipka'],['Asshole','Dupek'],['Bastard','Drań'],['Fag','Pedał'],['Bitch','Dziwka'],['Fuck off!','Odpierdol się!'],['Piss off!','Wypierdalaj!'],['Sod off!','Spierdalaj!'],['It sucks','Chujowo, do dupy']],
  // Wulgaryzmy 3
  [['It blows','Chujowo, do dupy'],['Not to give a fuck','Mieć wyjebane'],["I don't give a fuck!",'Mam wyjebane'],["I don't give a shit!",'Mam to w dupie'],['Bloody hell!','Jasna cholera!'],['Jerk','Cham'],['Cunt','Pizda'],['Slut','Dziwka'],['Ho','Dzieweczka'],['Whore','Kurwa']],
  // Wulgaryzmy 4
  [['Arsehole','Dupek'],['Wang','Fiut'],['Dong','Fiut'],['Boner','Penis w stanie erekcji'],['Hard-on','Penis w stanie erekcji'],['Tosser','Ciota'],['Wanker','Pierdolona ciota'],['Deepshit','Gnojek'],['Faggot','Pedał, cipa'],['Call-boy','Męska dziwka']],
  // Wulgaryzmy 5
  [['Fucker','Jebaniec'],['Fuckface','Jebany gnój'],['Fucknut','Pojeb'],['Hooker','Prostytutka'],['Cock-sucker','Lachociąg'],['Cum slut','Kurwa, szmata'],['Skank','Kurewka'],['Cunt rag','Szmata'],['Twat','Pizda'],['Coochy','Cipa']],
  // Wulgaryzmy 6
  [['Arse','Dupa'],['Dumbass','Debil'],['Fucktard','Pierdolony debil'],['Prat','Debil'],['Scum','Szmaciarz, lump'],['Do the dick move','Zrobić coś skurwysyńskiego'],['Assbag','Idiota'],['Shlong','Kutanga'],['Prick','Fiut'],['Weenie','Fiutek']],
]

interface Insertion {
  afterLine: number // 1-based file line number (header = line 1)
  packIdx: number
  tom: string
  rozdzial: string
  poziom: string
}

// Insert after these lines (before renumbering due to previous insertions)
// Tom I 2nd half: after Lp 600 (line 601), after Lp 740 (line 741), after Lp 890 (line 891)
// Tom II 2nd half: after Lp 1840 (line 1841), after Lp 2065 (line 2066), after Lp 2270 (line 2271)
const INSERTIONS: Insertion[] = [
  { afterLine: 601,  packIdx: 0, tom: 'Tom I',  rozdzial: 'Rozdział VII',   poziom: '1' },
  { afterLine: 741,  packIdx: 1, tom: 'Tom I',  rozdzial: 'Rozdział VIII',  poziom: '1' },
  { afterLine: 891,  packIdx: 2, tom: 'Tom I',  rozdzial: 'Rozdział IX',    poziom: '1' },
  { afterLine: 1841, packIdx: 3, tom: 'Tom II', rozdzial: 'Rozdział XVII',  poziom: '2' },
  { afterLine: 2066, packIdx: 4, tom: 'Tom II', rozdzial: 'Rozdział XIX',   poziom: '2' },
  { afterLine: 2271, packIdx: 5, tom: 'Tom II', rozdzial: 'Rozdział XX',    poziom: '2' },
]

function csvField(value: string): string {
  // Wrap in quotes if value contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

function main() {
  const content = fs.readFileSync(CSV_PATH, 'utf-8')
  const EOL = content.includes('\r\n') ? '\r\n' : '\n'
  let lines = content.split(EOL)
  console.log(`Original lines: ${lines.length}, EOL: ${EOL === '\r\n' ? 'CRLF' : 'LF'}`)

  // First: remove any previously inserted Wulgaryzmy rows (cleanup)
  lines = lines.filter(l => !l.includes(',Wulgaryzmy '))

  // Find insertion points by scanning for the pack boundary after target Lp
  // We need to insert after specific Lp values. Since we cleaned up, line numbers
  // correspond to original CSV. Find line index where Lp column matches target.
  function findLineAfterLp(targetLp: number): number {
    for (let i = 1; i < lines.length; i++) {
      const lp = parseInt(lines[i].split(',')[0])
      if (lp === targetLp) return i // insert AFTER this index
    }
    return -1
  }

  // Insert from bottom to top so indices stay valid
  const sorted = [...INSERTIONS].sort((a, b) => b.afterLine - a.afterLine)

  for (const ins of sorted) {
    // afterLine is the original 1-based line number = Lp value (since line N = Lp N-1 after header)
    const targetLp = ins.afterLine - 1 // line 601 = Lp 600
    const insertAfterIdx = findLineAfterLp(targetLp)
    if (insertAfterIdx === -1) { console.error(`Lp ${targetLp} not found!`); continue }

    const packName = `Wulgaryzmy ${ins.packIdx + 1}`
    const newRows = WULG[ins.packIdx].map(([eng, pl]) => {
      const fields = ['0', ins.poziom, ins.tom, ins.rozdzial, 'Zabronione', packName, eng, pl]
      return fields.map(csvField).join(',')
    })
    lines.splice(insertAfterIdx + 1, 0, ...newRows)
    console.log(`Inserted ${packName} (${newRows.length} rows) after Lp ${targetLp}`)
  }

  // Renumber Lp (column index 0)
  let lp = 0
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue
    lp++
    const commaIdx = lines[i].indexOf(',')
    lines[i] = String(lp) + lines[i].slice(commaIdx)
  }

  console.log(`Final lines: ${lines.length} | Total data rows: ${lp}`)
  fs.writeFileSync(CSV_PATH, lines.join(EOL), 'utf-8')
  console.log('Done — CSV updated.')
}

main()
