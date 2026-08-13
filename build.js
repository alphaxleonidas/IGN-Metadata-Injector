#!/usr/bin/env node
// Two things, run together:
//
//   1. Concatenates 00-*.js .. 10-*.js (in numeric order, from src/) into one
//      installable Tampermonkey userscript -> userscript/ign-metadata-injector.user.js
//      The concatenated source is then run through Terser (compress: on,
//      mangle: off, comments stripped, wrapped at ~60 chars/line) so the
//      shipped userscript stays under ~1000 lines without renaming any
//      variables/functions — a stack trace or "view source" still reads
//      recognizably like the original code, just without the prose comments
//      and with trivial multi-statement blocks joined onto fewer lines.
//   2. Assembles two ready-to-load unpacked extension folders (no manual
//      copying/renaming needed) -> extension-chrome/ and extension-firefox/
//      These keep the full, uncompressed src/ files as-is (easier to debug
//      via the browser's extension devtools), since only the userscript
//      needs to be a single compact file.
//
// Run this after editing any module (in src/), manifest, or options page file:
//
//   node build.js
"use strict";
const fs = require("fs");
const path = require("path");
const { minify } = require("terser");

const SRC_DIR = path.join(__dirname, "src");
const ROOT_DIR = __dirname;
const USERSCRIPT_DIR = path.join(ROOT_DIR, "userscript");
const OUT_FILE = path.join(USERSCRIPT_DIR, "ign-metadata-injector.user.js");

const HEADER = `// ==UserScript==
// @name         IGN Metadata Injector
// @namespace    http://tampermonkey.net/
// @version      1.0.3
// @description  Displays IGN review scores, user ratings, clickable HLTB with dynamic category data, Developer, and prominent ESRB rating with content descriptors.
// @author       Leonidas
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
// ==/UserScript==

// ---------------------------------------------------------------------------
// THIS FILE IS GENERATED (and compacted via Terser — see build.js) from the
// numbered module files in /src. Do not edit it directly: edit those and run
// "node build.js" to regenerate it. The full, readable, commented source for
// every module lives in /src and in extension-chrome/src, extension-firefox/src.
// ---------------------------------------------------------------------------

`;

async function main() {
    // ---- 1. Userscript --------------------------------------------------
    // Only 00-10: the userscript/content-script modules. 11-options.* is the
    // extension-only settings page (chrome.storage.local, not GM_*) and must
    // never be concatenated into the userscript.
    const moduleFiles = fs.readdirSync(SRC_DIR)
        .filter(f => /^(0[0-9]|10)-.*\.js$/.test(f))
        .sort();

    if (moduleFiles.length === 0) {
        console.error("No numbered module files (00-*.js .. 10-*.js) found in", SRC_DIR);
        process.exit(1);
    }

    const combined = moduleFiles
        .map(f => fs.readFileSync(path.join(SRC_DIR, f), "utf8").trimEnd())
        .join("\n\n");

    const minified = await minify(combined, {
        compress: { defaults: true, passes: 2 },
        mangle: false,
        format: { comments: false, max_line_len: 60, beautify: false }
    });
    if (minified.error) throw minified.error;

    fs.mkdirSync(USERSCRIPT_DIR, { recursive: true });
    fs.writeFileSync(OUT_FILE, HEADER + minified.code + "\n");

    const lineCount = (HEADER + minified.code).split("\n").length;
    console.log(`Built ${OUT_FILE} from ${moduleFiles.length} modules (${lineCount} lines):`);
    moduleFiles.forEach(f => console.log("  -", f));

    // ---- 2. Ready-to-load unpacked extension folders ---------------------
    // Each browser expects the manifest literally named "manifest.json" at the
    // folder root, so this assembles a complete folder per browser: manifest.json
    // + src/00-namespace.js..10-main.js (paths the manifests' content_scripts
    // expect) + the options page files (referenced at the manifest root).
    // Unlike the userscript above, these keep the full uncompressed source.
    const optionsFiles = ["11-options.html", "11-options.css", "11-options.js", "11-background.js"];

    function buildExtensionFolder(browserName, manifestFileName) {
        const outDir = path.join(ROOT_DIR, `extension-${browserName}`);
        fs.rmSync(outDir, { recursive: true, force: true });
        fs.mkdirSync(path.join(outDir, "src"), { recursive: true });

        moduleFiles.forEach(f => {
            fs.copyFileSync(path.join(SRC_DIR, f), path.join(outDir, "src", f));
        });

        optionsFiles.forEach(f => {
            fs.copyFileSync(path.join(SRC_DIR, f), path.join(outDir, f));
        });

        fs.copyFileSync(path.join(__dirname, manifestFileName), path.join(outDir, "manifest.json"));

        console.log(`Assembled ${outDir}/ (manifest.json <- ${manifestFileName}, ${moduleFiles.length} src/ modules, ${optionsFiles.length} options files)`);
    }

    buildExtensionFolder("chrome", "manifest.chrome.json");
    buildExtensionFolder("firefox", "manifest.firefox.json");
}

main().catch(err => { console.error(err); process.exit(1); });
