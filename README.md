# Big-deal radar

> **Ritka, nagy dobások. Nem a napi aprókedvezmények.**
>
> Budapest és Magyarország legjobb évente visszatérő dealjei egy helyen – szűrhető weboldalon, napi Discord-digesttel, elsődleges GitHub Actions küldéssel.
>
> **Élő oldal:** [https://gyuri125.github.io/big-deal-radar/](https://gyuri125.github.io/big-deal-radar/)
>
> **AI handoff / teljes projektállapot:** [PROJECT_STATUS.md](PROJECT_STATUS.md)
>
> **Minőség:** Lighthouse 100/100/100 (Accessibility, Best Practices, SEO; Performance nincs mérve) · 43 automata teszt · titokszivárgás-ellenőrzés minden CI futásban.

A projekt a **„Cinema City Filmünnep”** típusú alkalmakra épül: amikor nem 10%-ot adnak, hanem 4 napig **minden mozijegy ugyanannyi**, a 4DX is. Ilyen még a Múzeumok Éjszakája, a Színházak Éjszakája, a Restaurant Week, a Corvin Mozi Éjszaka vagy a Budapest100.

## Előnézet

![Big-deal radar – főoldal](docs/preview.png)

![Big-deal radar – sötét mód](docs/preview-dark.png)

A főoldalon **Mai dobás**, gyorsszűrők, **Hamarosan zárul** jelzés, **Heti top 5**, **Ezen a hétvégén**, **Neked ajánlott**, következő 7 nap, havi radar és a teljes kínálat található. A kártyákon látszik az ár, a források száma, a foglalási lehetőség és a lejárat. A fejlécben **sötét mód** kapcsoló, a menüben **gyűjteményoldalak** segítenek eligazodni.

---

## Tartalom

- [Mi ez?](#mi-ez)
- [Előnézet](#előnézet)
- [A deal-típusok](#a-deal-típusok)
- [Hogyan működik?](#hogyan-működik)
- [Gyors indítás](#gyors-indítás)
- [Titkok és biztonság](#titkok-és-biztonság)
- [Napi futás a laptopon](#napi-futás-a-laptopon)
- [GitHub Pages beállítás](#github-pages-beállítás)
- [GitHub Actions](#github-actions)
- [Hibrid működés](#hibrid-működés)
- [Adatmodell](#adatmodell)
- [Parancsok](#parancsok)
- [Hibakeresés](#hibakeresés)
- [Mappastruktúra](#mappastruktúra)
- [Roadmap](#roadmap)

---

## Mi ez?

Egy statikus, GitHub Pagesen futó **deal-radar**, ami:

- 100+ magyar/budapesti deal-ötletet tart nyilván,
- a következő 7 nap eseményeit és a havi radarot mutatja,
- **Mai dobás** blokkal nyit: mindennap egy kiemelt, aktuális dealet tesz eléd,
- szűrhető típus, kategória, helyszín és szabadszöveges keresés szerint,
- **ékezetfüggetlen keresés és szinonimák**: „muzeum” is megtalálja a „Múzeum” dealeket,
- **természetes nyelvű keresés**: „ingyenes mozi hétvégén”, „randi 10 ezer alatt”, „családi program vasárnap”, „borfesztivál 2027”,
- **aktív szűrőchipek**: minden szűrő külön törölhető, egy kattintással,
- **Szombat / Vasárnap** külön időszűrők, a folyamatos helyszíni programokkal együtt,
- **Ezen a hétvégén** és **Neked ajánlott** blokk a főoldalon,
- **saját lista költségösszesítővel**: ismert ár, becsült megtakarítás, ingyenes dealek,
- **8 gyűjteményoldal**: ingyenes, mozi, gasztro, ünnepek, programok, prémium, család, pénzügy,
- **Forrás-egészség oldal** és heti automatikus forrásfigyelés,
- **„Útvonal” link** minden dealnél Google Mapshez, budapesti helyszíneknél BKK-hoz,
- **sötét mód** rendszerbeállítás szerint vagy kézi kapcsolóval, mentett választással,
- mobilon **összecsukható szűrőpanellel** és gyors „vissza a tetejére” gombbal,
- minden eseményhez **naptárba tehető ICS** fájlt ad, **14 nappal, 7 nappal, 1 nappal és aznap** emlékeztetővel,
- **Google Naptár link** egy kattintásos hozzáadáshoz,
- **saját lista + prioritás** a böngészőben, regisztráció nélkül,
- ahol van, **jegyvásárlási / foglalási link** és foglalási útmutató (jelenleg 25 dealnél),
- **minden dealhez legalább egy forrás**, ahol releváns, több is; a részletek ablakban listázva,
- **3 másodperces hover tooltip** a linkeken: megmutatja, hová visz,
- **RSS feed** a következő dealekkel, hogy olvasóban is követhető legyen,
- **„Nekem” gyorsszűrők**: mozi, ételek, programok, ünnepek, ingyenes,
- **Mikor / Ár szűrők**: Ma, Hétvége, Szombat, Vasárnap, 7 nap, **Hamarosan zárul**, Ingyenes, 5 ezer alatt, 10 ezer alatt,
- **gyorskeresés**: a `/` billentyű a keresőmezőre ugrik, az Escape törli a keresést,
- **megosztható szűrők**: a keresés, a szűrők, a nézet és a téma az URL-ben maradnak,
- **sürgősségi jelzés**: ha egy deal 3 napon belül zárul, a kártya és a hero panel is jelzi,
- **akadálymentes**: skip link, fókuszálható eredmények, Lighthouse 100 accessibility,
- **naptárnézet** havi bontásban, hónap-naptár letöltéssel,
- **egyedi deal-oldalak** SEO-val, OG képpel, Event structured data-val, saját ICS letöltéssel és hasonló dealekkel,
- **PWA**: telepíthető, offline is működik, gyorsparancsokkal,
- **hibabejelentés** strukturált GitHub Issue űrlapokkal, heti linkellenőrzéssel,
- **deploy smoke test**: a deploy után automatikusan ellenőrzi az élő oldalt,
- naponta **Discord digestet** küld (elsődlegesen a GitHub Actions),
- Telegramhoz előkészített, de opcionális csatornával rendelkezik,
- a laptop csak adatot generál és commitol; a digestet a GitHub Actions küldi, közös `data/digest-state.json` deduplikációval.

A cél nem az, hogy minden akciót összegyűjtsön. Hanem hogy **időben elkapd a nagyokat**.

---

## A deal-típusok

| Típus | Mit jelent | Példa |
|---|---|---|
| ★ **Prémium ugyanannyi** | Egy ár, a prémium is benne | Cinema City Filmünnep: 4DX = 2D |
| 🎟️ **Egy jegy, sok helyszín** | Egy karszalag/jegy, több intézmény | Múzeumok Éjszakája, Corvin Mozi Éjszaka |
| 🆓 **Ingyenes, de nagy értékű** | Olyan helyek nyílnak meg, ahová máskor fizetnél | Budapest100, Erőművek Éjszakája |
| 💰 **Évi nagy pénzügyi dobás** | Támogatás, adójóváírás, banki bónusz | Nyugdíjpénztári 20%, otthonfelújítási támogatás |
| 🔑 **Különleges hozzáférés** | Elővásárlási időablak, zárt kör vagy exkluzív hozzáférés | Elővásárlási akciók, tagi nyitások |

A weboldalon ezek a szűrők: **★ Prémium**, **Ingyenes**, **Akció**, **Pénzügy**, **Hozzáférés**.

---

## Hogyan működik?

```mermaid
flowchart LR
  L[Laptop<br/>08:00 / 12:00 / 20:00] --> P[Napi pipeline]
  A[GitHub Actions<br/>3x naponta] --> P
  P --> D[(data/deals.json)]
  P --> S[public/status.json]
  D --> B[Vite build]
  S --> B
  B --> G[GitHub Pages]
  P --> DC[Discord webhook]
  P --> TG[Telegram placeholder]
  P --> LC[Heti link check]
  P --> SM[Heti forrásfigyelés]
  LC --> H[Forrás-egészség]
  SM --> I[GitHub Issue]
```

```mermaid
sequenceDiagram
  participant L as Laptop
  participant GH as GitHub
  participant A as Actions
  participant P as Pages
  participant D as Discord

  L->>L: npm run import + daily --commit --no-notify
  L->>GH: data commit (csak ha változott)
  GH->>A: push → deploy.yml
  A->>P: build + deploy

  Note over A: 08:00 / 12:00 / 20:00 elsődleges digest
  A->>D: digest vagy hiba
  A->>P: friss build
```

A pipeline lépései:

1. A `npm run import` a markdownból és az input JSON-okból újragenerálja a `data/deals.json`-t.
2. Zod-dal validálja a dealeket, az input fájlokat és a kereszt-referenciákat (árva kulcs, keresőlink, URL-séma).
3. Kiszámolja a következő 7 napot, a havi radarot, a foglalásnyílásokat és a pénzügyi határidőket.
4. A commitolt `data/digest-state.json` alapján eldönti, kell-e digestet küldeni.
5. Discordra (és opcionálisan Telegramra) küldi a digestet; hibánál a státuszfájlba is bekerül.
6. Kiírja a `public/status.json`-t (a weboldal ezt jeleníti meg a láblécben).
7. Buildinget készít a `dist/` mappába.
8. Csak akkor commitol, ha a `data/` alatt tényleg változás történt.

---

## Gyors indítás

### 1. Előfeltételek

- Node.js 20+ (a projekt Node 24-gyel készült)
- npm
- Git

### 2. Telepítés

```bash
npm install
```

### 3. Titkok beállítása

```bash
copy .env.example .env
```

Windows PowerShellben:

```powershell
Copy-Item .env.example .env
```

Töltsd ki a `.env`-et:

```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
SITE_URL=https://felhasznalonev.github.io/big-deal-radar/
TZ=Europe/Budapest
```

### 4. Adatok betöltése

A 100+ lista a `budapesti-100-big-deal.md` fájlban van. A top dealek pontos dátumát, árát és forrását a `data/overrides.json` adja hozzá; a forrásokat, címkéket és ármagyarázatokat külön adatfájlok egészítik ki.

```bash
npm run import
npm run validate
```

### 5. Helyi fejlesztés

```bash
npm run dev
```

Megnyílik a `http://localhost:5173`.

### 6. Első dry-run

```bash
npm run daily -- --dry-run --verbose
```

Ez mindent kiszámol, de nem küld, nem ír és nem commitol.

### 7. Éles próba

```bash
npm run daily -- --no-build --no-notify
npm run build
```

---

## Titkok és biztonság

### Lokális fejlesztés

A titkok a `.env` fájlban vannak. Ez **soha nem kerül a repóba**.

### GitHub Actions

A titkokat a GitHubon kell beállítani:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | Kötelező? | Mire kell? |
|---|---|---|
| `DISCORD_WEBHOOK_URL` | Igen, ha Discordot akarsz | Napi digest és hibaértesítés |
| `TELEGRAM_BOT_TOKEN` | Nem | Telegram digest (placeholder) |
| `TELEGRAM_CHAT_ID` | Nem | Telegram digest (placeholder) |
| `SITE_URL` | Nem | A digestben megjelenő link; ha nincs, a workflow kiszámolja |

> **Fontos:** a Discord webhook és a Telegram token **soha nem kerülhet a frontend kódba**. Csak a pipeline használja.

### Discord webhook beállítása

1. Discordban nyisd meg a csatornát, ahová az értesítéseket akarod.
2. **Edit Channel → Integrations → Webhooks → New Webhook**.
3. Másold ki a webhook URL-t.
4. Tedd be a `.env`-be `DISCORD_WEBHOOK_URL` néven, vagy GitHubon a repository secretbe.
5. Teszteld:

```bash
npm run test-notify
```

### Telegram (opcionális)

A Telegram egyelőre **placeholder**. Ha később szeretnéd:

1. A [@BotFather](https://t.me/BotFather) segítségével készíts botot.
2. Kérd le a bot tokent.
3. Add meg a `TELEGRAM_BOT_TOKEN` és `TELEGRAM_CHAT_ID` értékeket.
4. A kód már készen áll rá: `src/notifiers/telegram.ts`.

Ha nincs beállítva, a pipeline csak egy figyelmeztetést ír a logba, és megy tovább.

### Biztonsági ellenőrzés

```bash
npm run check:secrets
```

Ez végigfut a tracked fájlokon, és megkeresi a Discord webhook / Telegram token mintákat, valamint azt, hogy a `.env` értékei nem szivárogtak-e ki.

A `.gitignore` szigorú:

- `.env`, `.env.*` (kivéve `.env.example`)
- `node_modules/`, `dist/`, `logs/`, `coverage/`
- `data/state.json`, `public/status.json` (generált)
- IDE/OS fájlok

---

## Napi futás a laptopon

### Telepítés

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/install-task.ps1
```

Ez három Windows Task Scheduler feladatot hoz létre:

- `BigDealRadar-0800`
- `BigDealRadar-1200`
- `BigDealRadar-2000`

A feladat a `scripts/daily.ps1`-t futtatja, ami:

1. a projekt gyökerébe lép, és `Europe/Budapest` időzónát állít,
2. logot ír a `logs/daily-YYYY-MM-DD.log` fájlba,
3. lefuttatja a `npm run import` parancsot, hogy a `data/deals.json` a markdownból és az input JSON-okból épüljön újra,
4. lefuttatja a `npm run daily -- --commit --no-notify` parancsot,
5. hibánál nem némul el, hanem láthatóan elbukik.

### Mikor küld értesítést?

- A **GitHub Actions** az elsődleges küldő; a laptop `--no-notify` móddal csak adatot generál és commitol.
- **Reggel (10 óra előtt):** naponta egyszer teljes digest.
- **12:00 és 20:00:** csak 3 napon belüli esemény vagy 14 napon belüli foglalásnyílás miatt, naponta legfeljebb egyszer.
- A küldési slotot a commitolt `data/digest-state.json` őrzi, így a laptop és az Actions nem küldi el ugyanazt.
- Kényszerített digest: `npm run daily -- --force-notify`.

### Kézi futtatás

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/daily.ps1
```

Vagy közvetlenül:

```bash
npm run import
npm run daily -- --commit --no-notify
```

### Törlés

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/remove-task.ps1
```

### Ha a laptop ki van kapcsolva

A Task Scheduler `StartWhenAvailable` beállítása miatt a feladat a következő bekapcsoláskor lefut. Emellett a GitHub Actions napi futása az elsődleges digest- és deployútvonal, tehát a Pages oldal nem marad üresen.

---

## GitHub Pages beállítás

1. Hozz létre egy **publikus** GitHub repót.
2. Pushold fel a projektet a `main` ágra.
3. Menj a **Settings → Pages** menübe.
4. A **Build and deployment → Source** legyen **GitHub Actions**.
5. Futtasd a **Actions → Napi radar → Run workflow** parancsot egyszer kézzel.
6. A deploy után az oldal itt lesz:

```text
https://<felhasznalonev>.github.io/<repo-nev>/
```

> **Miért publikus?** Ingyenes GitHub-fiók esetén a GitHub Pages csak publikus repóból működik. Ha privát kell, akkor GitHub Pro/Team vagy Cloudflare Pages/Netlify lehet a megoldás. A titkok így is biztonságban vannak: GitHub Secretsben, nem a kódban.

Ha a `SITE_URL` repository variable-t beállítod, a digestben és a weboldalon is a saját linked jelenik meg.

### Első push GitHubra

A projekt lokálisan már git repo, de a remote-ot neked kell beállítani:

```bash
git remote add origin https://github.com/<felhasznalonev>/<repo-nev>.git
git push -u origin main
```

Ha még nincs commit:

```bash
git init -b main
git add .
git commit -m "feat: Big-deal radar alapverzió"
git remote add origin https://github.com/<felhasznalonev>/<repo-nev>.git
git push -u origin main
```

> A repó neve legyen például `big-deal-radar`. Ha más nevet használsz, a `SITE_URL`-t és a Pages URL-t is annak megfelelően állítsd.

---

## GitHub Actions

Öt workflow van:

| Workflow | Mikor fut? | Mit csinál? |
|---|---|---|
| `pipeline.yml` | Naponta 3x + kézzel | Import + generált adat ellenőrzése, validálás, digest, build, deploy, szükség esetén commit |
| `deploy.yml` | `main` pushra, ha data/site változik | Buildel és Pagesre deployol, majd élő smoke testet futtat |
| `ci.yml` | PR és `main` push (data és markdown változásra is) | Import + generált adat ellenőrzése, validálás, lint, teszt, titokellenőrzés, build |
| `link-check.yml` | Hetente + kézzel | Forráslinkek ellenőrzése 3 próbálkozással, `link-status.json` commit; HTTP-hiba esetén Discord-riasztás, átmeneti elérhetetlenség figyelmeztetés |
| `source-monitor.yml` | Hetente + kézzel | Kiemelt hivatalos oldalak figyelése, változás esetén GitHub Issue |

A napi cron **UTC-ben** van:

```yaml
- cron: '0 7 * * *'   # 08:00 Budapest (téli idő)
- cron: '0 11 * * *'  # 12:00 Budapest (téli idő)
- cron: '0 19 * * *'  # 20:00 Budapest (téli idő)
```

Nyáron ezek 09:00 / 13:00 / 21:00 helyi idő szerint futnak, mert a cron nem kezeli a nyári időszámítást. A digest-slotszámítás és a build is `Europe/Budapest` időzónát használ, így a dátumok nem csúsznak el.

---

## Hibrid működés

A GitHub Actions az elsődleges digestküldő és deployútvonal; a laptop adatot generál és commitol.

- A laptop `--no-notify` módban fut, így nem küldi el ugyanazt a digestet, mint az Actions.
- A laptop **csak akkor commitol**, ha a `data/` alatt változás van. Napi üres commit nincs.
- A laptop futása után a push triggereli a `deploy.yml`-t, tehát a Pages frissül.
- Ha a laptop nem futott, a GitHub Actions 3x naponta lefut, és frissíti az oldalt.
- A `public/status.json` és a `data/state.json` generált, ezért nincs a repóban.
- A weboldal a `status.json`-ból mutatja az utolsó futást és a következő időpontokat.
- Ha 48 óránál régebbi az adat, a weboldalon figyelmeztetés jelenik meg (a `status.json` időbélyege alapján). Helyi `local` futásnál ez szándékosan nem jelenik meg.

---

## Adatmodell

Egy deal így néz ki a `data/deals.json`-ban:

```json
{
  "id": "cinema-city-filmunnep",
  "title": "Cinema City Filmünnep",
  "category": "kultura",
  "type": "flat",
  "timing": "Október eleje, 4 nap",
  "date_start": "2026-10-08",
  "date_end": "2026-10-11",
  "booking_opens": null,
  "month": 10,
  "months": [10],
  "recurrence": "annual",
  "deal": "Minden jegy 1690 Ft – 2D, 3D, IMAX, 4DX, ScreenX is",
  "normal_price": 3100,
  "deal_price": 1690,
  "price_note": "A normál 2D jegy árához képest; a 4DX/IMAX is ugyanannyi.",
  "currency": "HUF",
  "location": "Budapest",
  "source_url": "https://www.cinemacity.hu",
  "booking_url": "https://www.cinemacity.hu",
  "booking_note": "A jegyvásárlás online és a pénztárakban is lehetséges.",
  "sources": [
    {
      "label": "Hivatalos oldal",
      "url": "https://www.cinemacity.hu",
      "type": "official"
    },
    {
      "label": "PC Guru cikk",
      "url": "https://www.pcguru.hu/...",
      "type": "article"
    }
  ],
  "confidence": "verified",
  "last_checked": "2026-11-20",
  "tags": ["kultura", "flat", "budapest"],
  "notes": "2026-ban október 8–11. között.",
  "featured": true
}
```

### Mezők

| Mező | Jelentés |
|---|---|
| `type` | `flat`, `free`, `sale`, `money`, `access` |
| `category` | `mozi`, `kultura`, `muzeum`, `gasztro`, `utazas`, `vasarlas`, `penzugy`, `egeszseg`, `csalad`, `egyeb` |
| `recurrence` | `annual`, `monthly`, `weekly`, `daily`, `continuous`, `oneoff` |
| `date_start` / `date_end` | Referenciadátum; éves eseménynél a következő előfordulást a kód számolja |
| `month` / `months` | Havi szűréshez, akkor is, ha nincs pontos dátum |
| `confidence` | `verified`, `needs-check`, `unverified` |
| `normal_price` / `deal_price` | A megtakarítás számításához |
| `price_note` | Ha nincs pontos normál ár, itt magyarázzuk az árat |
| `last_checked` | Utolsó kézi ellenőrzés dátuma |
| `source_url` | Hivatalos forrás / cikk linkje |
| `booking_url` | Jegyvásárlás vagy foglalás linkje |
| `booking_note` | Hogyan és mikor érdemes előre venni/foglalni |
| `sources` | Több forrás: hivatalos, jegy, cikk, keresés |

### Hogyan kerül be új deal?

1. Írd be a `budapesti-100-big-deal.md` táblázatába.
2. Ha pontos dátumot, árat vagy foglalási adatot akarsz hozzáadni, tedd a `data/overrides.json`-ba.
3. A forrásokat a `data/sources.json`-ba, a program/ünnepi címkéket a `data/tags.json`-ba, az ármagyarázatot a `data/price-notes.json`-ba tedd.
4. Ha a deal neve pontosításra szorul, a `data/titles.json`-ban írd felül.
5. Az ellenőrzés dátumát a `data/meta.json`-ban frissítsd.
6. Futtasd:

```bash
npm run import
npm run validate
```

> A `data/deals.json` **generált kimenet**. Ha kézzel szerkeszted, ne futtasd utána az `npm run import`-ot, mert felülírja. A javasolt út a markdown + overrides.

---

## Hogyan ne maradj le? (előrejelzés)

A cél, hogy ne az esemény napján szembesülj vele, hogy elment a lehetőség.

1. **Napi digest** – a Discord megkapja a következő 7 nap eseményeit, a havi radarot és a jegyvásárlási/foglalási teendőket.
2. **Saját listám** – a kártyákon a **☆** ikonnal követheted, ami érdekel. A lista a böngésződben tárolódik, nem kell hozzá regisztráció.
3. **Prioritás** – a részletek ablakban 1–3 csillaggal jelölheted, mi a fontos. A saját listában prioritás szerint rendezve jelenik meg.
4. **Naptárba emlékeztetővel** – a letöltött ICS nem csak egy esemény: **14 nappal előtte, 7 nappal előtte, 1 nappal előtte és aznap** is emlékeztet. Ez a legmegbízhatóbb védelem, mert a naptárad akkor is szól, ha a weboldalt nem nyitod meg.
5. **Jegyvásárlás / foglalás** – ahol van hivatalos link, a részletek ablakban külön gomb visz a jegyvásárlásra vagy foglalásra, a `booking_note` pedig elmagyarázza, mire figyelj.
6. **Foglalásnyílás** – ha egy dealnél ismert a `booking_opens` dátum, a napi digest külön „Jegyvásárlás / foglalás” szekcióban jelzi, és a naptárba külön esemény is bekerül.

> **Mi hiányzik még?** A statikus oldal nem tud e-mailt vagy push értesítést küldeni minden egyes felhasználónak. A megbízható megoldás a naptár-emlékeztető. Ha később valódi felhasználói fiókok és e-mail/push értesítés kellenek, ahhoz backend és hitelesítés kell; ez külön projekt.

---

## Források, linkek és tooltip

A `data/sources.json` minden dealhez forrásokat rendel. A részletek ablakban ezek listázva vannak:

- **Hivatalos oldal** – a szervező oldala
- **Jegyvásárlás / foglalás** – közvetlen jegy- vagy asztalfoglalás
- **Cikk / ajánló** – háttérinformáció, összefoglaló
- **Keresés** – tartalék típus jövőbeli dealekhez; jelenleg egyik deal sem használja

Ha az egérrel **3 másodpercig** egy linken maradsz, lebegő tooltip mutatja a teljes URL-t, hogy lásd, hová visz. Mobilon a link koppintással nyílik.

A linkek ellenőrzése:

```bash
npm run check:links
```

Ez végigfut az összes forráson, és jelzi a 404-et, a törött linket és a botblokkokat. A botblokkolt oldalak böngészőből általában működnek.

---

## Adatállapot

A főoldal alján egy **Adatállapot** panel mutatja, hol tartunk:

- **106 deal**
- **152 forrás**
- **57 dátumos**
- **106 ellenőrzött**
- **25 jegy / foglalás link**
- **0 keresőlinkes** – minden dealhez van legalább egy valós forrás

Ez nem reklám, hanem átláthatóság: ahol lehet, több forrást is megadunk, és a „Hibát jelentek” gombbal bárki jelezheti, ha elavult adatot lát. Az **ellenőrzött** jelölés azt jelenti, hogy a forrás elérhető és a deal szerepel rajta; a dátumok és árak továbbra is változhatnak, ezért a részleteket a forrásnál érdemes megnézni.

---

## Naptár és heti terv

A főoldalon a **Lista / Naptár** kapcsolóval havi nézetre válthatsz.

- A naptárban csak a **pontos dátumú** dealek jelennek meg.
- A cellákban a dealek kattinthatók, megnyitják a részleteket.
- **Hónap naptárba** gombbal az adott hónap összes eseménye letölthető ICS-ben.
- A **Következő 7 nap naptárba** gomb a következő hét eseményeit tölti le.
- A **Ma / Hétvége / 7 nap / Hamarosan zárul** szűrők gyorsan leszűkítik a listát.
- Az **Ár** szűrők: Ingyenes, 5 ezer alatt, 10 ezer alatt, 10 ezer felett.

A **Heti top 5** doboz a szerkesztői válogatást mutatja a legnagyobb dobásokból.

A **Mai dobás** blokk a legaktuálisabb kiemelt dealet teszi a főoldal tetejére, egy kattintással nyitható részletekkel, naptárba tehető emlékeztetővel és követéssel.

---

## RSS és értesítések

A statikus oldal nem tud felhasználónkénti e-mailt vagy push értesítést küldeni, de két megbízható követési módot ad:

- **RSS**: `https://gyuri125.github.io/big-deal-radar/feed.xml` – a következő, dátumos dealek időrendben. Bármelyik RSS-olvasóba be lehet tenni.
- **ICS naptár**: a részletek ablakban, a deal-oldalakon és a naptárnézetben is letölthető. A bejegyzés **14, 7, 1 nappal előtte és aznap** emlékeztet.

A saját lista és a prioritások a böngésző `localStorage`-ában maradnak, így regisztráció nélkül is működnek. Valódi push/e-mail értesítéshez backend és felhasználói fiók kellene; ez tudatosan nincs beépítve.

---

## Egyedi deal-oldalak és SEO

Minden dealhez külön statikus oldal készül:

```text
https://gyuri125.github.io/big-deal-radar/deal/cinema-city-filmunnep/
```

Ezek az oldalak:

- külön címmel és leírással rendelkeznek,
- **OG / Twitter kártyát** kapnak (egyedi OG képpel),
- **schema.org Event** structured data-t tartalmaznak (dátum, helyszín, ár, jegyvásárlási link),
- **saját `.ics` naptárfájlt** kínálnak, emlékeztetőkkel,
- **Google Naptár linket** is adnak az egykattintásos hozzáadáshoz,
- **Google Maps / BKK útvonal linket** is adnak,
- **hasonló dealeket** ajánlanak a kategóriából,
- a **Megosztás** gombbal másolható / megosztható a link,
- a részletek ablakból is megnyithatók.

A `sitemap.xml` és a `feed.xml` automatikusan elkészül, a `robots.txt` pedig hivatkozik a sitemapre.

---

## Gyűjtemények

Nyolc statikus gyűjteményoldal segít eligazodni:

```text
https://gyuri125.github.io/big-deal-radar/gyujtemeny/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/ingyenes/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/mozi/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/gasztro/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/unnep/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/program/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/premium/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/csalad/
https://gyuri125.github.io/big-deal-radar/gyujtemeny/penzugy/
```

A gyűjtemények a sitemapba is bekerülnek, és a deal-oldalakról, illetve a főoldalról is elérhetők.

---

## Természetes nyelvű keresés

A kereső nem csak szavakat keres, hanem felismeri a szándékot is:

- „ingyenes mozi hétvégén”
- „randi 10 ezer alatt”
- „családi program vasárnap”
- „borfesztivál 2027”

A találatok felett megjelenik az **értelmezés** (pl. `Ingyenes · Mozi · Hétvége`), így látszik, miért szűkült a lista. A keresés továbbra is ékezetfüggetlen, és a szűrők az URL-ben is megmaradnak.

![Természetes nyelvű keresés](docs/search-preview.png)

---

## Forrás-egészség és automatikus figyelés

A **Forrás-egészség** oldal:

```text
https://gyuri125.github.io/big-deal-radar/forrasok/
```

- kilistázza az összes forrást,
- mutatja, melyik él, melyik botblokkolt, hol volt hiba,
- látszik az utolsó linkellenőrzés ideje,
- a botblokkolt oldalakat külön jelöli.

![Forrás-egészség](docs/sources-preview.png)

A **Forrásfigyelés** GitHub Action hetente figyeli a kiemelt hivatalos oldalakat (Cinema City, Restaurant Week, Müpa, SZIGET, állatkert, fesztiválok), és ha változást vagy hibát lát, GitHub Issue-t nyit. Így a forrásváltozások nem csúsznak el észrevétlenül.

---

## Sötét mód

A fejléc jobb felső sarkában lévő **☾ / ☀** kapcsolóval váltható a világos és a sötét téma. Alapból a rendszerbeállítást követi, a választás pedig a böngészőben marad. A statikus deal- és gyűjteményoldalak is követik a rendszer sötét beállítását.

---

## PWA

Az oldal telepíthető telefonra:

- manifest + ikonok,
- service worker,
- offline elérés a korábban betöltött tartalomhoz.

---

## Hibabejelentés és linkellenőrzés

- Minden deal részleteinél van **„Hibát jelentek”** gomb, ami előre kitöltött GitHub Issue-t nyit.
- Az **Adatállapot** panelről és a láblécből elérhető a **Forrás-egészség** oldal.
- A **heti linkellenőrzés** GitHub Actions workflow (`link-check.yml`) végigfut a forrásokon, és `data/link-status.json`-ba menti az eredményt. Átmeneti hálózati hibánál háromszor próbálkozik.
- HTTP-hiba esetén Discordra megy a riasztás. A tartósan „elérhetetlen” link figyelmeztetés a forrás-egészség oldalon, de nem buktatja meg a heti workflow-t.
- A **heti forrásfigyelés** (`source-monitor.yml`) a kiemelt hivatalos oldalakat figyeli, és változás vagy hiba esetén GitHub Issue-t nyit.
- Kézzel: `npm run check:links`, `npm run monitor:sources`.

---

## Parancsok

| Parancs | Mit csinál? |
|---|---|
| `npm run dev` | Helyi Vite fejlesztői szerver |
| `npm run build` | Éles build + deal-oldalak + gyűjtemények + forrás-egészség + OG képek + sitemap |
| `npm run import` | Markdown + overrides → `data/deals.json` |
| `npm run validate` | Adatbázis validálása |
| `npm run daily` | Napi pipeline (digest + build) |
| `npm run daily -- --dry-run --verbose` | Mindent kiszámol, de nem ír/küld/commitál |
| `npm run daily -- --no-notify --no-build` | Csak státuszfrissítés |
| `npm run daily -- --commit` | Pipeline + commit/push, ha van adatváltozás |
| `npm run daily -- --force-notify` | Digest kényszerített küldése |
| `npm run doctor` | Önellenőrzés: Node, env, adat, git |
| `npm run test-notify` | Teszt Discord/Telegram üzenet |
| `npm test` | Vitest tesztek |
| `npm run lint` | TypeScript ellenőrzés |
| `npm run check:secrets` | Titokszivárgás keresése |
| `npm run check:links` | Forráslinkek ellenőrzése + `data/link-status.json` |
| `npm run check:live` | Élő oldal smoke testje |
| `npm run monitor:sources` | Kiemelt hivatalos források figyelése |
| `npm run monitor:issue` | Forrásváltozásból GitHub Issue szöveg |

---

## Hibakeresés

| Tünet | Valószínű ok | Megoldás |
|---|---|---|
| `Nem találom a deal adatbázist` | Nincs `data/deals.json` | `npm run import` |
| `A deal adatbázis hibás` | Rossz mező / hiányzó érték | A hibaüzenet megmondja a mezőt; javítsd, majd `npm run validate` |
| Discord nem küld | Nincs `DISCORD_WEBHOOK_URL` | `.env` kitöltése, majd `npm run test-notify` |
| Discord 401/404 | Hibás vagy törölt webhook | Új webhook a Discord csatorna beállításaiban |
| Telegram nem küld | Nincs token/chat ID | Opcionális; hagyd üresen, vagy állítsd be |
| A Pages nem frissül | Nincs beállítva a GitHub Actions source | Settings → Pages → Source: GitHub Actions |
| `No artifacts named "github-pages"` | Átmeneti GitHub artifact API hiba | A workflow 15 mp után automatikusan újrapróbálja a deployt |
| A Pages 404 | Rossz reponév vagy privát repo | Ellenőrizd a `SITE_URL`-t és a repo láthatóságát |
| A laptop nem commitol | Nincs adatváltozás | Ez normális; csak változás esetén commitol |
| `git push` hiba | Nincs bejelentkezve / nincs jogosultság | `git remote -v`, `gh auth status`, SSH kulcs |
| Az oldal üres | JS hiba | `npm run dev`, majd böngésző konzol; vagy `?debug=1` |
| Régi dátumok | Az adat 2026-os referencia | Frissítsd a `date_start` mezőket az aktuális évre |

### Debug mód

Nyisd meg:

```text
http://localhost:5173/?debug=1
```

Ilyenkor a lábléc fölött megjelenik egy panel az adatokról, a státuszról és a számokról.

### Doctor

```bash
npm run doctor
```

Ellenőrzi:

- Node verzió,
- `.env` megléte,
- Discord webhook formátum,
- Telegram beállítás,
- adatbázis validitás,
- git repo és remote,
- státuszfájl.

---

## Mappastruktúra

```text
big-deal-radar/
├─ .github/workflows/
│  ├─ pipeline.yml        # napi adatfrissítés + digest + deploy
│  ├─ deploy.yml          # push → Pages deploy
│  ├─ link-check.yml      # heti linkellenőrzés
│  ├─ source-monitor.yml  # heti forrásfigyelés + issue
│  └─ ci.yml              # lint, teszt, titokellenőrzés, build
├─ data/
│  ├─ deals.json          # 100+ deal (generált a markdownból)
│  ├─ overrides.json      # top dealek pontos dátumai/árai/foglalási adatai
│  ├─ sources.json        # dealenkénti források, cikkek, jegyvásárlás
│  ├─ tags.json           # program / ünnepi / évfordulós címkék
│  ├─ titles.json         # dealnevek pontosítása (pl. Coffee Week)
│  ├─ price-notes.json    # ármagyarázatok
│  ├─ meta.json           # utolsó ellenőrzés dátuma
│  ├─ link-status.json    # legutóbbi linkellenőrzés eredménye
│  ├─ source-monitor.json # figyelt hivatalos oldalak
│  ├─ source-hashes.json  # forrásoldalak hash-ei
│  ├─ source-monitor-report.json # változások / hibák
│  └─ state.json          # generált, gitignore-olt
├─ public/
│  └─ status.json         # generált, gitignore-olt
├─ scripts/
│  ├─ import-markdown.ts  # markdown → JSON
│  ├─ check-secrets.ts    # titokszivárgás-ellenőrzés
│  ├─ check-links.ts      # forráslinkek ellenőrzése + link-status.json
│  ├─ monitor-sources.ts  # kiemelt források figyelése
│  ├─ write-monitor-issue.ts # issue szöveg a változásokból
│  ├─ smoke-test.ts       # élő oldal ellenőrzése deploy után
│  ├─ build-deal-pages.ts # egyedi deal-oldalak, gyűjtemények, sitemap
│  ├─ daily.ps1           # Task Scheduler belépő
│  ├─ install-task.ps1    # 08:00 / 12:00 / 20:00 telepítés
│  └─ remove-task.ps1     # feladatok törlése
├─ src/
│  ├─ cli.ts              # daily / validate / doctor / test-notify
│  ├─ config.ts           # .env + Zod
│  ├─ types.ts            # Deal típusok
│  ├─ pipeline/           # load, digest
│  ├─ notifiers/          # discord, telegram
│  ├─ site/               # main.ts, style.css
│  └─ utils/              # dates, logger
├─ tests/                 # Vitest tesztek
├─ budapesti-100-big-deal.md
├─ big-deal-otletek.md
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

---

## Roadmap

- [x] Saját lista, prioritás, naptár-emlékeztető.
- [x] Minden dealhez forrás, több forrás, hover tooltip.
- [x] Naptárnézet, Ma / Hétvége / 7 nap és ár szerinti szűrők.
- [x] Heti top 5, egyedi deal-oldalak, OG képek, Event structured data.
- [x] PWA, offline mód, megosztható linkek.
- [x] Heti linkellenőrzés és hibabejelentés.
- [x] Minden dealhez legalább egy valós forrás.
- [x] Mind a 106 deal forrása ellenőrzött (2026-11-22).
- [x] Mai dobás blokk, mobil szűrőpanel, vissza a tetejére gomb.
- [x] RSS feed és deal-oldalanként letölthető ICS.
- [x] Hasonló dealek ajánlása a részletekben és a deal-oldalakon.
- [x] Gourmet Fesztivál és Budapest Borfesztivál 2027-es dátumozása; a becsült dátumok jelölése.
- [x] Ékezetfüggetlen keresés, szinonimák, aktív szűrőchipek.
- [x] Ezen a hétvégén, Neked ajánlott, saját lista költségösszesítő.
- [x] 8 gyűjteményoldal, sötét mód, Google Naptár link.
- [x] Természetes nyelvű keresés, Szombat/Vasárnap szűrők.
- [x] Forrás-egészség oldal és heti automatikus forrásfigyelés.
- [x] Google Maps / BKK útvonal linkek.
- [x] Strukturált GitHub Issue űrlapok és deploy smoke test.
- [ ] A maradék 49 dealnél pontos dátum, ahol értelmezhető (a folyamatos/heti dealek szándékosan dátum nélkül maradnak).
- [ ] Normál árak feltöltése a top 30-hoz.
- [ ] Foglalásnyílási dátumok (booking_opens) a top 10-hez.
- [x] Automatikus forrásfigyelés (Cinema City, Múzeumok Éjszakája, Restaurant Week).
- [ ] Közösségi szavazás: „megérte?” / „nem érte meg” (backend kell hozzá).
- [ ] Telegram bot élesítése, ha lesz token.
- [ ] Angol nyelvű verzió (opcionális).

---

## Források

A dátumok és árak 2026-os példák, és évente változnak. A részleteket mindig a hivatalos oldalon ellenőrizd:

- Cinema City – [cinemacity.hu](https://www.cinemacity.hu)
- Múzeumok Éjszakája – [muzej.hu](https://muzej.hu)
- Budapesti Színházak Éjszakája – [bpsze.hu](https://bpsze.hu)
- Restaurant Week – [etteremhet.hu](https://etteremhet.hu)
- Budapest100 – [budapest100.hu](https://budapest100.hu)
- Advent Bazilika – [adventbazilika.hu](https://adventbazilika.hu)
- Vörösmarty Classic Xmas – [vorosmartyclassicxmas.hu](https://vorosmartyclassicxmas.hu)
- SZIGET – [szigetfestival.com](https://szigetfestival.com)
- Gourmet Fesztivál – [gourmetfesztival.hu](https://gourmetfesztival.hu)
- Budapest Borfesztivál – [aborfesztival.hu](https://aborfesztival.hu)
- Ünnepi Könyvhét – [unnepikonyvhet.hu](https://unnepikonyvhet.hu)
- Erőművek Éjszakája – [eromuvekejszakaja.hu](https://eromuvekejszakaja.hu)
- Fővárosi Nagycirkusz – [fovarosinagycirkusz.hu](https://fovarosinagycirkusz.hu)

---

**Készült magyarul, magyar dealekhez.** 🇭🇺
