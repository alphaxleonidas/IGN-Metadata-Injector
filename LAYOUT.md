# IGN Metadata Injector — module layout

The original single-file userscript has been split into 11 small files, each
owning one concern. They all attach their exports to one shared object,
`window.IGN_METADATA_INJECTOR` (abbreviated `NS` inside each file), instead of using
the global scope directly. That's the only thing every file depends on —
as long as a function's `NS.name` doesn't change, you can rewrite its
insides freely without touching any other file.

```
00-namespace.js        shared state (IS_STEAM/IS_EPIC, isFetching, etc.), escapeHtml
01-config-store.js     GM_getValue/GM_setValue settings, section order, badge position, Tampermonkey menu
02-labels.js           ESRB / HLTB display-label normalization tables
03-title-resolver.js   store title -> candidate IGN slug guesses (aliases, roman numerals, bundles)
04-page-scraper.js     reads the CURRENT Steam/Epic page (title, reviews, insertion point)
05-badge-render.js     builds badge HTML and inserts it into the page
06-settings-panel.js   the in-page settings overlay UI
07-ign-api.js          fetches + parses ign.com pages, IGN site search
08-hltb-api.js         fetches + parses howlongtobeat.com pages, per-title overrides
09-fetch-orchestrator.js  decides which fetch functions to call, in what order/fallback chain
10-main.js             bootstrapping: init(), MutationObserver, menu registration
build.js               concatenates 00-10 into one installable .user.js
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

## Building the installable userscript

Tampermonkey needs one file. After editing any module, run:

```
node build.js
```

This reads every `NN-*.js` file in numeric order, prepends the
`// ==UserScript==` metadata block, and writes
`../dist/ign-metadata-injector.user.js` — install/update that file in
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

The only *real* porting work left after that is swapping the `GM_*` calls
for extension equivalents, and each is already isolated to a single file:

- `GM_getValue` / `GM_setValue` / `GM_registerMenuCommand` /
  `GM_unregisterMenuCommand` → only in `01-config-store.js` (settings)
  and the one `GM_setValue` call in `06-settings-panel.js`'s save handler
  → swap for `chrome.storage.local` + `chrome.contextMenus` or an
  extension options page.
- `GM_xmlhttpRequest` → only in `07-ign-api.js` and `08-hltb-api.js` →
  swap for `fetch()` (a `host_permissions` entry replaces `@connect`).
