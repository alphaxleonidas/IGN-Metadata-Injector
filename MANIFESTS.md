# Extension manifests

Two manifests are included so the same `src/` module files can be loaded
as an unpacked extension in either browser, unchanged. They both point at
the exact same `src/00-namespace.js` … `src/10-main.js` files described in
`LAYOUT.md` — that's the whole point of the module split: this file list
was already extension-shaped.

- `manifest.chrome.json` — for Chrome / Edge / Brave (Chromium, MV3)
- `manifest.firefox.json` — for Firefox (MV3)

Both are MV3. The only differences are:

1. Firefox requires a `browser_specific_settings.gecko` block (extension
   ID + minimum version).
2. Firefox (as of 2024) additionally requires `data_collection_permissions`
   inside that block — a disclosure of what user data the add-on collects,
   shown on the AMO listing page.

## Settings page

Both manifests declare:

```json
"options_ui": {
  "page": "11-options.html",
  "open_in_tab": true
}
```

This gives the extension a real settings page — reachable by right-clicking
the extension's icon (or its entry in `chrome://extensions` /
`about:addons`) and choosing "Options" — instead of the userscript's
in-page overlay. It opens in its own full browser tab (`open_in_tab: true`)
rather than a small popup, since the settings (toggles, drag-to-reorder,
per-title overrides) need more room than a popup comfortably gives.

Both manifests also declare:

```json
"action": {
  "default_title": "IGN Metadata Injector — click for settings"
},
"background": {
  "service_worker": "11-background.js",
  "scripts": ["11-background.js"]
}
```

This makes a **plain left-click on the pinned/toolbar icon** open the
options page too — not just the right-click → "Options" route. Without an
`action.onClicked` listener, clicking an icon that has no `default_popup`
does nothing at all by default, so `11-background.js` exists purely to
register that listener and call `chrome.runtime.openOptionsPage()` (which
respects `options_ui.open_in_tab` above, so it still opens as a full tab).

There are also two gear (`⚙`) buttons rendered directly in the page itself
— on the ESRB row, and a persistent one at the bottom of the sidebar — both
routed through the same `NS.openSettings()`, which opens this same options
page under an extension. See `LAYOUT.md`'s "Settings access points"
section for all four ways settings can be reached.

