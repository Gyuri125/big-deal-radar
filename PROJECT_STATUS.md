# Big-deal radar – projektállapot és AI handoff

> **Utolsó frissítés:** 2026-11-22  
> **Aktuális commit:** `2a9d551`  
> **Élő oldal:** https://gyuri125.github.io/big-deal-radar/  
> **Repo:** https://github.com/Gyuri125/big-deal-radar
>
> Ez a fájl a projekt teljes átadási dokumentuma. Ha egy AI agent (pl. Gemini) folytatja a fejlesztést, **ezt olvassa el először**, utána a `README.md`-t.

---

## 0. Hogyan dolgozz ezen a projekten?

### Alapszabályok

- A felület és a tartalom **magyar nyelvű**.
- **Ne találj ki dátumot, árat vagy akciót.** Ha bizonytalan, használj `needs-check` státuszt, és írd a megjegyzésbe, hogy becsült/még nem hivatalos.
- Minden dealhez legyen **legalább egy valós forrás**. A keresőlink nem elfogadható egyedüli forrásként.
- A dátum nélküli, folyamatos/heti dealeknél **ne erőltess naptári dátumot**, ha nincs értelme.
- A `data/deals.json` **generált fájl**. Kézi szerkesztés helyett a markdown + `data/overrides.json` + `data/sources.json` legyen a forrás.
- A projekt **statikus GitHub Pages oldal**, nincs backend, nincs felhasználói fiók, nincs push/e-mail értesítés.
- A felhasználó kifejezetten kérte, hogy **ne legyen naptár-feliratkozás** (webcal/ICS subscription). Egyedi ICS letöltés és Google Naptár link van, feliratkoztatható naptár nincs.
- Őrizd meg a meglévő **sötét módot, akadálymentességet, mobilnézetet, URL-szinkront és forrás-ellenőrzést**.
- Titkot soha ne commits! Csak `.env` lokálisan és GitHub Secrets.

### Kötelező ellenőrzések módosítás után

```bash
npm run import
npm run lint
npm test
npm run check:links
npm run check:secrets
npm run build
```

Ha az élő oldalt is ellenőrizni akarod:

```bash
SITE_URL=https://gyuri125.github.io/big-deal-radar/ npm run check:live
```

Windows PowerShellben:

```powershell
$env:SITE_URL='https://gyuri125.github.io/big-deal-radar/'; npm run check:live
```

### Definition of Done

- A build sikeres.
- A tesztek zöldek.
- Nincs törött link (a botblokkolt oldalak külön kategóriába eshetnek).
- Nincs titok a repóban.
- Új dealnél van forrás, és lehetőleg dátum/ár/foglalási info.
- A UI magyar, mobilnézetben is használható, sötét módban is olvasható.
- Commit után a GitHub Actions zöld; deploy után az élő smoke test is zöld.

---

## 1. Mi ez a projekt?

A **Big-deal radar** egy statikus, GitHub Pagesen futó magyar/budapesti deal-radar. Célja, hogy **időben elkapható, nagy dobásokat** gyűjtsön egy helyre:

- mozi, színház, múzeum, gasztro, programok,
- ingyenes vagy erősen kedvezményes lehetőségek,
- ünnepek, évfordulók, szülinapok,
- utazás, vásárlás, pénzügyi támogatások, egészség, családi programok.

Nem a napi aprókedvezményekre fókuszál, hanem az évente visszatérő vagy rövid ablakos, nagy értékű dealekre.

### Felhasználói preferenciák

- Elsődlegesen **Budapest / Magyarország**.
- Kiemelt: **étel, mozi, programok, ünnepek/évfordulók, ingyenes dealek**.
- Fontos az **előrejelzés**: dátum, foglalásnyílás, naptár-emlékeztető, prioritás, daily digest.
- Fontos a **szép, átlátható, magyar felület**.
- Legyen minden dealnél **valós forrás**, lehetőleg több is.
- Legyen **sötét mód**, mobilbarát nézet, gyors keresés, szűrők, gyűjtemények.
- Ne legyen naptár-feliratkozás.

