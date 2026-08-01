# Arcadia

A free, open-source build planner and stat optimizer for **[Soulbound: Online](https://store.steampowered.com/app/4369490/Soulbound_Online/)**.

Enter your gear and abilities, and it tells you which of the six attributes actually scale
*your* build, whether a piece of gear is an upgrade, and which abilities fit the stats you
already have.

**→ [Open Arcadia](https://arcadia.carl-prewitt.com/)**

![Arcadia with a build loaded](screenshots/planner-desktop.png)

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

## Short links (optional)

Optional. Arcadia works fine without this — the share button just produces the long
self-contained link instead. Set this up if you want `arcadia.carl-prewitt.com/b/x7k2p`.

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

## Contributing

The most useful contribution is **gear data**. The game has far more items than are documented
here, and the roll pools aren't published anywhere — so the library grows from real tooltips.

- Found an item that isn't in the library? Open an issue with a screenshot of the tooltip.
- Spotted a number that looks wrong? Open an issue — the in-game panel is always the authority.
- Know what a missing legendary effect does? [The gaps list](https://arcadia.carl-prewitt.com/gaps)
  has a **record** link on every blank that opens a prefilled issue. A tooltip that shows *nothing*
  is a useful answer too — some effects genuinely aren't printed.

### Where things live

| file | what it is |
|---|---|
| `data.js` | **the source** for all game data — items, effects, relics, abilities |
| `app.js` | all the logic |
| `arcadia.css` | all the styles |
| `items.json`, `relics.json`, `sitemap-*.xml` | **generated** from `data.js` |

**Edit `data.js`, never the JSON.** `items.json` and `relics.json` are build output that gets
regenerated on deploy, so a change made directly to them is overwritten. Open a PR against
`data.js` and the pages rebuild from it.

Each dataset is written one entry per line on purpose — two people adding different items produce
a clean one-line diff each instead of a conflict in a 60 KB line. Please keep that shape.

The scripts that do the regenerating aren't in this repo; they're part of the maintainer's local
setup and aren't needed to contribute. If a PR changes `data.js`, the rebuild happens on the way
out.

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
