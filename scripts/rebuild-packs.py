"""
Jednorazowy skrypt:
1. Usuwa paczki kategorii "Klony" (t1-p081, t1-p126)
2. Wstawia 6 paczek "Wulgaryzmy" w odpowiednie miejsca poziomów
3. Przenumerowuje wszystkie paczki sekwencyjnie od t1-p001
4. Aktualizuje pliki JSON paczek — strategia: wczytaj wszystko do RAM, wyczyść katalog, zapisz
"""
import json, os, shutil, subprocess, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PACKS = os.path.join(ROOT, 'src', 'data', 'packs')
INDEX_PATH = os.path.join(ROOT, 'src', 'data', 'packages-index.json')

# ── Dane nowych paczek Wulgaryzmy ─────────────────────────────────────────────

WULGARYZMY_WORDS = [
    [
        ("shit", "gówno, szajs"),
        ("bullshit", "gówno prawda"),
        ("fuck", "kurwa, pieprzyć"),
        ("fuck you!", "pierdol się"),
        ("damn", "cholerny, przeklęty"),
        ("fucking great!", "zajebiste"),
        ("dickhead", "kretyn"),
        ("son of a bitch", "sukinsyn"),
        ("motherfucker", "skurwysyn"),
        ("dick", "kutas"),
    ],
    [
        ("cock", "chuj"),
        ("pussy", "cipka"),
        ("asshole", "dupek"),
        ("bastard", "drań"),
        ("fag", "pedał"),
        ("bitch", "dziwka"),
        ("fuck off!", "odpierdol się!"),
        ("piss off!", "wypierdalaj!"),
        ("sod off!", "spierdalaj!"),
        ("it sucks", "chjujowo, do dupy"),
    ],
    [
        ("it blows", "chujowo, do dupy"),
        ("not to give a fuck", "mieć wyjebane"),
        ("I don't give a fuck!", "mam wyjebane"),
        ("I don't give a shit!", "mam to w dupie"),
        ("bloody hell!", "jasna cholera!"),
        ("jerk", "cham"),
        ("cunt", "pizda"),
        ("slut", "dziwka"),
        ("ho", "dziweczka"),
        ("whore", "kurwa"),
    ],
    [
        ("arsehole", "dupek"),
        ("wang", "fiut"),
        ("dong", "fiut"),
        ("assbag", "idiota"),
        ("shlong", "kutanga"),
        ("prick", "fiut"),
        ("weenie, wiener", "fiutek"),
        ("boner", "penis w stanie erekcji"),
        ("hard-on", "penis w stanie erekcji"),
        ("tosser", "ciota"),
    ],
    [
        ("wanker", "pierdolona ciota"),
        ("deepshit", "gnojek"),
        ("faggot", "pedał, cipa"),
        ("call-boy", "męska dziwka"),
        ("fucker", "jebaniec"),
        ("fuckface", "jebany gnój"),
        ("fucknut", "pojeb"),
        ("hooker", "prostytutka"),
        ("cock-sucker", "lachociąg"),
        ("cum slut", "kurwa, szmata"),
    ],
    [
        ("skank", "kurewka"),
        ("cunt rag", "szmata"),
        ("twat", "pizda"),
        ("coochy, coochie", "cipa"),
        ("arse", "dupa (brit)"),
        ("dumbass", "debil"),
        ("fucktard", "pierdolony debil"),
        ("prat", "debil"),
        ("scum", "szmaciarz, lump"),
        ("do the dick move", "zrobić coś skurwysyńskiego"),
    ],
]

WULGARYZMY_META = [
    {"name": "Wulgaryzmy 1", "level": 1, "volume": "Tom I",  "chapter": "Rozdział X"},
    {"name": "Wulgaryzmy 2", "level": 1, "volume": "Tom I",  "chapter": "Rozdział X"},
    {"name": "Wulgaryzmy 3", "level": 1, "volume": "Tom I",  "chapter": "Rozdział X"},
    {"name": "Wulgaryzmy 4", "level": 2, "volume": "Tom II", "chapter": "Rozdział XVIII"},
    {"name": "Wulgaryzmy 5", "level": 2, "volume": "Tom II", "chapter": "Rozdział XVIII"},
    {"name": "Wulgaryzmy 6", "level": 2, "volume": "Tom II", "chapter": "Rozdział XVIII"},
]

# ── 1. Wczytaj indeks ─────────────────────────────────────────────────────────

with open(INDEX_PATH, encoding='utf-8') as f:
    packs = json.load(f)
print(f"Loaded index: {len(packs)} packs")

# ── 2. Wczytaj WSZYSTKIE pliki paczek do RAM ──────────────────────────────────

pack_data_by_id = {}
for fname in os.listdir(SRC_PACKS):
    if not fname.endswith('.json'):
        continue
    fpath = os.path.join(SRC_PACKS, fname)
    with open(fpath, encoding='utf-8') as f:
        data = json.load(f)
    pack_data_by_id[data['id']] = data

print(f"Loaded {len(pack_data_by_id)} pack JSON files into RAM")

# ── 3. Usuń Klony z indeksu ───────────────────────────────────────────────────