---

## 2. Jelenlegi állapot számokban

| Mutató | Érték |
|---|---:|
| Deal | **106** |
| Forrásbejegyzés | **152** |
| Dátumos deal | **57** |
| Ellenőrzött deal | **106** |
| Jegy / foglalás linkkel rendelkező deal | **25** |
| Keresőlinkes deal | **0** |
| Egyedi ellenőrzött link | **138** |
| OK link | **116** |
| Átirányított link | **24** |
| Botblokkolt link | **17** |
| Elérhetetlen link | **5** |
| Törött link (HTTP-hiba) | **0** |
| Gyűjteményoldal | **8** |
| RSS elem | **55** |
| Figyelt hivatalos forrás | **15** |
| Teszt | **43/43 zöld** |

### Fontos értelmezés

- **Ellenőrzött** = legalább egy forrás elérhető (200/3xx), nem keresőlink, és a deal szerepel rajta. Ez nem garancia arra, hogy az ár/dátum a jövőben is ugyanaz.
- A `status.json` `booking` mezője a szélesebb foglalási szekció mérete (jelenleg 2): 30 napon belüli esemény `booking_url`-lel, a közeli foglalásnyílások kivételével. A `bookingOpens` mező külön a 14 napon belüli `booking_opens` száma (jelenleg 0); csak ez indít sürgős digestet, és külön digest-szekciót kap.
- A 49 dátum nélküli deal többsége **folyamatos, heti vagy napi** jellegű; ezeknél szándékosan nincs naptári dátum.
- A becsült dátumokat a UI `(becsült)` jelöléssel mutatja.

---

## 3. Élő URL-ek

| Cél | URL |
|---|---|
| Főoldal | https://gyuri125.github.io/big-deal-radar/ |
| RSS | https://gyuri125.github.io/big-deal-radar/feed.xml |
| Státusz | https://gyuri125.github.io/big-deal-radar/status.json |
| Gyűjtemények | https://gyuri125.github.io/big-deal-radar/gyujtemeny/ |
| Forrás-egészség | https://gyuri125.github.io/big-deal-radar/forrasok/ |
| Egy deal oldala | `https://gyuri125.github.io/big-deal-radar/deal/<deal-id>/` |
| Sitemap | https://gyuri125.github.io/big-deal-radar/sitemap.xml |

### Legutóbbi deploy

- Utolsó ismert sikeres deploy commit: `2a9d551` (Pages: `45053698557`, CI: `45053698569`).
- A P0 audit/refaktor és a linkellenőrzés javítása a `main` ágra kerül; a Pages deploy a push után automatikusan indul.

---

## 4. Tech stack

- **Node.js 24**
- **TypeScript**
- **Vite 8**
- **Vitest** tesztek
- **Sharp** OG képekhez
- **Zod** validációhoz
- **Vanilla TS** frontend, nincs React/Vue
- **GitHub Pages** statikus hosting
- **GitHub Actions** pipeline, deploy, link check, source monitor
- **PWA** service workerrel
- **localStorage** a saját listához, prioritáshoz és témához

Nincs adatbázis, nincs szerver, nincs felhasználói fiók.

---

## 5. Architektúra és adatfolyam

```text
Markdown deal-lista
      +
data/overrides.json
data/sources.json
data/tags.json
data/titles.json
data/price-notes.json
data/meta.json
      │
      ▼
npm run import  →  data/deals.json
      │
      ▼
Vite build  →  dist/
      ├─ főoldal (SPA)
      ├─ 106 statikus deal-oldal
      ├─ 8 gyűjteményoldal
      ├─ forrás-egészség oldal
      ├─ OG képek
      ├─ sitemap.xml
      ├─ feed.xml (RSS)
      └─ PWA manifest + sw.js
      │
      ▼
GitHub Pages
```

### Napi pipeline

