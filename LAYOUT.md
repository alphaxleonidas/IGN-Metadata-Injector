# IGN Metadata Injector — module layout

The original single-file userscript has been split into 11 small files, each
owning one concern. They all attach their exports to one shared object,
`window.IGN_METADATA_INJECTOR` (abbreviated `NS` inside each file), instead of using
the global scope directly. That's the only thing every file depends on —
as long as a function's `NS.name` doesn't change, you can rewrite its
insides freely without touching any other file.

```
00-namespace.js        shared state (IS_STEAM/IS_EPIC, isFetching, etc.), escapeHtml, NS.storage/NS.http runtime shim (GM_* vs. extension APIs)
01-config-store.js     settings (via NS.storage), section order, badge position, Tampermonkey menu
02-labels.js           ESRB / HLTB display-label normalization tables
03-title-resolver.js   store title -> candidate IGN slug guesses (aliases, roman numerals, bundles)
04-page-scraper.js     reads the CURRENT Steam/Epic page (title, reviews, insertion point)
05-badge-render.js     builds badge HTML and inserts it into the page
06-settings-panel.js   the in-page settings overlay UI
07-ign-api.js          fetches + parses ign.com pages, IGN site search
08-hltb-api.js         fetches + parses howlongtobeat.com pages, per-title overrides
09-fetch-orchestrator.js  decides which fetch functions to call, in what order/fallback chain
10-main.js             bootstrapping: init(), MutationObserver, menu registration
11-options.html/css/js extension-only standalone settings page (chrome.storage.local, no NS/GM_*)
11-background.js       extension-only: toolbar icon click -> opens the options page
build.js               concatenates 00-10 into one installable .user.js, assembles extension-chrome/ and extension-firefox/
```

## Editing something

Because each file only reaches into others through `NS.*` functions, most
edits stay contained to one file:

- Tweak colors/spacing of a section → `05-badge-render.js` only.
- Fix a title that won't resolve → add an alias to `TITLE_ALIASES` in
  `03-title-resolver.js` only.
- IGN changes their page markup → `07-ign-api.js` only.
- HowLongToBeat changes their table markup → `08-hltb-api.js` only.
- Add a new toggle-able section → add the key to `01-config-store.js`,
  add a `buildXRow()` in `05-badge-render.js`, wire it into the
  `sectionHtml` maps already in that same file. `09`/`10` don't change.

## Settings access points

There are now four ways to reach settings, all routed through the same
`NS.openSettings()` (`06-settings-panel.js`), which opens the in-page
overlay under Tampermonkey or `chrome.runtime.openOptionsPage()` under a
real extension:

- The gear (`⚙`) on the far right of the ESRB row (`buildEsrbRow` in
  `05-badge-render.js`).
- A persistent "⚙ Settings" button at the bottom of the sidebar
  (`NS.renderSettingsGearStandalone`, also in `05-badge-render.js`),
  rendered on every `NS.init()` pass regardless of whether IGN data
  resolved for the page — it's most useful exactly when it didn't, to add
  a manual override for that title.
- Left-clicking the extension's toolbar icon (`11-background.js`, extension only).
- The Tampermonkey menu command (`10-main.js`, userscript only).

Both gear buttons share one class, `ign_open_settings_gear`, handled by a
single delegated `document` click listener in `06-settings-panel.js` —
new gear buttons anywhere else in the badge HTML just need that same
class, no new listener wiring required.

## HLTB / Leisure placement

Each of HLTB and HLTB Leisure Time has two independent settings:

- **Location** (`NS.getHltbLocation`/`NS.getLeisureLocation`): `'inline'`
  (rendered as a section inside the main badge — reorderable via the
  drag-and-drop Section Order list) or any of the same page positions the
  main badge itself can use, rendering as its own standalone element.
- **Above main badge** (`NS.getHltbAboveMain`/`NS.getLeisureAboveMain`):
  only meaningful when Location isn't `'inline'`. When true, the standalone
  element is inserted directly via `mainBadge.parentNode.insertBefore(...)`
  instead of using its own Location's resolved target — guaranteeing it
  visually sits right above the main IGN Overview badge, since whether a
  given position/insertion-type combination naturally lands "above" or
  "below" varies by container (`'prepend'` vs `'append'` vs `'before'` vs
  `'after'` all behave differently once two things are inserted at the
  same target). See the comment on `NS.renderStandaloneSection` in
  `05-badge-render.js` for the full reasoning.

## Placement scope & per-site enable

- **Placement sharing** (`NS.getPlacementShared`/`setPlacementShared`, stored
  as `"placementShared"`, default `false`): off (default) shows one overlay
  position / HLTB location / Leisure location column per enabled platform,
  independently adjustable, same as before. On, it shows a single "Steam +
  Epic" column and writes that one value to both platforms' storage keys.
  The underlying per-platform storage keys never change, so toggling sharing
  on and off doesn't lose either platform's saved value.