The `background` key is written for both browsers at once, per
[MDN's guidance](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/background):
Chrome (MV3) only supports `service_worker` for background scripts; Firefox
(MV3) only supports `scripts`. Both keys point at the exact same file, so
each browser just reads whichever key it understands and ignores the
other.

`11-options.html` / `11-options.css` / `11-options.js` are a **separate, self-contained**
implementation of the same settings UI as `src/06-settings-panel.js` —
intentionally so. An options page is its own document, not a content
script, so it can't reach `window.IGN_METADATA_INJECTOR`; it talks to
`chrome.storage.local` directly instead, using the same key names
(`showIgnScore`, `sectionOrder`, `badgePosition`, `hltbLocation`,
`leisureLocation`, `userTitleOverrides`, etc.) that `src/01-config-store.js`
reads/writes through `NS.storage` under an extension (see "Runtime shim"
below) — so the two stay in sync with no extra glue code.

If you rename or add a setting, keep `11-options.js`'s `CONFIG_KEYS`/
`CONFIG_DEFAULTS`/`SECTION_LABELS`/`DEFAULT_SECTION_ORDER` in step with the
matching constants in `src/01-config-store.js` — they're deliberately
duplicated (one file runs as a content script, the other as a standalone
page, so they can't share a module) rather than sharing a single file.

## Loading the extension

Running `node build.js` (from `src/`) doesn't just build the userscript —
it also assembles two complete, ready-to-load folders alongside it:

```
node build.js
```

```
../extension-chrome/     manifest.json (from manifest.chrome.json) + src/*.js + 11-options.*
../extension-firefox/    manifest.json (from manifest.firefox.json) + src/*.js + 11-options.*
```

Each is self-contained and already has the manifest named correctly and
the module files in the `src/` subfolder the manifest's `content_scripts`
expect — no manual copying or renaming needed. Load one directly:

- **Chrome/Edge/Brave**: `chrome://extensions` → enable Developer Mode →
  "Load unpacked" → select the `extension-chrome/` folder.
- **Firefox**: `about:debugging#/runtime/this-firefox` → "Load Temporary
  Add-on" → select `extension-firefox/manifest.json` (or any file inside
  the folder) — temporary add-ons are removed when Firefox closes; for a
  persistent install you'd need to sign it through AMO.

Once loaded, just left-click the extension's toolbar/pinned icon to open
the settings page directly. (Right-click → "Options" (Chrome), or
`about:addons` → the extension → "Preferences" (Firefox), still work too —
they go to the exact same page.)

If you edit anything under `src/` (or the manifests, or the options page),
re-run `node build.js` and reload the unpacked extension in the browser —
these folders are regenerated from scratch each time, not patched in place.

## About `data_collection_permissions`

```json
"data_collection_permissions": {
  "required": ["none"]
}
```

This is set to `"none"` because the extension itself never sends any
data to a server the developer controls — no analytics, no telemetry.
It does make direct requests from the user's own browser to `ign.com`
and `howlongtobeat.com` to fetch review/HLTB data for whatever game page
is open, but that's a pass-through lookup, not data collected *by* the
add-on for its developer.

If you later add real telemetry (crash reporting, usage analytics, an
update-check ping, etc.), change `"none"` to the applicable categories
from Mozilla's list, e.g.:

```json
"required": ["technicalAndInteraction"]
```

Other valid category values (per Mozilla's current schema): `authenticationInfo`,
`personallyIdentifyingInfo`, `healthInfo`, `financialAndPaymentInfo`,
`locationInfo`, `webBrowsingActivity`, `bookmarksInfo`,
`personalCommunications`, `searchTerms`. `"required"` must always be
present and non-empty (use `["none"]` if nothing applies); `"optional"`
can be added the same way if some collection only happens with explicit
user opt-in.

Also update these two placeholder values before actually publishing:

- `browser_specific_settings.gecko.id` — replace
  `"ign-metadata-injector@example.com"` with your own unique ID.
- `author` — replace `"Leonidas"` if that's not accurate.

## Runtime shim: `GM_*` calls work in both environments automatically

`src/00-namespace.js` detects which environment it's running in and exposes
`NS.storage` (`getSync`/`set`) and `NS.http` (`get`) accordingly:

- **Tampermonkey/userscript**: `NS.storage` is a thin pass-through to
  `GM_getValue`/`GM_setValue` (genuinely synchronous there), and `NS.http.get`
  is a thin pass-through to `GM_xmlhttpRequest`.
- **Real extension**: `NS.storage` hydrates an in-memory cache from
  `chrome.storage.local` once up front (`NS.storage.ready` — `10-main.js`
  waits on it before the first render) and reads/writes that cache
  synchronously afterward, persisting writes to `chrome.storage.local` in
  the background. `NS.http.get` calls `fetch()` instead, wrapped to return
  the same `{status, responseText}` shape `GM_xmlhttpRequest` callers
  already expect.

Every other file (`01-config-store.js`, `06-settings-panel.js`,
`07-ign-api.js`, `08-hltb-api.js`, `09-fetch-orchestrator.js`) calls
`NS.storage.*`/`NS.http.*` — none of them call `GM_*` directly anymore, so
there's no manual porting step left to do here. `GM_registerMenuCommand`/
`GM_unregisterMenuCommand` (the Tampermonkey-only settings menu) are the
one exception — they're simply skipped under an extension (guarded by
`typeof GM_registerMenuCommand !== 'undefined'`), since the extension has
its own dedicated settings page (`11-options.html`) instead.