- Laptopon: 08:00 / 12:00 / 20:00 helyi idő, `--no-notify` adatfrissítés és commit.
- GitHub Actions: 07:00 / 11:00 / 19:00 UTC (télen 08/12/20 Budapest; nyáron 09/13/21 helyi), ez az elsődleges digestküldő.
- A pipeline importál, validál, digestet küld Discordra, frissíti a státuszt, buildel, deployol, és ha kell, adatot commitol.

### Hibrid működés

- A laptopos Task Scheduler `npm run import` + `npm run daily -- --commit --no-notify` módban fut: adatot generál és commitol, de nem küld digestet.
- A GitHub Actions az elsődleges digestküldő, és akkor is lefut, ha a laptop ki van kapcsolva.
- A közös `data/digest-state.json` ledger megakadályozza, hogy ugyanaz a reggeli vagy sürgős digest kétszer menjen ki.
- Csak akkor commitol adatot, ha tényleg változott.

---

## 6. Mappastruktúra

```text
.github/
  workflows/
    pipeline.yml        # napi radar + deploy
    deploy.yml          # push → build → deploy → smoke test
    ci.yml              # lint, teszt, titokellenőrzés, build
    link-check.yml      # heti linkellenőrzés + link-status commit
    source-monitor.yml  # heti forrásfigyelés + GitHub Issue
  ISSUE_TEMPLATE/
    new-deal.yml        # új deal javaslat űrlap
    data-error.yml      # hibás adat/link űrlap
    config.yml

data/
  deals.json            # GENERÁLT – ne szerkeszd kézzel
  overrides.json        # dealenkénti dátum/ár/foglalás/felülírás
  sources.json          # dealenkénti források
  tags.json             # program / ünnepi / egyéb címkék
  titles.json           # megjelenő címek (ID stabil marad)
  price-notes.json      # ármagyarázatok
  meta.json             # utolsó ellenőrzés dátuma
  digest-state.json     # commitolt digest-slot ledger (laptop + Actions)
  link-status.json      # legutóbbi linkellenőrzés eredménye
  source-monitor.json   # figyelt hivatalos oldalak
  source-hashes.json    # forrásoldalak szöveg-hash/elemhalmaz
  source-monitor-report.json
  state.json            # generált, gitignore-olt

public/
  favicon.svg
  manifest.webmanifest
  robots.txt
  sw.js
  status.json           # generált, gitignore-olt

scripts/
  import-markdown.ts    # markdown + JSON → deals.json
  build-deal-pages.ts   # deal-oldalak, gyűjtemények, forrásoldal, OG, sitemap, RSS
  check-links.ts        # linkellenőrzés + link-status.json
  check-secrets.ts      # titokszivárgás-ellenőrzés
  smoke-test.ts         # élő oldal ellenőrzése deploy után
  monitor-sources.ts    # 15 hivatalos forrás figyelése
  write-monitor-issue.ts# GitHub Issue szöveg a változásokból
  daily.ps1             # Windows Task Scheduler belépő

src/
  cli.ts                # napi pipeline CLI
  config.ts             # .env + Zod
  types.ts              # Deal típusok
  pipeline/             # load, digest, schemas, notify-schedule
  notifiers/            # discord, telegram
  site/
    main.ts             # teljes frontend logika
    style.css           # teljes design
    watchlist.ts        # localStorage saját lista
  utils/                # dátumok, ICS, logger

docs/
  preview.png           # világos előnézet
  preview-dark.png      # sötét előnézet
  search-preview.png    # természetes nyelvű keresés
  sources-preview.png   # forrás-egészség

budapesti-100-big-deal.md  # emberi deal-lista, innen jönnek az alap dealek
README.md                  # részletes magyar dokumentáció
```

---

## 7. Adatmodell

A `Deal` fő mezői (`src/types.ts`):