KLONY_IDS = {"t1-p081", "t1-p126"}
packs = [p for p in packs if p['id'] not in KLONY_IDS]
print(f"After removing Klony: {len(packs)} packs")

# ── 4. Wstaw Wulgaryzmy (jako placeholdery) ───────────────────────────────────

# Wulgaryzmy 1-3 po p009, p010, p011
# Wulgaryzmy 4 po p112, Wulgaryzmy 5 po p133
# Wulgaryzmy 6 po ostatniej paczce level 2

INSERT_AFTER_ID = {
    "t1-p009": 0,
    "t1-p010": 1,
    "t1-p011": 2,
    "t1-p112": 3,
    "t1-p133": 4,
}

last_l2_idx = max(i for i, p in enumerate(packs) if p['level'] == 2)

new_packs = []
for i, p in enumerate(packs):
    new_packs.append(p)
    if p['id'] in INSERT_AFTER_ID:
        wul_i = INSERT_AFTER_ID[p['id']]
        m = WULGARYZMY_META[wul_i]
        new_packs.append({"id": f"__wul_{wul_i}__", "name": m["name"],
                           "volume": m["volume"], "level": m["level"],
                           "category": "Wulgaryzmy", "wordCount": 10, "chapter": m["chapter"]})
    if i == last_l2_idx:
        m = WULGARYZMY_META[5]
        new_packs.append({"id": "__wul_5__", "name": m["name"],
                           "volume": m["volume"], "level": m["level"],
                           "category": "Wulgaryzmy", "wordCount": 10, "chapter": m["chapter"]})

print(f"After insertions: {len(new_packs)} packs")

# ── 5. Przenumeruj i zbuduj mapę old→new ─────────────────────────────────────

old_to_new = {}
for i, p in enumerate(new_packs):
    new_id = f"t1-p{str(i+1).zfill(3)}"
    old_to_new[p['id']] = new_id
    p['id'] = new_id

print(f"Last ID: {new_packs[-1]['id']}")

# ── 6. Wyczyść katalog src/data/packs/ (tylko 3-cyfrowe t1-pXXX.json) ─────────

removed = 0
for fname in os.listdir(SRC_PACKS):
    if re.match(r'^t1-p\d{3}\.json$', fname):
        os.remove(os.path.join(SRC_PACKS, fname))
        removed += 1
print(f"Cleared {removed} old 3-digit pack files from src/data/packs/")

# ── 7. Zapisz wszystkie paczki z nowymi ID ────────────────────────────────────

wul_created = 0
for p in new_packs:
    new_id = p['id']
    orig_id = next(old for old, new in old_to_new.items() if new == new_id)

    if orig_id.startswith("__wul_"):
        # Nowa paczka Wulgaryzmy
        wul_i = int(orig_id.strip("__").replace("wul_", ""))
        words = []
        for j, (eng, pol) in enumerate(WULGARYZMY_WORDS[wul_i]):
            wid = f"{new_id}-{str(j+1).zfill(3)}"
            words.append({
                "id": wid,
                "english": eng,
                "polish": pol,
                "sentenceEn": None,
                "sentencePl": None,
                "audioWord": f"{wid}-word.mp3",
                "audioSentence": f"{wid}-sentence.mp3",
            })
        data = {"id": new_id, "name": p["name"], "volume": p["volume"],
                "level": p["level"], "category": "Wulgaryzmy",
                "chapter": p["chapter"], "words": words}
        wul_created += 1
    else:
        data = pack_data_by_id.get(orig_id)
        if data is None:
            print(f"  WARNING: no data for orig_id={orig_id}, skipping")
            continue

        # Zaktualizuj ID paczki
        data['id'] = new_id

        # Zaktualizuj ID słów i ścieżki audio
        for word in data.get('words', []):
            parts = word['id'].rsplit('-', 1)
            if len(parts) == 2:
                word['id'] = f"{new_id}-{parts[1]}"
            for ak in ['audioWord', 'audioSentence', 'audioWordPl', 'audioSentencePl']:
                if ak in word and word[ak]:
                    ap = word[ak].rsplit('-', 2)
                    if len(ap) == 3:
                        word[ak] = f"{new_id}-{ap[1]}-{ap[2]}"

    out_path = os.path.join(SRC_PACKS, f"{new_id}.json")
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Created {wul_created} Wulgaryzmy packs")

# ── 8. Zapisz nowy indeks ─────────────────────────────────────────────────────

with open(INDEX_PATH, 'w', encoding='utf-8') as f:
    json.dump(new_packs, f, ensure_ascii=False, indent=2)

# Weryfikacja
wul_in_index = [p for p in new_packs if p['category'] == 'Wulgaryzmy']
print(f"\nIndex saved: {len(new_packs)} packs total")
print(f"Wulgaryzmy in index: {[(p['id'], p['name'], p['level']) for p in wul_in_index]}")

# ── 9. Sync do public/ ────────────────────────────────────────────────────────

print("\nRunning sync-packs...")
result = subprocess.run(["node", "scripts/sync-packs.mjs"], cwd=ROOT,
                        capture_output=True, text=True)
print(result.stdout.strip())
if result.stderr:
    print("STDERR:", result.stderr[:200])

print("\nDone!")
