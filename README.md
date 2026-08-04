# Arcadia

A free, open-source build planner and stat optimizer for **[Soulbound: Online](https://store.steampowered.com/app/4369490/Soulbound_Online/)**.

Enter your gear and abilities, and it tells you which of the six attributes actually scale
*your* build, whether a piece of gear is an upgrade, and which abilities fit the stats you
already have.

**→ [Open Arcadia](https://arcadia.carl-prewitt.com/)**

![Arcadia with a build loaded](screenshots/planner-desktop.png)

> ### This project is finished, and everything in it is yours to take
>
> Arcadia is no longer being updated. The data here was measured by hand from the game
> during Early Access; the last snapshot is **2 August 2026**, and anything balance-related
> will drift from that date onward. Treat it as a record of what the game looked like then,
> not as a live source.
>
> **It is MIT licensed and meant to be reused.** If you are building something for this
> game, take whatever helps — there is no need to ask, and attribution is welcome but not
> demanded. Two things are worth knowing about specifically:
>
> - **[`items.json`](items.json) and [`relics.json`](relics.json)** are stable, plain JSON:
>   171 items with stats, roll pools, drop tables and the legendary effects the in-game
>   tooltip does not print, plus 165 relics across 17 abilities. Both are generated files —
>   the source is [`data.js`](data.js).
> - **[Share links that stay short](#share-links-that-stay-short)** — the encoding below
>   turns a full build into a 473-character URL with no server involved, or 40 characters
>   with one. If your own share links are unwieldy, that section is the useful part of this
>   repo.
>
> Corrections to the data are still worth filing as issues even though the site is static;
> anyone who forks this will see them.

## What it does

- **Attribute totals** from your gear, live as you type.
- **Stat priority** — ranks attributes by how many of *your* equipped abilities use them, and
  shows how saturated each one already is.
- **Compare an item** — pick a slot, enter a candidate's rolls, and get a verdict: what changes,
  which abilities gain or lose, and by how much.
- **Ability match** — scores every ability against your current stats, so you can spot one that's
  wasting your build.
- **Screenshot import** — drop a tooltip screenshot and it reads the rolls with on-device OCR.
  Nothing is uploaded; double-check the numbers, since it's reading a pixel font.
- **The honest tooltip** — each item is drawn as its in-game tooltip *plus* the ruled-off section
  the game leaves out: the hidden stats and the legendary effect. Where a name covers two tiers
  with different effects, it shows both and says which is which.
- **Relic advisor** — reads your loadout and ranks which relic pools a run can actually offer it.
- **Ability-scoped gear** — shows which of your abilities each `[Gun]`-style tagged roll actually
  boosts.
- **Share links** — the whole build encodes into the URL. Paste it in Discord; nothing is uploaded,
  and the link unfurls with the build's abilities and gear, not a generic card.
- **Gear library** — documented items you can load into any slot with one click.

## Item and relic pages

Every item also has its own page — [`/item/<name>`](https://arcadia.carl-prewitt.com/items) — with
its stats, what it can roll, where it drops, and the hidden legendary effect. These are plain pages
a search engine can index and you can link in chat, and they say the one thing a tier-less wiki
list cannot: when a Tier 5 and a Tier 6 item share a name, how their effects differ.

[`/relics`](https://arcadia.carl-prewitt.com/relics) does the same for the 165 measured relics,
grouped by the ability that unlocks them, because that is how the game hands them out. Each pool
page shows every upgrade step in order, keeps the one-off relics separate from the ones with an
upgrade path, and flags the damage-conversion relics — converting your damage type is the quickest
way to make the gear you are wearing stop scaling you.

## Things it can tell you that aren't documented elsewhere

- Every ability is scaled by **exactly three of the five offensive attributes**.
  **Vitality scales none of them** — it's health, regen and resistances only.
- **An item's level equals the sum of its primary attribute points.** Item level is a fixed
  budget; two items of the same level differ only in how that budget is split.
- **Percentage stats have diminishing returns.** The first point of an attribute can be worth
  ~5× the thirty-fourth. Flat stats (max health, regen) stay linear.
- `[Gun]` is a **category** tag — it boosts Gleam Twins, Minigun and Machinegun alike, while
  `[Pyrosphere]` or `[Chakram]` target a single ability.
- **Some legendary effects never print on the in-game tooltip at all** — and some are the whole
  reason to run the item. Arcadia lists the ones that have been measured, including every belt and
  necklace effect, which the community wiki does not yet cover.

## On mobile

<img src="screenshots/planner-mobile.png" width="320" alt="Arcadia on a phone">

## Running it

No build step, no dependencies, no server. The planner is four static files that load with plain
`<script>` tags:

| file | holds |
|---|---|
| `index.html` | the page shell |
| `arcadia.css` | all styles |
| `data.js` | the game data (items, effects, relics) |
| `app.js` | the logic |

```
git clone https://github.com/rages4calm/arcadia.git
```

Open `index.html` in a browser, or drop the folder on any static host — it works straight from
`file://` too. Your builds are stored in your own browser's local storage and never leave your
machine. The optional item pages (`/item/<name>`) are rendered by `item.php` and need PHP; the
planner itself does not.

## Share links that stay short

A build encodes into the URL itself, so a shared link needs no server and never expires.
The reason it fits is two steps, and the first one does most of the work. Measured on the
example build that ships with the tool:

| | chars |
|---|---|
| the build as plain JSON | 2,076 |
| **rewritten with indices instead of names** | **680** (−67%) |
| base64url of that | 907 |
| **deflate-raw, then base64url** | **437** (−52% again) |
| full URL, uncompressed | 943 |
| **full URL, compressed** | **473** |
| full URL, with the optional backend below | 40 |

**Step 1 — stop shipping names.** Nothing in the payload spells anything out. An ability
becomes its index in `ABILITIES`, a stat becomes its index in `ALLSTATS`, a slot is implied
by its position in a fixed-length array, and a roll is a 4-element array rather than an
object with keys. `{"s":"critical_strike_damage","p":0,"v":26}` becomes `[14,0,26,0]`.
This is where two thirds of the size goes, and it needs no browser features at all.

**Step 2 — compress what's left**, with `CompressionStream`, which is native in every
current browser and needs no library:

```js
const bytes = new TextEncoder().encode(JSON.stringify(payload));
const cs = new CompressionStream('deflate-raw');
cs.writable.getWriter().write(bytes);            // then .close()
const out = new Uint8Array(await new Response(cs.readable).arrayBuffer());
const link = 'c.' + b64url(out);                 // b64url = base64, +/ → -_, no padding
```

Two details that matter more than they look:

- **The `c.` marker.** Compressed links carry it, older ones don't, and the decoder
  branches on it. That is what let compression be added without breaking a single link
  that had already been shared. If you retrofit this, add the marker on day one.
- **Positions are permanent.** Because the payload stores *indices*, reordering `ABILITIES`
  or the slot list silently changes what every previously shared link means. Append only.
  This has already cost this project one ability slot in older links.

There is a real cost: encoding and decoding become `async`, so a link now resolves after
first paint rather than during it. Worth it, and the uncompressed path stays as a fallback
for anything without `CompressionStream`.

### Even shorter, with a small backend (optional)

Everything above works on a static host. This step is only for `/b/x7k2p`-style links —
about 40 characters, which matters because some chat filters flag long URLs. Arcadia never
depends on it: with no backend, the share button falls back to the long self-contained link
in about 10ms and says so.

Takes about five minutes in cPanel.

### 1. Create the database

cPanel → **MySQL Databases**

1. Create a database, e.g. `arcadia`. cPanel prefixes it with your account name, so you'll
   end up with something like `carlpre_arcadia`.
2. Create a user, e.g. `arcadia`, with a strong password. Save the password.
3. Under **Add User To Database**, add that user to that database with **ALL PRIVILEGES**.

### 2. Create the tables

cPanel → **phpMyAdmin** → select your new database → **SQL** tab → paste the contents of
`schema.sql` → **Go**.

You should end up with two tables: `builds` and `rate_limit`.

### 3. Add your credentials

Copy `api/config.example.php` to `api/config.php` and fill in the four database values plus a
random `ip_salt` (any long random string — it's used so IP addresses are hashed rather than
stored).

**`config.php` must never be committed to git.** It's already in `.gitignore`.

### 4. Upload

Into your subdomain's folder (`public_html/arcadia`):

```
index.html
arcadia.css
data.js
app.js
fonts/                the two woff2 files
robots.txt
sitemap.xml
.htaccess
api/build.php
api/config.php        ← the one you just filled in, not the example
```

`.htaccess` is what makes `/b/x7k2p` work, so don't skip it. If your FTP client hides dotfiles,
enable "show hidden files".

For the optional catalogue pages, also upload `item.php`, `items.json`, `sitemap-items.xml`,
`relic.php`, `relics.json` and `sitemap-relics.xml`; for the build gallery, `gallery.html` and
`api/gallery.php` (see below). `b.php` renders the rich link
preview for a shared build — upload it too, but the app works without it.

### 5. Check it

```bash
curl -X POST https://arcadia.carl-prewitt.com/api/build.php \
  -H "Content-Type: application/json" -d '{"p":"c.testtesttest"}'
```

Expect `{"id":"abc12"}`. Then open `https://arcadia.carl-prewitt.com/b/abc12` — it should load
the app (it'll fail to decode that fake payload, which is fine; you're testing routing).

Real test: open Arcadia, load a build, press **Copy share link**. You should get a short URL and
the toast should say "Short link copied".

### If something's wrong

| Symptom | Cause |
|---|---|
| Toast says "short links unavailable" | PHP couldn't run, or `config.php` is missing/wrong. The long link still works, so nothing is broken for users. |
| `Server not configured` | `config.php` isn't there, or isn't next to `build.php`. |
| `Database unavailable` | Credentials wrong, or the user wasn't added to the database with privileges. |
| `/b/xxxxx` 404s | `.htaccess` didn't upload, or the host has `AllowOverride` off — ask support to enable it. |
| `Slow down a moment` | Rate limit hit (30/hour per address). Raise `rate_limit_per_hour` in config. |

### What gets stored

Only the encoded build string, a creation timestamp, and a view counter. No accounts, no personal
data. IP addresses are salted-hashed purely for rate limiting and expire after an hour.

Identical builds reuse the same id, so re-sharing the same build doesn't grow the table.

### Housekeeping

Nothing required. If you ever want to prune unused builds:

```sql
DELETE FROM builds WHERE hits = 0 AND created_at < (NOW() - INTERVAL 90 DAY);
```

## Build gallery (optional)

`gallery.html` lists builds players have published, sorted by votes or recency and filterable by
ability. Voting needs no account — it's one vote per address, stored as a salted hash.

Builds are **private by default**: sharing a link stores a build but does not list it. Publishing
is a separate, deliberate step in the planner.

To enable it, run `schema-gallery.sql` once in phpMyAdmin (after `schema.sql`) and upload
`gallery.html` plus `api/gallery.php`.

**Moderation.** Put a long random string in `api/config.php` as `admin_token`, then open the
gallery, expand **Moderation** at the bottom, and paste it in. A **Hide this build** button appears
on every card. The token is stored in your browser only, and the box is collapsed and unlabelled
enough that ordinary visitors won't think about it.

Without the backend the gallery page says so plainly and the planner is unaffected.

## If you fork this

Nobody is merging PRs here any more, so the useful move is to fork it or lift the parts you
want. Issues are still worth opening — corrections stay visible to anyone who forks, and a
wrong number recorded publicly is better than a wrong number nobody flagged.

### Where things live

| file | what it is |
|---|---|
| `data.js` | **the source** for all game data — items, effects, relics, abilities |
| `app.js` | all the logic |
| `arcadia.css` | all the styles |
| `index.html` | a 14 KB shell; the three files above do the work |
| `items.json`, `relics.json`, `sitemap-*.xml` | **generated** from `data.js` |
| `item.php`, `relic.php` | render the generated JSON into pages |
| `b.php` | rewrites the `og:` tags so a shared build link previews as that build |

**Edit `data.js`, never the JSON** — the JSON is build output. Regenerating it is a small
script that reads the consts out of `data.js` by evaluating it (they carry comments and
trailing commas, so no JSON parser will take them) and writes the two files plus their
sitemaps. That script isn't in the repo, but it is about a hundred lines and the shape of
the output is obvious from the files themselves.

The datasets are written **one entry per line** on purpose: as single lines, git cannot
merge two people adding different items. Worth keeping if you build on this.

The `?v=` on each asset is a **hash of that file's contents**, and they are served with a
one-year cache. If you change `data.js` or `app.js` and don't change the hash, returning
visitors get the old file for a year and it looks exactly like a deploy that didn't happen.

### What is still missing, if you want to finish it

- **55 items** are known to drop a Legendary version whose effect nobody recorded —
  listed at [`/gaps`](https://arcadia.carl-prewitt.com/gaps).
- **8 internal cloak ids** seen in play with no name and no stats. They are *not* the named
  back items the wiki documents; nobody has joined the two lists.
- The community wiki has **far more items** than are here (roughly 1,900 rows via its public
  API). This project only ever held what was measured directly, which is why its item count
  is small and its effect data is not.

## Disclaimer

This project is an independent creation and is not affiliated with, endorsed, or sponsored by
Soulbound. View the official Fan Content Policy at
[soulbound.game/legal-portal/fan-content](https://soulbound.game/legal-portal/fan-content).

Built in accordance with the
[Third-Party Extensions & Plugins Policy](https://soulbound.game/legal-portal/third-party-extensions):
it is free, uses no game art or assets, and claims no affiliation. All game names and trademarks
belong to their respective owners. Values are community-maintained approximations that can change
with game updates — always trust your in-game stat panel over this tool.

## License

[MIT](LICENSE)