- `id` – stabil slug, a title-ből generálva.
- `title` – megjelenő név.
- `category` – mozi, kultura, muzeum, gasztro, utazas, vasarlas, penzugy, egeszseg, csalad, egyeb.
- `type` – flat, free, sale, money, access.
- `timing` – emberi időpont szöveg.
- `date_start`, `date_end` – ISO dátum vagy null.
- `booking_opens` – foglalásnyílás dátuma vagy null.
- `month`, `months` – szezonális hónapok.
- `recurrence` – annual, monthly, weekly, daily, continuous, oneoff.
- `deal` – rövid leírás.
- `normal_price`, `deal_price`, `price_note`.
- `location` – Budapest, Balaton, Siófok, Országos, Online, stb.
- `source_url`, `booking_url`, `booking_note`.
- `sources[]` – label, url, type (official/ticket/article/search).
- `confidence` – verified / needs-check / unverified.
- `last_checked` – ISO dátum.
- `tags[]`, `notes`, `featured`.

### Fontos generálási szabályok

- `date_start`/`date_end` a `data/overrides.json`-ból jön.
- `last_checked` a `data/meta.json` `last_checked` értékéből jön, ha a deal verified.
- A `sources` a `data/sources.json` + markdown + `source_url`/`booking_url` alapján áll össze.
- A `tags` a `data/tags.json` + kategória/típus alapján áll össze.
- A `deals.json`-t **ne** szerkeszd kézzel, mert az import felülírja.

---

## 8. Hogyan kerül be egy új deal?

1. **Markdown sor hozzáadása** a `budapesti-100-big-deal.md` megfelelő szekciójában:
   ```markdown
   | 107 | Új deal neve | 2027. május 1–2. | Rövid, konkrét leírás. |
   ```
   A parser a szekció alapján ad kategóriát/típust. Ha új szekció kell, a `scripts/import-markdown.ts` `SECTION_MAP`-jébe is fel kell venni.

2. **Források** a `data/sources.json`-ba:
   ```json
   "uj-deal-neve": [
     { "label": "Hivatalos oldal", "url": "https://...", "type": "official" },
     { "label": "Cikk", "url": "https://...", "type": "article" }
   ]
   ```

3. **Dátum/ár/foglalás/felülírás** a `data/overrides.json`-ba:
   ```json
   "uj-deal-neve": {
     "date_start": "2027-05-01",
     "date_end": "2027-05-02",
     "booking_url": "https://...",
     "booking_note": "A jegyek a hivatalos oldalon...",
     "confidence": "verified",
     "notes": "2027. május 1–2., ...",
     "tags": ["program", "unnep"]
   }
   ```

4. Ha kell:
   - `data/titles.json` – szebb megjelenő cím, ID változatlan.
   - `data/tags.json` – program/ünnep/stb. címkék.
   - `data/price-notes.json` – ármagyarázat.

5. Futtasd:
   ```bash
   npm run import
   npm run check:links
   npm run lint
   npm test
   npm run build
   ```

6. Ellenőrizd a forrást böngészőben is. Ha a dátum/ár bizonytalan, maradjon `needs-check`, és a notesban legyen indoklás.

7. Commit + push. A deploy workflow zöld kell legyen.

### Új figyelt forrás hozzáadása

- `data/source-monitor.json`:
  ```json
  { "label": "Forrás neve", "url": "https://...", "threshold": 0.9 }
  ```
- Futtasd kétszer:
  ```bash
  npm run monitor:sources
  npm run monitor:sources
  ```
- Az első futás baseline-t épít, a második már összehasonlít. Ha nincs változás, commitold a `data/source-hashes.json` és `data/source-monitor-report.json` fájlokat.

---

## 9. Források és ellenőrzés

### Linkellenőrzés

- `npm run check:links`
- Eredmény: `data/link-status.json`.
- A 401/403/429/511/520–524 státuszok **botblokknak** számítanak, nem törött linknek.
- Átmeneti hálózati hibánál a checker **háromszor próbálkozik**, növekvő várakozással.
- A tartósan `ERR` link **elérhetetlen** kategóriába kerül: látszik a forrás-egészség oldalon és a logban, de nem buktatja meg a workflow-t. Csak a valódi HTTP-hiba (pl. 404) fail.
- A heti `link-check.yml` commitolja a `link-status.json`-t.
- A `forrasok/` oldal ebből generálódik, külön „elérhetetlen” összesítővel.

