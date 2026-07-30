# Combining the modules into one userscript

Tampermonkey/Greasemonkey ultimately need to run this as a single script
(or a script that pulls its pieces in via `@require`). There are three
ways to get there, from simplest to most "auto-updating."

---

## Method 1 — Local build script (recommended, no account needed)

This is the fastest option and requires nothing but Node.js.

1. Install [Node.js](https://nodejs.org/) if you don't have it.
2. Edit any of the `00-*.js` … `10-*.js` module files you want to change.
3. From this folder, run:

   ```
   node build.js
   ```

4. It writes `../dist/ign-metadata-injector.user.js` — a single file with
   the `// ==UserScript==` header plus every module concatenated in order.
5. Open that file, copy its contents, and paste them into a new/existing
   script in Tampermonkey (or drag-and-drop the `.user.js` file onto your
   browser — Tampermonkey will offer to install it directly).

Whenever you edit a module, just re-run `node build.js` and re-install
the regenerated file (Tampermonkey will prompt to update it if the
`@version` line changed, otherwise just paste over the old script body).

### No Node.js available? Plain `cat` works too

Since the modules have no build-time processing (just plain concatenation),
you don't strictly need `build.js` — you can glue them together with any
tool that concatenates text files, then manually paste the UserScript
header on top. For example, on macOS/Linux:

```
cat 00-namespace.js 01-config-store.js 02-labels.js 03-title-resolver.js \
    04-page-scraper.js 05-badge-render.js 06-settings-panel.js \
    07-ign-api.js 08-hltb-api.js 09-fetch-orchestrator.js 10-main.js \
    > combined-body.js
```

Then paste the `// ==UserScript==` … `// ==/UserScript==` block from the
top of `build.js` above the contents of `combined-body.js` into
Tampermonkey. The numeric filename prefixes exist specifically so a plain
alphabetical `cat *.js` or `ls` sort already puts them in the right order.

---

## Method 2 — Local `@require` (no concatenation at all)

Tampermonkey can load extra files at runtime via `@require`, which means
you can skip the build step entirely and edit modules live.

1. In Chrome/Firefox, enable **"Allow access to file URLs"** for the
   Tampermonkey extension (chrome://extensions → Tampermonkey → Details).
2. Create a small loader userscript containing just the metadata block
   and one `@require file:///...` line per module, in order:

   ```js
   // ==UserScript==
   // @name         IGN Metadata Injector (dev loader)
   // @namespace    http://tampermonkey.net/
   // @version      1.0.0
   // @match        https://*.steampowered.com/*
   // @match        https://*.epicgames.com/*
   // @grant        GM_xmlhttpRequest
   // @grant        GM_getValue
   // @grant        GM_setValue
   // @grant        GM_registerMenuCommand
   // @grant        GM_unregisterMenuCommand
   // @connect      www.ign.com
   // @connect      ign.com
   // @connect      mollusk.apis.ign.com
   // @connect      howlongtobeat.com
   // @require      file:///Users/you/ign-metadata-injector-src/00-namespace.js
   // @require      file:///Users/you/ign-metadata-injector-src/01-config-store.js
   // @require      file:///Users/you/ign-metadata-injector-src/02-labels.js
   // @require      file:///Users/you/ign-metadata-injector-src/03-title-resolver.js
   // @require      file:///Users/you/ign-metadata-injector-src/04-page-scraper.js
   // @require      file:///Users/you/ign-metadata-injector-src/05-badge-render.js
   // @require      file:///Users/you/ign-metadata-injector-src/06-settings-panel.js
   // @require      file:///Users/you/ign-metadata-injector-src/07-ign-api.js
   // @require      file:///Users/you/ign-metadata-injector-src/08-hltb-api.js
   // @require      file:///Users/you/ign-metadata-injector-src/09-fetch-orchestrator.js
   // @require      file:///Users/you/ign-metadata-injector-src/10-main.js
   // ==/UserScript==
   ```

3. Swap `/Users/you/ign-metadata-injector-src/` for wherever you actually
   cloned/unzipped the folder on your machine.
4. Save the loader in Tampermonkey. Now editing a module file and just
   refreshing the Steam/Epic page picks up the change immediately — no
   rebuild, no reinstall.

This is the best option while actively developing, since there's zero
lag between "save file" and "see the change." Its only downside is the
`file:///...` path is specific to your machine, so it's not something you
can share with anyone else.

---

## Method 3 — GitHub + remote `@require` (auto-updating, shareable)

This is the option to use if you want the script to update itself for
you (or others) whenever you push a change, with no manual reinstall.

1. Push this folder to a GitHub repo, e.g. `you/ign-metadata-injector`,
   with the module files under `src/` (matching this folder's layout).
2. Get the **raw** URL for each file. For a file at
   `src/00-namespace.js` on the `main` branch, that's:

   ```
   https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/00-namespace.js
   ```

3. Create a loader userscript with one `@require` per module, pointing
   at the raw URLs, in load order:

   ```js
   // ==UserScript==
   // @name         IGN Metadata Injector
   // @namespace    http://tampermonkey.net/
   // @version      1.0.0
   // @match        https://*.steampowered.com/*
   // @match        https://*.epicgames.com/*
   // @grant        GM_xmlhttpRequest
   // @grant        GM_getValue
   // @grant        GM_setValue
   // @grant        GM_registerMenuCommand
   // @grant        GM_unregisterMenuCommand
   // @connect      www.ign.com
   // @connect      ign.com
   // @connect      mollusk.apis.ign.com
   // @connect      howlongtobeat.com
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/00-namespace.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/01-config-store.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/02-labels.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/03-title-resolver.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/04-page-scraper.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/05-badge-render.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/06-settings-panel.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/07-ign-api.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/08-hltb-api.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/09-fetch-orchestrator.js
   // @require      https://raw.githubusercontent.com/you/ign-metadata-injector/main/src/10-main.js
   // @updateURL    https://raw.githubusercontent.com/you/ign-metadata-injector/main/loader.user.js
   // @downloadURL  https://raw.githubusercontent.com/you/ign-metadata-injector/main/loader.user.js
   // ==/UserScript==
   ```

4. Install that loader file once (Tampermonkey → Utilities → "Import from
   URL", or just paste it in).

### Important gotcha: caching

Tampermonkey **caches the content of every `@require` URL** the first
time it installs the script — editing the file on GitHub afterwards
does *not* automatically re-fetch it. To force a re-fetch of the
`@require`d files, bump the loader's own `// @version` number; that's
what tells Tampermonkey "go re-download everything," including all
`@require` targets. So the actual workflow is: push your module changes
→ bump `@version` in the loader script → Tampermonkey's own dashboard
"Check for updates" (or just reopen the dashboard) pulls the new
`@version` via `@updateURL` and re-fetches everything.

If you'd rather not deal with manual version bumps, point the
`@require` URLs at **jsDelivr** instead of raw GitHub — jsDelivr lets you
pin to a Git *tag* (immutable) or use `@main` (which it still caches, but
with shorter/controllable TTLs, and you can force-purge a specific file's
cache via jsDelivr's purge endpoint):

```
https://cdn.jsdelivr.net/gh/you/ign-metadata-injector@main/src/00-namespace.js
```

Either way, GitHub raw + `@require` is best when you want a single
"install once" link you can hand to someone else, and you're willing to
bump a version number each time you push a real change.