- **Per-site enable** (`NS.getSiteEnabled`/`setSiteEnabled`, stored as
  `"enabledSteam"`/`"enabledEpic"`, default `true`): checked once at the top
  of `NS.init()` (`10-main.js`). When off, the standalone settings gear still
  renders (so the site can be re-enabled) but nothing else does. A disabled
  platform also drops out of `NS.getVisiblePlatforms()`, so its placement
  column disappears from the settings UI automatically.

## Epic per-position mapping

`NS.getTargetInsertionPoint` (`04-page-scraper.js`) now maps all named
positions for Epic, not just a single hardcoded fallback:

- `aboveTitle` → before the `<h1>` wrapping the `[data-testid="pdp-title"]` span.
- `sidebarBottom` / `belowRightSidebarMetadata` → both settle on the same spot
  (after the whole `<aside>` row, re-aligned under it), since Epic has no
  SteamDB-style external-links row distinct from the purchase sidebar itself.
- `abovePrice` → before the About/description block's `<h2>` (matched by
  text content equal to the page's title, not by Epic's auto-generated —
  and unstable — class names), since Epic's actual price/buy-box lives in
  the sidebar rather than the main content column.
- `belowLeftSidebar` → Steam: right after "System Requirements" (the
  `.sys_req` block and its fade/read-more overlay share one
  `.game_page_autocollapse_ctn` wrapper — insert after that whole wrapper),
  staying inside `.leftcol`'s normal block flow so no `findSafeAfterTarget`/
  `alignTo` is needed there. Epic: right after the whole "System Requirements"
  section (heading + card), found via the section-heading `<h3>` text and its
  two-level wrapper (`h3` → title div → outer section div — the same pattern
  "Follow Us"/"Editions"/"DLC"/"Ratings" sections use site-wide). Inserting
  after that outer section — rather than after just the OS tabs inside the
  card — keeps the badge outside the requirements card's rounded background
  instead of squeezed inside it between the tabs and the Login/Languages/
  legal rows. Falls back to right after the tabs (`commonAncestorChild`
  against whichever info block — login accounts or languages — comes next),
  then to the old "after the whole info section" target (`alignTo`'d to the
  left column) if even that anchor isn't found.
- Steam's `belowLeftSidebar` fallback wraps its target in
  `NS.findSafeAfterTarget` before inserting: `.leftcol` sits next to
  `.rightcol` as a flex/grid item, so inserting directly after it would just
  add a third item to that row (a new parallel column) rather than dropping
  below both columns. Both platforms' fallback also pass `alignTo` (Steam:
  the original `.leftcol`; Epic: the left content column found via `aside`'s
  previous sibling) so `insertAtTarget`'s alignTo re-measures and pins the
  badge's width/left-offset to that column — otherwise `BADGE_STYLE`'s
  `width: 100%` stretches full page width once escaped out of the column
  layout.

This is also what fixes standalone HLTB colliding with the main badge on
Epic: previously every position resolved to the exact same hardcoded
`prepend` target, so the main badge and any standalone section fought over
identical insertion points; now each position is a genuinely distinct
container/insertion combination, same as Steam already had.

## Building the installable userscript

Tampermonkey needs one file. After editing any module, run:

```
node build.js
```

This reads every `NN-*.js` file in numeric order, prepends the
`// ==UserScript==` metadata block, and writes
`userscript/ign-metadata-injector.user.js` — install/update that file in
Tampermonkey.

(If you'd rather avoid the build step during development, Tampermonkey's
`@require file:///absolute/path/to/00-namespace.js` etc. also works locally
once "Allow access to file URLs" is enabled for the extension — but paths
are machine-specific, so this repo ships the build script instead.)

## Porting to a browser extension later

The module boundaries were chosen to map directly onto a `content_scripts`
entry's `js` array in `manifest.json`:

```json
"content_scripts": [{
  "matches": ["*://*.steampowered.com/*", "*://*.epicgames.com/*"],
  "js": [
    "00-namespace.js", "01-config-store.js", "02-labels.js",
    "03-title-resolver.js", "04-page-scraper.js", "05-badge-render.js",
    "06-settings-panel.js", "07-ign-api.js", "08-hltb-api.js",
    "09-fetch-orchestrator.js", "10-main.js"
  ]
}]
```

Multiple files listed there share one isolated-world `window` per frame,
same as `window.IGN_METADATA_INJECTOR` does here — so the files themselves barely
need to change.

Two ready-to-edit manifests are included — `manifest.chrome.json` and
`manifest.firefox.json` — both pointing at the same `src/00-namespace.js`
… `src/10-main.js` files. See **`MANIFESTS.md`** for how to load them and
for the `data_collection_permissions` field Firefox now requires.

The `GM_*` calls (`GM_getValue`/`GM_setValue`/`GM_xmlhttpRequest`/menu
commands) — the only thing that would otherwise differ between Tampermonkey
and a real extension — are already abstracted away: `00-namespace.js`
detects the environment at load time and exposes `NS.storage.getSync/set`
and `NS.http.get`, which every other file calls instead of touching `GM_*`
directly. Under Tampermonkey those are thin pass-throughs to the real
`GM_*` functions; under an extension they use `chrome.storage.local` and
`fetch()` instead. See `MANIFESTS.md`'s "Runtime shim" section for the
details — there's no manual swap left to do here.