### Forrásfigyelés

- 15 kiemelt hivatalos oldal (Cinema City, Restaurant Week, Müpa, SZIGET, állatkert, fesztiválok, múzeumok, színházak).
- `data/source-hashes.json`-ban szövegszó-halmazt tárol, nem nyers HTML-t.
- **Jaccard-hasonlóságot** használ, így a dinamikus oldalak apró változásai nem generálnak hamis riasztást.
- Alap küszöb 0.9; Cinema City 0.75, Müpa 0.85, SZIGET 0.85.
- Változás vagy hiba esetén a `source-monitor.yml` GitHub Issue-t nyit (deduplikálva).
- A heti futás hétfőn 08:00 UTC.

### Jelenlegi botblokkolt linkek

- SPAR Budapest Maraton régi nevezési oldala (520)
- Alza (403)
- BSI (403)
- eMAG (511)
- Mobilityweek (403)
- NNK (403)
- Revolut (403)
- Szállás.hu (403)
- Szállás.hu/Balaton (403)
- Too Good To Go .hu (429)

Ezek böngészőből jellemzően elérhetők; a fontosabb dealekhez alternatív, 200-as forrás is bekerült.

---

## 10. Funkciók

### Főoldal

- **Mai dobás** – kiemelt aktuális deal.
- **Hero sürgősségi sáv** – hány deal zárul hamarosan, „Mutasd” gombbal.
- **Heti top 5** – szerkesztői válogatás.
- **Ezen a hétvégén** – szombat–vasárnapra ajánlott dealek.
- **Most és a következő 7 napban** – aktuális és közeli események.
- **Neked ajánlott** – a saját lista alapján, ha van követett deal.
- **Havi radar** – az aktuális hónap eseményei.
- **Teljes kínálat** – lapozható lista.
- **Adatállapot** panel – deal/forrás/dátum/ellenőrzött/jegy/keresőlink számok.

### Keresés

- Ékezetfüggetlen: „muzeum” → „Múzeum”.
- Szinonimák: mozi/film, ingyen/ingyenes/free, randi, szülinap/évforduló, gasztro/étterem, utazás/nyaralás, pénz/támogatás stb.
- **Természetes nyelvű keresés**:
  - „ingyenes mozi hétvégén”
  - „randi 10 ezer alatt”
  - „családi program vasárnap”
  - „borfesztivál 2027”
- A találatok felett **értelmezés** látszik: `Ingyenes · Mozi · Hétvége`.
- Találati kiemelés a kártyákon.
- `/` gyorskeresés, Escape törli.
- A query az URL-ben marad.

### Szűrők

- **Nekem**: Mozi, Ételek, Programok, Ünnepek, Ingyenes.
- **Mikor**: Ma, Hétvége, Szombat, Vasárnap, 7 nap, Hamarosan zárul.
- **Ár**: Ingyenes, 5 ezer alatt, 10 ezer alatt, 10 ezer felett.
- **Típus**: Prémium, Ingyenes, Akció, Pénzügy, Hozzáférés.
- **Saját lista**.
- **Kategória**: Mozi, Kultúra, Múzeum, Gasztronómia, Utazás, Vásárlás, Pénzügy, Egészség, Család.
- **Helyszín** és **Rendezés**.
- **Aktív szűrőchipek** – külön törölhetők, „Összes törlése” gombbal.
- Minden szűrő, nézet és téma az URL-ben marad.

### Saját lista

- Csillagozás, 1–3 prioritás.
- `localStorage`, regisztráció nélkül.
- **Költségösszesítő**: követett dealek, ismert ár, becsült megtakarítás, ingyenes dealek.
- Saját lista naptárba (ICS).

### Naptár

- Lista / Naptár nézet.
- Havi nézet, előző/következő hónap, „Ma”.
- Hónap naptárba (ICS).
- Következő 7 nap naptárba.
- Egyedi deal ICS, 14/7/1/0 nappal előtti emlékeztetőkkel.
- **Google Naptár link** egyedi dealhez.
- **Nincs naptár-feliratkozás** (tudatos döntés).

