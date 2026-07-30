# Extension manifests

Two manifests are included so the same `src/` module files can be loaded
as an unpacked extension in either browser, unchanged. They both point at
the exact same `src/00-namespace.js` … `src/10-main.js` files described in
`README.md` — that's the whole point of the module split: this file list
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
  "page": "options.html",
  "open_in_tab": true
}
```

This gives the extension a real settings page — reachable by right-clicking
the extension's icon (or its entry in `chrome://extensions` /
`about:addons`) and choosing "Options" — instead of the userscript's
in-page overlay. It opens in its own full browser tab (`open_in_tab: true`)
rather than a small popup, since the settings (toggles, drag-to-reorder,
per-title overrides) need more room than a popup comfortably gives.

`options.html` / `options.css` / `options.js` are a **separate, self-contained**
implementation of the same settings UI as `src/06-settings-panel.js` —
intentionally so. An options page is its own document, not a content
script, so it can't reach `window.IGN_METADATA_INJECTOR` or call `GM_*`
functions; it talks to `chrome.storage.local` directly instead, using the
same key names (`showIgnScore`, `sectionOrder`, `badgePosition`,
`hltbLocation`, `leisureLocation`, `userTitleOverrides`, etc.) that
`src/01-config-store.js` will use once its `GM_getValue`/`GM_setValue`
calls are swapped for `chrome.storage.local` (see the porting note below) —
so the two stay in sync without any extra glue code once that swap happens.

If you rename or add a setting, keep `options.js`'s `CONFIG_KEYS`/
`CONFIG_DEFAULTS`/`SECTION_LABELS`/`DEFAULT_SECTION_ORDER` in step with the
matching constants in `src/01-config-store.js` — they're deliberately
duplicated (one file runs as a content script, the other as a standalone
page, so they can't share a module) rather than sharing a single file.

## Using either manifest

Since both browsers expect the file literally named `manifest.json`, pick
one and copy/rename it:

```
cp manifest.chrome.json manifest.json      # for Chrome
# or
cp manifest.firefox.json manifest.json     # for Firefox
```

Then load it as an unpacked extension:

- **Chrome/Edge/Brave**: `chrome://extensions` → enable Developer Mode →
  "Load unpacked" → select this folder.
- **Firefox**: `about:debugging#/runtime/this-firefox` → "Load Temporary
  Add-on" → select `manifest.json` (or any file inside the folder) —
  temporary add-ons are removed when Firefox closes; for a persistent
  install you'd need to sign it through AMO.

Once loaded, right-click the extension's toolbar icon → "Options" (Chrome)
or open `about:addons` → the extension → "Preferences" (Firefox) to reach
the settings page.

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

## Porting note: `GM_*` calls

`src/01-config-store.js` (settings) and `src/06-settings-panel.js` (one
`GM_setValue` call in its save handler) still call `GM_getValue` /
`GM_setValue` / `GM_registerMenuCommand`, which don't exist outside a
userscript manager. Loading these manifests as-is will throw on those
calls. Swap them for `chrome.storage.local.get/set` (both manifests
already request the `"storage"` permission for this) before actually
running this as an extension — that's the one bit of real porting work,
and it's isolated to those two files as noted in `README.md`.
