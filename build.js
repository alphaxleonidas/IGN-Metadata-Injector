#!/usr/bin/env node
// Concatenates 00-*.js .. 10-*.js (in numeric order) into one installable
// Tampermonkey userscript. Run this after editing any module:
//
//   node build.js
//
// Output: ../dist/ign-metadata-injector.user.js
"use strict";
const fs = require("fs");
const path = require("path");

const SRC_DIR = __dirname;
const OUT_DIR = path.join(__dirname, "..", "dist");
const OUT_FILE = path.join(OUT_DIR, "ign-metadata-injector.user.js");

const HEADER = `// ==UserScript==
// @name         IGN Metadata Injector
// @namespace    http://tampermonkey.net/
// @version      1.0.0
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
// THIS FILE IS GENERATED. Do not edit it directly — edit the numbered module
// files in /src and run "node build.js" to regenerate it.
// ---------------------------------------------------------------------------

`;

const moduleFiles = fs.readdirSync(SRC_DIR)
    .filter(f => /^\d{2}-.*\.js$/.test(f))
    .sort();

if (moduleFiles.length === 0) {
    console.error("No numbered module files (00-*.js .. 10-*.js) found in", SRC_DIR);
    process.exit(1);
}

const combined = moduleFiles
    .map(f => fs.readFileSync(path.join(SRC_DIR, f), "utf8").trimEnd())
    .join("\n\n");

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, HEADER + combined + "\n");

console.log(`Built ${OUT_FILE} from ${moduleFiles.length} modules:`);
moduleFiles.forEach(f => console.log("  -", f));