### Deal-oldalak

- 106 statikus oldal.
- OG/Twitter kártya, saját OG kép.
- schema.org Event structured data.
- Források listája.
- Hasznos linkek: jegy/foglalás, ICS, Google Naptár, Google Maps, BKK.
- Hasonló dealek.
- Hibabejelentés.
- Világos/sötét mód a rendszerbeállítás szerint.

### Gyűjtemények

- `/gyujtemeny/`
- `/gyujtemeny/ingyenes/`
- `/gyujtemeny/mozi/`
- `/gyujtemeny/gasztro/`
- `/gyujtemeny/unnep/`
- `/gyujtemeny/program/`
- `/gyujtemeny/premium/`
- `/gyujtemeny/csalad/`
- `/gyujtemeny/penzugy/`

### Forrás-egészség

- `/forrasok/`
- Összes link, státusz, átirányítás, botblokk, hiba.
- Utolsó linkellenőrzés.
- Automatikus forrásfigyelés összefoglaló.

### Egyéb

- **RSS** – `feed.xml`, 55 elem.
- **PWA** – telepíthető, offline, manifest shortcutok.
- **Sötét mód** – ☾/☀ kapcsoló, localStorage; a statikus deal-/gyűjtemény-/forrásoldalak is átveszik a mentett témát, rendszerbeállítás fallbackkel.
- **Megosztás** – natív share vagy linkmásolás.
- **Hibabejelentés** – strukturált GitHub Issue űrlapok.
- **Smoke test** – deploy után automatikusan ellenőrzi az élő oldalt.
- **Lighthouse** – legutóbbi mérés: 100/100/100 (Accessibility, Best Practices, SEO); a Performance kategória nincs mérve.
- **Akadálymentesség** – skip link, fókuszáható találati lista, aria-label-ek.

---

## 11. GitHub Actions

| Workflow | Mikor fut? | Mit csinál? |
|---|---|---|
| `pipeline.yml` | Naponta 3x + kézzel | Import + generált adat ellenőrzése, validálás, digest, build, deploy, szükség esetén commit |
| `deploy.yml` | `main` pushra, ha data/site változik | Buildel, Pagesre deployol, majd élő smoke testet futtat |
| `ci.yml` | PR és `main` push (data/markdown változásra is) | Import + generált adat ellenőrzése, validálás, lint, teszt, titokellenőrzés, build |
| `link-check.yml` | Hetente, kézzel, vagy a checker változásakor | Linkellenőrzés 3 próbálkozással, `link-status.json` commit; HTTP-hiba esetén Discord-riasztás, átmeneti elérhetetlenség figyelmeztetés |
| `source-monitor.yml` | Hetente + kézzel | 15 hivatalos forrás figyelése, változás esetén GitHub Issue |

### Deploy működése

- `deploy.yml` a `dist/`-et tölti fel Pages artifactként.
- Ha a Pages artifact API átmenetileg hibázik, 15 mp után újrapróbálja.
- A retry után **élő smoke test** fut.
- Ha mindkét deploy sikertelen, Discord riasztás megy.
- A `status.json` a deploy előtt generálódik, ezért friss.

### Commitok

- A pipeline csak akkor commitol, ha a `data/` változott.
- A link-check és source-monitor `[skip ci]` commitokat használ.
- A `data/state.json` és `public/status.json` gitignore-olt, generált.
- A `data/digest-state.json` **commitolt** küldési ledger: ebből tudja a laptop és a GitHub Actions, hogy melyik digest-slot már ment ki.

---

## 12. Környezet és titkok

### `.env` (lokális, gitignore-olt)

- `DISCORD_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SITE_URL` (opcionális)
- `LOG_LEVEL` (opcionális)
- `TZ` (opcionális)

### GitHub Secrets

- `DISCORD_WEBHOOK_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

### GitHub Variables

- `SITE_URL` (opcionális; ha nincs, a workflow számolja)

**Soha ne commitolj `.env`-et, tokent, webhook URL-t!**

---

## 13. Parancsok

| Parancs | Mit csinál? |
|---|---|
| `npm run dev` | Helyi Vite fejlesztői szerver |
| `npm run build` | Éles build + deal-oldalak + gyűjtemények + forrás-egészség + OG + sitemap + RSS |
| `npm run preview` | A `dist/` helyi kiszolgálása |
| `npm run import` | Markdown + overrides + sources → `data/deals.json` |
| `npm run validate` | Adatbázis validálása |
| `npm run daily` | Napi pipeline (digest + build) |
| `npm run daily -- --dry-run --verbose` | Száraz futás |
| `npm run daily -- --no-notify --no-build` | Csak státuszfrissítés |
| `npm run daily -- --commit` | Pipeline + commit/push, ha van adatváltozás |
| `npm run daily -- --force-notify` | Digest kényszerített küldése |
| `npm run doctor` | Önellenőrzés |
| `npm run test-notify` | Teszt Discord/Telegram üzenet |
| `npm test` | Vitest tesztek |
| `npm run lint` | TypeScript ellenőrzés |
| `npm run check:secrets` | Titokszivárgás keresése |
| `npm run check:links` | Linkellenőrzés + `data/link-status.json` |
| `npm run check:live` | Élő oldal smoke test |
| `npm run monitor:sources` | 15 hivatalos forrás figyelése |
| `npm run monitor:issue` | GitHub Issue szöveg a változásokból |

---

## 14. Tesztek és minőség

- **43/43 Vitest teszt zöld.**
- Tesztek: dátumkezelés, digest, adatbetöltés, input sémák és kereszt-referenciák, ICS escape/sorhajtás, digest-slotszámítás, linkstátusz-osztályozás.
- Linkellenőrzés: 138 egyedi link; a legutóbbi futásban 116 OK, 24 átirányítás, 17 botblokk, 5 átmeneti elérhetetlenség, 0 HTTP-hiba.
- Titokellenőrzés: tiszta.
- Lighthouse: 100/100/100 (Accessibility, Best Practices, SEO; Performance nincs mérve; a UI-t érdemes újramérni nagyobb változás után).
- Deploy smoke test: sikeres.
- Forrásfigyelés: 15 forrás, 0 változás / 0 hiba a baseline után.

### Ismert minőségi korlátok

- A botblokkolt oldalakat a checker nem tudja tartalom szintjén ellenőrizni.
- A forrásfigyelés szöveghasonlóságon alapul; nagy dinamikus oldalaknál a küszöb hangolható.
- A `status.json` `booking` száma nem a booking URL-ek száma.
- A statikus deal-/gyűjteményoldalak a **rendszer** sötét beállítását követik; a kézi téma csak a SPA-n marad meg.
- A dátum nélküli dealek egy része folyamatos jellegű, ezért nem kerül a naptárba.

---

## 15. Roadmap / következő lépések

### Adat

- [ ] További 2027-es hivatalos dátumok (fesztiválok, színházak, múzeumok).
- [ ] `booking_opens` dátumok bővítése a top dealeknél.
- [ ] Normál árak feltöltése, ahol hivatalosan elérhető.
- [ ] Több második forrás a nagyobb dealekhez.
- [ ] Elavult/lejárt dealek archiválása vagy jelölése.

### UI / élmény

- [ ] Térkép nézet a budapesti helyszínekkel.
- [ ] Időjárás a szabadtéri programokhoz.
- [ ] Hétvégi/randi útvonalterv generátor.
- [ ] Heti digest archívum.
- [ ] Ár- és dátumtörténet.
- [ ] „Miért jó deal?” szerkesztői pontszám.
- [ ] Social megosztó kártya a top 5-ből.
- [ ] PWA telepítési prompt.
- [ ] Kategória-specifikus RSS feedek.

### Nagyobb, backendes

- [ ] Felhasználói fiók.
- [ ] Push/e-mail értesítés.
- [ ] „Megérte?” szavazás.
- [ ] Telegram bot.
- [ ] Angol nyelvű verzió.
- [ ] Automatikus árváltozás-figyelés.
- [ ] Affiliate/partner jegyvásárlás.

### Amit ne csinálj, hacsak a felhasználó nem kéri

- Naptár-feliratkozás (webcal/ICS subscription).
- Backend bevezetése a statikus működés helyett.
- Dátumok/árak kitalálása.
- A meglévő források törlése vagy keresőlinkre cserélése.

---

## 16. Fontos döntések és kontextus

- A projekt **public GitHub repo**, GitHub Pagesen.
- A felhasználó aktívan kéri a **folytatást, bővítést, szépítést**.
- A korábbi körökben bekerült:
  - teljes forrásaudit,
  - minden dealhez valós forrás,
  - sötét mód,
  - gyűjtemények,
  - természetes nyelvű keresés,
  - forrás-egészség,
  - automatikus forrásfigyelés,
  - útvonal linkek,
  - strukturált issue űrlapok,
  - deploy smoke test.
- A felhasználó kifejezetten kérte, hogy a **naptár-feliratkozás ne legyen**.
- A felhasználó szereti a **„legyen fullos / szuper”** jellegű, látványos és hasznos fejlesztéseket, de közben fontos a valós forrás és a pontosság.

---

## 17. Utolsó releváns commitok

| Commit | Mit tartalmaz? |
|---|---|
| `2a9d551` | Mind a 106 deal ellenőrzött; alternatív források; SPAR 2027 dátum |
| `5449dd8` | README keresés/forrás előnézetek |
| `4a5e0bf` | Forrásfigyelés kompaktabb hash-tárolás |
| `7dccb25` | Természetes nyelvű keresés, forrás-egészség, útvonal linkek |
| `8aed1d4` | Okos keresés, aktív szűrők, gyűjtemények, sötét mód, smoke test |
| `6263574` | Szezonális dealek, PWA, akadálymentesség |
| `08d1146` | Mai dobás, RSS, deal ICS, hasonló dealek, mobil szűrők |

---

## 18. Rövid prompt Gemini számára

> Folytasd a **Big-deal radar** projektet. Először olvasd el a `PROJECT_STATUS.md` és `README.md` fájlt. A projekt egy statikus, magyar nyelvű, GitHub Pagesen futó deal-radar. A jelenlegi állapot: 106 deal, 152 forrás, 57 dátumos, 106 ellenőrzött, 25 jegy/foglalás link, 0 keresőlink, 0 törött link. Tartsd meg a magyar felületet, a sötét módot, az akadálymentességet, a forrás-ellenőrzést és a statikus működést. Ne találj ki dátumot/árat; bizonytalanságnál `needs-check` és notes. Ne vezess be naptár-feliratkozást, hacsak a felhasználó nem kéri. Új dealnél adj forrást, lehetőleg dátumot/árat/foglalási linket, majd futtasd: `npm run import`, `npm run lint`, `npm test`, `npm run check:links`, `npm run check:secrets`, `npm run build`. Commit után figyeld a GitHub Actions-t, és deploy után futtasd a `npm run check:live` smoke testet. A follow-up feladatok a 15. szakaszban vannak.

---

## 19. Gyors ellenőrzőlista átadás előtt

- [ ] `git status` tiszta vagy csak szándékos változás.
- [ ] `npm run import` lefutott.
- [ ] `npm run lint` zöld.
- [ ] `npm test` zöld.
- [ ] `npm run check:links` 0 hiba.
- [ ] `npm run check:secrets` tiszta.
- [ ] `npm run build` sikeres.
- [ ] Új deal forrása valós, nem keresőlink.
- [ ] Új deal dátuma/ára nem kitalált; ha becsült, notesban jelölve.
- [ ] Sötét módban is ellenőrizve.
- [ ] Mobilnézetben is ellenőrizve.
- [ ] Commit + push.
- [ ] GitHub Actions zöld.
- [ ] Élő smoke test zöld.
