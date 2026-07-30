// ==UserScript==
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

// ===================================================================
// IGN Rating Badge — 00: Shared namespace & tiny cross-cutting utils
// ===================================================================
// Every other file attaches its exports to this one object instead of
// the global scope. This is the ONLY thing every other file depends on,
// so as long as the NS.* names below don't change, every other file can
// be edited freely without touching the rest.
//
// This file MUST load first (it creates window.IGN_METADATA_INJECTOR). Load order
// after that doesn't matter for correctness — nothing runs until
// 10-main.js calls init() — but the numeric prefixes keep the files in
// a sensible reading order.
(function (NS) {
    'use strict';

    NS.IS_STEAM = window.location.hostname.includes('steampowered.com');
    NS.IS_EPIC = window.location.hostname.includes('epicgames.com');

    // Mutable runtime state shared across modules (fetch-in-progress guard,
    // last title processed, MutationObserver debounce handle). Kept in one
    // place so it's obvious it's the only shared mutable state in the app.
    NS.state = {
        isFetching: false,
        lastProcessedTitle: '',
        debounceTimer: null
    };

    NS.escapeHtml = function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 01: Settings storage & Tampermonkey menu
// ===================================================================
// Anything backed by GM_getValue/GM_setValue lives here: feature toggles,
// section ordering, and badge placement — plus the Tampermonkey menu that
// flips the toggles. This is the ONLY file that touches GM_registerMenuCommand
// or GM_getValue/GM_setValue for settings, so if you ever port this to an
// extension, this is the one file that needs to swap to chrome.storage.
//
// To add a new setting: add it to CONFIG_KEYS/CONFIG_DEFAULTS. Nothing
// elsewhere needs to change — other files just call NS.getConfig('key').
(function (NS) {
    'use strict';

    const CONFIG_KEYS = {
        showIgnScore: 'Show IGN Score',
        showUserRating: 'Show User Rating',
        showHltb: 'Show HowLongToBeat',
        showLeisure: 'Show HLTB Leisure Times',
        showSteamReviews: 'Show Steam Reviews',
        showDeveloper: 'Show Developer',
        showEsrb: 'Show ESRB Rating & Descriptors',
        showAward: 'Show IGN Award / Leaderboard'
    };

    const CONFIG_DEFAULTS = {
        showIgnScore: true,
        showUserRating: true,
        showHltb: true,
        showLeisure: true,
        showSteamReviews: true,
        showDeveloper: true,
        showEsrb: true,
        showAward: true
    };

    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;

    NS.getConfig = function getConfig(key) {
        return GM_getValue(key, CONFIG_DEFAULTS[key]);
    };

    // ---- Section ordering (used by both rendering and the settings panel) ----
    const SECTION_LABELS = {
        scores: 'IGN Score / User Rating',
        steamReviews: 'Steam Reviews',
        award: 'Leaderboard Rank',
        esrb: 'ESRB Rating',
        developer: 'Developer',
        hltb: 'HowLongToBeat',
        leisure: 'HLTB Leisure Time'
    };
    const DEFAULT_SECTION_ORDER = ['scores', 'steamReviews', 'award', 'esrb', 'developer', 'hltb', 'leisure'];

    NS.SECTION_LABELS = SECTION_LABELS;
    NS.DEFAULT_SECTION_ORDER = DEFAULT_SECTION_ORDER;

    NS.getSectionOrder = function getSectionOrder() {
        const stored = GM_getValue('sectionOrder', null);
        if (!Array.isArray(stored) || stored.length === 0) return [...DEFAULT_SECTION_ORDER];
        // Keep only known keys, then append any new sections the user's saved order predates
        const known = stored.filter(key => DEFAULT_SECTION_ORDER.includes(key));
        const missing = DEFAULT_SECTION_ORDER.filter(key => !known.includes(key));
        return [...known, ...missing];
    };

    NS.setSectionOrder = function setSectionOrder(order) {
        GM_setValue('sectionOrder', order);
    };

    // ---- Overlay position (where the whole badge gets inserted on the page) ----
    NS.BADGE_POSITION_OPTIONS = [
        { value: 'default', label: 'Default (near header / reviews)' },
        { value: 'aboveTitle', label: "Above the game's title" },
        { value: 'sidebarBottom', label: 'Bottom of right sidebar metadata' },
        { value: 'abovePrice', label: 'Above price / buy box (Steam only)' },
        { value: 'aboveExternalLinks', label: 'Above external links row (SteamDB, ProtonDB, etc.)' },
        { value: 'belowExternalLinks', label: 'Below external links row (SteamDB, ProtonDB, etc.)' }
    ];

    NS.getBadgePosition = function getBadgePosition() {
        return GM_getValue('badgePosition', 'default');
    };

    NS.setBadgePosition = function setBadgePosition(value) {
        GM_setValue('badgePosition', value);
    };

    // ---- HLTB / HLTB Leisure Time locations (independent of the main badge & each other) ----
    // Either can stay 'inline' (rendered as a section inside the main badge, in its usual
    // section-order position — the original/default behavior) or be pulled out to its own
    // standalone element at any of the same page locations the main badge can use.
    NS.HLTB_LOCATION_OPTIONS = [
        { value: 'inline', label: 'Inline within main badge (default)' },
        ...NS.BADGE_POSITION_OPTIONS
    ];

    NS.getHltbLocation = function getHltbLocation() {
        return GM_getValue('hltbLocation', 'inline');
    };
    NS.setHltbLocation = function setHltbLocation(value) {
        GM_setValue('hltbLocation', value);
    };

    NS.getLeisureLocation = function getLeisureLocation() {
        return GM_getValue('leisureLocation', 'inline');
    };
    NS.setLeisureLocation = function setLeisureLocation(value) {
        GM_setValue('leisureLocation', value);
    };

    NS.isInlineLocation = function isInlineLocation(value) {
        return !value || value === 'inline';
    };

    // ---- Manual per-title overrides ----
    // Future-proofing for games that never resolve on their own: force an exact IGN game
    // page and/or an exact HowLongToBeat page for one title, keyed by the store title
    // lowercased/trimmed (same matching convention as the hardcoded override tables in
    // 03-title-resolver.js and 08-hltb-api.js). Unlike those hardcoded tables, this one is
    // meant to be edited from the settings panel at runtime, no code changes required.
    NS.getUserOverrides = function getUserOverrides() {
        return GM_getValue('userTitleOverrides', {});
    };

    NS.setUserOverrides = function setUserOverrides(overridesObj) {
        GM_setValue('userTitleOverrides', overridesObj);
    };

    // Adds/updates one entry. Pass '' (or omit) for a field to leave it unset.
    NS.setUserOverride = function setUserOverride(title, ignUrl, hltbUrl) {
        const key = title.trim().toLowerCase();
        if (!key) return;
        const all = NS.getUserOverrides();
        all[key] = { displayTitle: title.trim(), ignUrl: ignUrl ? ignUrl.trim() : '', hltbUrl: hltbUrl ? hltbUrl.trim() : '' };
        NS.setUserOverrides(all);
    };

    NS.removeUserOverride = function removeUserOverride(key) {
        const all = NS.getUserOverrides();
        delete all[key];
        NS.setUserOverrides(all);
    };

    // Looks up a title the same way the rest of the app matches titles (lowercase + trim).
    // Returns { displayTitle, ignUrl, hltbUrl } or null.
    NS.getUserOverrideForTitle = function getUserOverrideForTitle(title) {
        const all = NS.getUserOverrides();
        return all[title.trim().toLowerCase()] || null;
    };

    // ---- Tampermonkey menu (checkbox-style toggles) ----
    const menuCommandIds = {};

    function menuLabel(key) {
        return `${NS.getConfig(key) ? '✅' : '⬜'} ${CONFIG_KEYS[key]}`;
    }

    NS.registerMenuCommands = function registerMenuCommands() {
        const canUnregister = typeof GM_unregisterMenuCommand !== 'undefined';
        for (const key of Object.keys(CONFIG_KEYS)) {
            if (canUnregister && menuCommandIds[key] !== undefined) {
                GM_unregisterMenuCommand(menuCommandIds[key]);
            }
            menuCommandIds[key] = GM_registerMenuCommand(menuLabel(key), () => NS.toggleConfig(key));
        }
    };

    NS.toggleConfig = function toggleConfig(key) {
        GM_setValue(key, !NS.getConfig(key));
        NS.registerMenuCommands(); // refresh checkbox glyphs immediately so it reads as a toggle, not a click
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 02: Display label normalization
// ===================================================================
// Pure lookup-table + function pairs for turning raw scraped labels into
// nicer display text. No DOM, no network — safe to edit without any risk
// of breaking scraping or rendering logic elsewhere.
(function (NS) {
    'use strict';

    // ---- ESRB rating short-code -> full display name ----
    // IGN's img alt text is sometimes just the short code ("T", "M", "E10+") rather than the
    // full name, so we normalize it ourselves instead of trusting whatever IGN gives us.
    const ESRB_FULL_NAMES = {
        'e': 'Everyone',
        'everyone': 'Everyone',
        'e10+': 'Everyone 10+',
        'e 10+': 'Everyone 10+',
        'everyone 10+': 'Everyone 10+',
        't': 'Teen',
        'teen': 'Teen',
        'm': 'Mature 17+',
        'mature': 'Mature 17+',
        'mature 17+': 'Mature 17+',
        'ao': 'Adults Only',
        'adults only': 'Adults Only',
        'rp': 'Rating Pending',
        'rating pending': 'Rating Pending'
    };

    NS.normalizeEsrbLabel = function normalizeEsrbLabel(rawLabel) {
        if (!rawLabel) return rawLabel;
        const key = rawLabel.trim().toLowerCase().replace(/^esrb:?\s*/i, '');
        return ESRB_FULL_NAMES[key] || rawLabel.trim();
    };

    // Display-only label renames for HLTB categories
    const HLTB_LABEL_OVERRIDES = {
        'main story': 'Main',
        'story + sides': 'Main + Sides'
    };

    NS.relabelHltb = function relabelHltb(label) {
        return HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()] || label;
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 03: Title -> IGN slug resolution
// ===================================================================
// Everything about turning a store title into candidate IGN URL slugs
// lives here: unicode/edition cleanup, Roman numeral swaps, the bundle
// and alias override tables, and the final buildCandidateSlugs() that
// the fetch orchestrator calls. Nothing here touches the network or the
// DOM — add a new alias/override here without worrying about fetch or
// render code, and vice versa.
(function (NS) {
    'use strict';

    // Bundle titles: Steam lists these as one product, but they're two distinct games on
    // IGN with their own pages/scores. Detecting this generically from "&" is too risky (plenty
    // of single games legitimately have "&" in their own name, e.g. "Ratchet & Clank"), so this
    // is a curated, explicit list — add more entries here as you run into them.
    NS.BUNDLE_TITLE_OVERRIDES = {
        'metal gear & metal gear 2: solid snake': [
            { name: 'Metal Gear', slug: 'metal-gear' },
            { name: 'Metal Gear 2: Solid Snake', slug: 'metal-gear-2-solid-snake' }
        ]
    };

    // Title aliases: abbreviations / release-year variants / IGN slug mismatches that our
    // automatic slug-guessing can't derive on its own. Add more entries here as you run into
    // them — this is the fastest fix for "this one specific title doesn't resolve."
    const TITLE_ALIASES = {
        'counter-strike 2': ['counter-strike: global offensive', 'counter-strike'],
        'cs2': ['counter-strike: global offensive'],
        'overwatch 2': ['overwatch'],
        'ea sports fc 24': ['fifa 24', 'fifa 23'],
        'eafc 24': ['fifa 24'],
        'final fantasy vii remake intergrade': ['final fantasy vii remake'],
        'jurassic world evolution 3: rebirth expansion': ['jurassic world evolution 3'],
        'conan exiles enhanced: isle of siptah': ['conan exiles'],
        'ratchet & clank: rift apart': ['ratchet and clank rift apart'],
        'brütal legend': ['brutal legend', 'brtal-legend'],
        'brutal legend': ['brtal-legend'],
        'guilty gear xrd rev 2': ['guilty gear xrd revelator 2'],
        'guilty gear': ['guilty-gear-1998'],
        'grand theft auto v': ['grand theft auto 5', 'gta v', 'gta 5'],
        'nioh 2': ['nioh 2'],
        'nioh 2 the complete edition': ['nioh 2'],
        // IGN uses the roman-numeral form for these Ninja Gaiden titles; the auto Roman
        // conversion produces "ninja gaiden iii" but IGN's own slug drops the apostrophe in
        // "razor's edge" as "razors-edge" rather than "razor-s-edge" (handled generically now
        // by apostrophe stripping below, kept here too as a guaranteed fallback).
        'ninja gaiden 3': ['ninja gaiden iii'],
        "ninja gaiden 3: razor's edge": ['ninja gaiden iii razors edge'],
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": ['ninja gaiden iii razors edge']
    };
    NS.TITLE_ALIASES = TITLE_ALIASES;

    // ---- Slug generation ----
    function slugify(str) {
        return str
            .replace(/'/g, '') // strip apostrophes instead of turning them into hyphens
            // ("Razor's Edge" -> "razors-edge", matching IGN's own slugs, not "razor-s-edge")
            .replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }

    function createIgnSlugs(title) {
        const noPeriods = title.replace(/\./g, '');

        let cleaned = noPeriods
            .replace(/[™®©]/g, '')
            .replace(/[’‘]/g, "'").replace(/[–—]/g, '-')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ä/g, 'a').replace(/Ä/g, 'a')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ß/g, 'ss')
            .replace(/[Σσς](\d)/g, 'Sigma $1')
            .replace(/[Σσς]/g, 'Sigma')
            .replace(/Δ/g, 'delta')
            .replace(/Ω/g, 'omega');

        cleaned = cleaned
            // Optional leading "The" is swallowed along with the edition keyword so it doesn't
            // get left dangling (e.g. "Nioh 2 – The Complete Edition" -> "Nioh 2", not "Nioh 2 – The").
            .replace(/\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, '')
            .replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi, '')
            .replace(/[–—-]\s*$/g, '') // dangling dash left behind after an edition phrase is stripped
            .trim();

        const slug = slugify(cleaned);
        const primarySlug = slug.replace(/&/g, 'and');
        const secondarySlug = slug.replace(/&/g, '');

        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0)
            ? slugify(noPrefix).replace(/&/g, 'and')
            : null;

        const aggressiveDropSlug = slugify(noPeriods.replace(/[^\x00-\x7F]/g, ''));

        return {
            primarySlug,
            secondarySlug,
            tertiarySlug,
            aggressiveDropSlug: (aggressiveDropSlug !== primarySlug) ? aggressiveDropSlug : null
        };
    }

    function slugsToList(slugsObj) {
        return [slugsObj.primarySlug, slugsObj.secondarySlug, slugsObj.tertiarySlug, slugsObj.aggressiveDropSlug].filter(Boolean);
    }

    // ---- Roman numeral conversion (IGN's slugs aren't consistent about which form they use) ----
    function toRoman(num) {
        const table = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let n = num, result = '';
        for (const [value, numeral] of table) {
            while (n >= value) { result += numeral; n -= value; }
        }
        return result;
    }

    const ROMAN_LOOKUP = {};
    for (let n = 1; n <= 50; n++) ROMAN_LOOKUP[toRoman(n).toLowerCase()] = n;

    // Converts Arabic numerals to Roman, including decimal "edition" numbers like "1.5" -> "I.5"
    // (done in a single pass so the ".5" isn't re-matched as its own standalone integer afterward).
    function arabicToRomanVariant(title) {
        return title.replace(/\b(\d{1,2})\.5\b|\b(\d{1,2})\b/g, (match, decimalPart, intPart) => {
            if (decimalPart !== undefined) return `${toRoman(parseInt(decimalPart, 10))}.5`;
            const num = parseInt(intPart, 10);
            return (num >= 1 && num <= 50) ? toRoman(num) : match;
        });
    }

    // Converts whole-word Roman numerals back to Arabic (e.g. "III" -> "3")
    function romanToArabicVariant(title) {
        return title.replace(/\b[a-zA-Z]+\b/g, (word) => {
            const key = word.toLowerCase();
            return ROMAN_LOOKUP.hasOwnProperty(key) ? String(ROMAN_LOOKUP[key]) : word;
        });
    }

    // Generates alternate spellings of a title to compensate for IGN's inconsistent formatting:
    // stylistic dash-wrapped subtitles, "(DLC)" tags, "+" meaning either "and" or nothing, and
    // Roman/Arabic numeral mismatches. Every variant is later run through createIgnSlugs().
    function generateTitleVariants(title) {
        const variants = new Set([title]);

        // "Title -Subtitle-" -> "Title Subtitle" (a stylistic wrap some publishers use)
        const dashUnwrapped = title.replace(/\s-([^-]+)-\s*$/i, ' $1').trim();
        if (dashUnwrapped !== title) variants.add(dashUnwrapped);

        // Drop "(DLC)" tags entirely
        for (const base of [...variants]) {
            const noDlc = base.replace(/\(\s*dlc\s*\)/gi, '').replace(/\s+/g, ' ').trim();
            if (noDlc !== base) variants.add(noDlc);
        }

        // "+" sometimes means "and" (bundles), sometimes means nothing (base + DLC name)
        for (const base of [...variants]) {
            if (base.includes('+')) {
                variants.add(base.replace(/\s*\+\s*/g, ' and ').replace(/\s+/g, ' ').trim());
                variants.add(base.replace(/\s*\+\s*/g, ' ').replace(/\s+/g, ' ').trim());
            }
        }

        // Roman <-> Arabic numeral swaps
        for (const base of [...variants]) {
            const romanVariant = arabicToRomanVariant(base);
            if (romanVariant !== base) variants.add(romanVariant);
            const arabicVariant = romanToArabicVariant(base);
            if (arabicVariant !== base) variants.add(arabicVariant);
        }

        return [...variants];
    }

    // "NINJA GAIDEN Σ2 [NINJA GAIDEN: Master Collection]" -> the real game name is what's
    // before the bracket; the bracket just tags which larger collection it ships as part of.
    NS.stripCollectionBracket = function stripCollectionBracket(title) {
        const match = title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i);
        return match ? match[1].trim() : null;
    };

    // Some titles use a Greek letter (e.g. "Σ") that Steam/Epic's own URL slug transliterates
    // to a plain letter (e.g. "S"), while IGN instead spells it as a word ("Sigma"). We already
    // try the spelled-out word as the primary approach (see createIgnSlugs); this generates the
    // literal-letter variant as a last-resort fallback, matching how the store URL does it.
    NS.sigmaLetterFallbackTitle = function sigmaLetterFallbackTitle(title) {
        if (!/[Σσς]/.test(title)) return null;
        return title.replace(/[Σσς](\d)/g, 'S$1').replace(/[Σσς]/g, 'S');
    };

    NS.buildCandidateSlugs = function buildCandidateSlugs(gameTitle) {
        let slugs = [];
        for (const variant of generateTitleVariants(gameTitle)) {
            slugs = slugs.concat(slugsToList(createIgnSlugs(variant)));
        }

        const lowerTitle = gameTitle.toLowerCase().trim();
        if (TITLE_ALIASES.hasOwnProperty(lowerTitle)) {
            for (const alias of TITLE_ALIASES[lowerTitle]) {
                if (!alias.includes(' ')) slugs.push(alias);
                for (const aliasVariant of generateTitleVariants(alias)) {
                    slugs = slugs.concat(slugsToList(createIgnSlugs(aliasVariant)));
                }
            }
        }

        return [...new Set(slugs)];
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 04: Current-page scraping (Steam/Epic DOM only)
// ===================================================================
// Everything that reads data off the store page itself (not IGN, not
// HLTB) lives here: game title extraction, Steam's own review summary,
// DLC base-game detection, package/bundle item lists, and where on the
// page the badge should be inserted. No network calls, no rendering —
// just "what does the current page say."
(function (NS) {
    'use strict';

    function cleanSteamTitle(raw) {
        return raw.replace(/^Save \d+% on /i, '').replace(/^Pre-purchase /i, '').replace(/ on Steam$/i, '').trim();
    }

    NS.getGameTitle = function getGameTitle() {
        if (NS.IS_STEAM) {
            const titleEl = document.getElementById('appHubAppName') ||
                document.querySelector('.page_title_area .apphub_AppName') ||
                document.querySelector('.app_header_content .app_name');
            if (titleEl && titleEl.textContent.trim()) return titleEl.textContent.trim();

            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) {
                const title = cleanSteamTitle(ogTitle.content.trim());
                if (title) return title;
            }

            if (document.title) {
                const title = cleanSteamTitle(document.title);
                if (title && title !== 'Steam') return title;
            }
        }

        if (NS.IS_EPIC) {
            const h1El = document.querySelector('h1') || document.querySelector('[data-testid="pdp-title"]');
            if (h1El) return h1El.textContent.trim();
        }

        return null;
    };

    // Reads Steam's own review summary rows (Recent Reviews, All/English Reviews, etc.) straight
    // from the current page — no network request needed, so this can't fail like a fetch would.
    NS.extractSteamReviews = function extractSteamReviews() {
        if (!NS.IS_STEAM) return [];

        const SENTIMENT_COLORS = { positive: '#66c0f4', mixed: '#e2b93d', negative: '#a34c25' };

        const rows = document.querySelectorAll('#userReviews .user_reviews_summary_row');
        const results = [];

        rows.forEach(row => {
            const subtitleEl = row.querySelector('.subtitle');
            const summaryEl = row.querySelector('.game_review_summary');
            if (!subtitleEl || !summaryEl) return;

            const label = subtitleEl.textContent.trim().replace(/:\s*$/, '');
            const summaryText = summaryEl.textContent.trim();
            if (!label || !summaryText) return;

            const countEl = row.querySelector('.responsive_hidden');
            const count = countEl ? countEl.textContent.trim().replace(/[()]/g, '') : '';

            let percent = '';
            const tooltip = row.getAttribute('data-tooltip-html') || '';
            const percentMatch = tooltip.match(/(\d+)%/);
            if (percentMatch) percent = `${percentMatch[1]}%`;

            let sentiment = 'mixed';
            if (/\bpositive\b/i.test(summaryEl.className)) sentiment = 'positive';
            else if (/\bnegative\b/i.test(summaryEl.className)) sentiment = 'negative';

            results.push({ label, summaryText, count, percent, color: SENTIMENT_COLORS[sentiment] });
        });

        return results;
    };

    // Some Steam DLC pages don't have enough of their own IGN data to find anything, but they
    // do tell you the base game right on the page (e.g. "This content requires the base game
    // Resident Evil 7 Biohazard on Steam in order to play."). Used as a last-resort fallback.
    NS.extractDlcBaseGameName = function extractDlcBaseGameName() {
        if (!NS.IS_STEAM) return null;

        const paragraphs = document.querySelectorAll('.content p, p');
        for (const p of paragraphs) {
            if (!/requires the base game/i.test(p.textContent || '')) continue;
            const link = p.querySelector('a[href*="/app/"]') || p.querySelector('a');
            const name = link ? link.textContent.trim() : '';
            if (name) return name;
        }

        return null;
    };

    // Steam package/bundle pages ("Batman: Arkham Collection", "Fallout Collection") list the
    // individual games they contain — used both as a fallback when the collection itself has no
    // single IGN page, and (per user request) alongside a dedicated collection page when one
    // does exist, so every included game's score is visible.
    NS.extractPackageItemNames = function extractPackageItemNames() {
        if (!NS.IS_STEAM) return [];

        const items = document.querySelectorAll('.package_landing_page_item_list .tab_item_name');
        const names = [];
        const seen = new Set();
        items.forEach(el => {
            const name = (el.textContent || '').trim();
            const key = name.toLowerCase();
            if (name && !seen.has(key)) { seen.add(key); names.push(name); }
        });
        return names;
    };

    // explicitPosition lets a caller ask "where would THIS specific position value land"
    // rather than always using the overall badge's saved preference — used so HLTB/Leisure
    // can be placed independently of the main badge (and of each other) when not 'inline'.
    NS.getTargetInsertionPoint = function getTargetInsertionPoint(explicitPosition) {
        if (NS.IS_STEAM) {
            const pref = explicitPosition || NS.getBadgePosition();

            // User-selected placements. If the preferred container isn't present on this
            // particular page (e.g. "above price" on a page with no buy box), fall through
            // to the original default placement logic below instead of failing outright.
            if (pref === 'aboveTitle') {
                const titleArea = document.querySelector('.page_title_area.game_title_area') ||
                    document.querySelector('.page_title_area');
                if (titleArea) return { element: titleArea, position: 'before' };
            }

            if (pref === 'sidebarBottom') {
                const sidebar = document.querySelector('.rightcol.game_meta_data') ||
                    document.querySelector('.game_meta_data');
                if (sidebar) return { element: sidebar, position: 'append' };
            }

            if (pref === 'abovePrice') {
                const purchaseArea = document.querySelector('#game_area_purchase');
                if (purchaseArea) return { element: purchaseArea, position: 'before' };
            }

            if (pref === 'aboveExternalLinks' || pref === 'belowExternalLinks') {
                // The row's own class name is a Svelte-generated hash that can change between
                // Steam frontend builds, so target it via a stable link (SteamDB) instead and
                // grab its containing row rather than matching the hashed class directly.
                const steamDbLink = document.querySelector('a[href*="steamdb.info/app/"]');
                const externalLinksRow = steamDbLink ? steamDbLink.closest('div') : null;
                if (externalLinksRow) {
                    return { element: externalLinksRow, position: pref === 'aboveExternalLinks' ? 'before' : 'after' };
                }
            }

            // 'default' preference, or the chosen container wasn't found on this page.
            const headerImage = document.querySelector('.game_header_image_full') ||
                document.querySelector('.game_header_image_ctn') ||
                document.querySelector('.glance_ctn_responsive .game_header_image_full');
            if (headerImage) return { element: headerImage, position: 'before' };

            const glanceCtn = document.querySelector('.glance_ctn_responsive') || document.querySelector('.game_meta_data');
            if (glanceCtn) return { element: glanceCtn, position: 'prepend' };

            const mobileReviews = document.querySelector('#user_reviews_container') ||
                document.querySelector('.user_reviews_filter_score') ||
                document.querySelector('.review_histogram_rollup');
            if (mobileReviews) return { element: mobileReviews, position: 'after' };

            // Package/bundle landing pages ("Batman: Arkham Collection") don't have any of the
            // single-game selectors above — fall back to the item list itself.
            const packageList = document.querySelector('.package_landing_page_item_list');
            if (packageList) return { element: packageList, position: 'before' };
        }

        if (NS.IS_EPIC) {
            const epicTarget = document.querySelector('[data-testid="purchase-cta-layout"]') ||
                document.querySelector('aside') ||
                document.querySelector('[role="main"]');
            if (epicTarget) return { element: epicTarget, position: 'prepend' };
        }

        return null;
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 05: Badge HTML building & DOM insertion
// ===================================================================
// Pure "take already-fetched data, produce/insert HTML" logic. Nothing
// here fetches anything from IGN or HLTB — it just reads NS.getConfig(),
// NS.getSectionOrder(), and NS.getTargetInsertionPoint(), and renders.
// Restyling a section or reordering the layout only ever touches this file.
(function (NS) {
    'use strict';

    const BADGE_STYLE = `
        margin: 10px auto; padding: 14px 16px;
        background: linear-gradient(135deg, rgba(20,20,20,0.95), rgba(35,35,35,0.95));
        border-radius: 8px; border-left: 5px solid #ff3e3e;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        width: 100%; box-sizing: border-box;
        display: flex; flex-direction: column; gap: 12px; clear: both; color: #ffffff;
    `;

    // Small stat block used by both the score row and the HLTB row
    function statBlock(value, label, valueSize = '18px', valueColor = '#ffffff', labelSize = '8px') {
        return `
            <div style="display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;">
                <span style="font-size:${valueSize};font-weight:bold;color:${valueColor};line-height:1.1;">${NS.escapeHtml(value)}</span>
                <span style="font-size:${labelSize};color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-top:3px;white-space:nowrap;">${NS.escapeHtml(label)}</span>
            </div>`;
    }

    const divider = (height = '32px') => `<div style="border-left:1px solid rgba(255,255,255,0.15);height:${height};"></div>`;
    const sectionRow = (extra = '') => `border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;${extra}`;

    function buildTopRow(ignScore, userScore, ignUrl, displayName) {
        const showIgn = NS.getConfig('showIgnScore');
        const showUser = NS.getConfig('showUserRating');
        if (!showIgn && !showUser) return '';

        let scoresHtml = '';
        if (showIgn) scoresHtml += statBlock(ignScore, 'IGN Score', '22px', '#ffffff', '11px');
        if (showIgn && showUser) scoresHtml += divider();
        if (showUser) scoresHtml += statBlock(userScore, 'User Rating', '22px', '#ffffff', '11px');

        return `
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
                <div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;max-width:130px;overflow:hidden;">
                    <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:bold;color:#ff3e3e;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;white-space:nowrap;">IGN Overview ↗</a>
                    <a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(displayName)}" style="font-size:10px;font-weight:bold;color:#b8b8b8;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-top:2px;">${NS.escapeHtml(displayName)} ↗</a>
                </div>
                <div style="display:flex;align-items:center;gap:14px;">${scoresHtml}</div>
            </div>`;
    }

    // Used for bundle/dual-game titles (see BUNDLE_TITLE_OVERRIDES and the "+" dual-game split)
    // and for collections that also list their individual games, that map to two or more separate
    // IGN pages. One header row of column labels, then one aligned value row per game — rather
    // than repeating the labels per game.
    function buildMultiGameTopRow(games) {
        if (!games || games.length === 0) return '';

        const showIgn = NS.getConfig('showIgnScore');
        const showUser = NS.getConfig('showUserRating');
        if (!showIgn && !showUser) return '';

        const scoreCol = 'flex:0 0 70px;text-align:center;';
        const headerCells = [`<div style="flex:1;overflow:hidden;">IGN Overview</div>`];
        if (showIgn) headerCells.push(`<div style="${scoreCol}">IGN Score</div>`);
        if (showUser) headerCells.push(`<div style="${scoreCol}">User Rating</div>`);

        const headerRow = `
            <div style="display:flex;align-items:center;gap:8px;font-size:9px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.12);">
                ${headerCells.join('')}
            </div>`;

        const valueRows = games.map(g => {
            const cells = [`<div style="flex:1;overflow:hidden;"><a href="${encodeURI(g.url)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(g.name)}" style="font-weight:bold;color:#ff3e3e;font-size:12px;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${NS.escapeHtml(g.name)}${g.isDedicated ? ' (Collection)' : ''} ↗</a></div>`];
            if (showIgn) cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.ignScore)}</div>`);
            if (showUser) cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.userScore)}</div>`);

            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${cells.join('')}</div>`;
        }).join('');

        return `<div style="display:flex;flex-direction:column;">${headerRow}${valueRows}</div>`;
    }

    function buildSteamReviewsRow(reviewsData) {
        if (!NS.getConfig('showSteamReviews') || !reviewsData || reviewsData.length === 0) return '';

        const blocks = reviewsData.map(r => {
            const subParts = [];
            if (r.count) subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.count)}</span>`);
            if (r.percent) subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.percent)} Positive</span>`);
            const subHtml = subParts.join(divider('12px'));

            return `
                <div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;text-align:center;">
                    <span style="font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;white-space:nowrap;">${NS.escapeHtml(r.label)}</span>
                    <span style="font-size:14px;font-weight:bold;color:${r.color};text-transform:uppercase;letter-spacing:0.3px;">${NS.escapeHtml(r.summaryText)}</span>
                    <div style="display:flex;align-items:center;gap:8px;">${subHtml}</div>
                </div>`;
        }).join(divider('48px'));

        return `<div style="${sectionRow('display:flex;align-items:flex-start;justify-content:space-around;')}">${blocks}</div>`;
    }

    function buildAwardRow(awardData) {
        if (!NS.getConfig('showAward') || !awardData) return '';
        return `
            <a href="https://www.ign.com/icons" target="_blank" rel="noopener noreferrer" style="${sectionRow('display:flex;align-items:center;justify-content:space-between;font-size:11px;text-decoration:none;')}">
                <span style="color:#a1b0bd;font-weight:bold;">Leaderboard Rank:</span>
                <span style="color:#f1c40f;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">#${NS.escapeHtml(awardData.rank)} (${NS.escapeHtml(awardData.label)}) ↗</span>
            </a>`;
    }

    function buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors) {
        if (!NS.getConfig('showEsrb') || !(esrbImgSrc || esrbDescriptors)) return '';
        const img = esrbImgSrc
            ? `<img src="${esrbImgSrc}" alt="${NS.escapeHtml(esrbAlt)}" title="${NS.escapeHtml(esrbAlt)}" style="height:56px;border-radius:4px;flex-shrink:0;box-shadow:0 2px 5px rgba(0,0,0,0.3);" />`
            : '';
        const desc = esrbDescriptors
            ? `<span style="color:#d0d0d0;font-size:10px;line-height:1.3;margin-top:2px;"><strong>Description:</strong> ${NS.escapeHtml(esrbDescriptors)}</span>`
            : '';
        const displayAlt = NS.normalizeEsrbLabel(esrbAlt);
        return `
            <div style="${sectionRow('display:flex;align-items:flex-start;gap:12px;')}">
                ${img}
                <div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2px;flex:1;">
                    <span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">ESRB</span>
                    <span style="color:#ffffff;font-size:15px;font-weight:bold;line-height:1.2;">${NS.escapeHtml(displayAlt)}</span>
                    ${desc}
                </div>
            </div>`;
    }

    function buildDevRow(developerName) {
        if (!NS.getConfig('showDeveloper') || !developerName) return '';
        return `
            <div style="${sectionRow('display:flex;align-items:center;justify-content:space-between;font-size:11px;')}">
                <span style="color:#a1b0bd;font-weight:bold;">Developer:</span>
                <span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(developerName)}">${NS.escapeHtml(developerName)}</span>
            </div>`;
    }

    function buildHltbRow(hltbData, hltbUrl) {
        if (!NS.getConfig('showHltb') || !(hltbData && hltbData.length > 0)) return '';

        // Display-only: drop the "All Styles" entry and apply label renames
        const displayData = hltbData.filter(item => !/all styles/i.test(item.label));
        if (displayData.length === 0) return '';

        const items = displayData.map(item => statBlock(item.time, NS.relabelHltb(item.label), '16px', '#66c0f4', '10px')).join(divider('26px'));
        return `
            <a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer"
               style="${sectionRow('display:flex;flex-direction:column;gap:8px;text-decoration:none;background:rgba(102,192,244,0.03);padding:8px;border-radius:6px;transition:background 0.2s;')}"
               onmouseover="this.style.background='rgba(102,192,244,0.08)'" onmouseout="this.style.background='rgba(102,192,244,0.03)'">
                <span style="font-size:10px;color:#66c0f4;text-transform:uppercase;font-weight:bold;">HowLongToBeat ↗</span>
                <div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div>
            </a>`;
    }

    // Standalone "Leisure" time section, sourced from the HLTB game page itself (not IGN).
    // Built and injected independently after the main badge renders, so a failed/missing
    // fetch here never affects the rest of the overlay. Exported: the fetch orchestrator
    // calls this once its async HLTB leisure fetch resolves.
    NS.buildLeisureRow = function buildLeisureRow(leisureData, hltbUrl) {
        if (!NS.getConfig('showLeisure') || !leisureData || leisureData.length === 0) return '';

        const items = leisureData.map(item => statBlock(item.time, NS.relabelHltb(item.label), '16px', '#9b59b6', '10px')).join(divider('26px'));
        return `
            <a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer"
               style="${sectionRow('display:flex;flex-direction:column;gap:8px;text-decoration:none;background:rgba(155,89,182,0.03);padding:8px;border-radius:6px;transition:background 0.2s;')}"
               onmouseover="this.style.background='rgba(155,89,182,0.08)'" onmouseout="this.style.background='rgba(155,89,182,0.03)'">
                <span style="font-size:10px;color:#9b59b6;text-transform:uppercase;font-weight:bold;">HLTB Leisure Time ↗</span>
                <div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div>
            </a>`;
    };

    // Shared fallback: if we couldn't scrape a direct HLTB URL, fall back to an HLTB search link
    function resolveHltbUrl(hltbUrl, displayName) {
        return hltbUrl || `https://howlongtobeat.com/?q=${encodeURIComponent(displayName)}`;
    }

    function insertAtTarget(node, targetObj) {
        const { element, position } = targetObj;
        if (position === 'after' && element.parentNode) {
            element.parentNode.insertBefore(node, element.nextSibling);
        } else if (position === 'before' && element.parentNode) {
            element.parentNode.insertBefore(node, element);
        } else if (position === 'prepend') {
            element.prepend(node);
        } else {
            element.appendChild(node);
        }
    }

    // explicitPosition is only used for standalone HLTB/Leisure sections (see
    // renderStandaloneSection below) — the main badge always uses the saved overall
    // badge position, so it's called with no argument.
    function insertBadge(badgeCtn, explicitPosition) {
        const targetObj = NS.getTargetInsertionPoint(explicitPosition);
        if (!targetObj) return false;
        insertAtTarget(badgeCtn, targetObj);
        return true;
    }

    // Renders a section as its own standalone element (independent of the main
    // `.ign_rating_row` badge) at whatever page location its own setting points to.
    // Always removes any previous element of the same className first, so switching a
    // section's location back to 'inline' (or to config-off) cleanly removes the old
    // standalone copy — pass '' as html for that case.
    NS.renderStandaloneSection = function renderStandaloneSection(className, html, explicitPosition) {
        const existing = document.querySelector('.' + className);
        if (existing) existing.remove();
        if (!html) return;

        const ctn = document.createElement('div');
        ctn.className = className;
        ctn.style.cssText = BADGE_STYLE;
        ctn.innerHTML = html;
        insertBadge(ctn, explicitPosition);
    };

    // Single-game badge. Returns the resolved HLTB url (so the caller can kick off the async
    // leisure-time fetch), or null if the main badge had nothing worth showing AND HLTB isn't
    // being pulled out to a standalone location either.
    NS.renderCompleteBadge = function renderCompleteBadge(ignScore, userScore, hltbData, hltbUrl, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, ignUrl, fetchedGameTitle = '') {
        // A quick "is this even a supported page" check — same fallback chain the main
        // badge itself would use, so if this comes back empty there's nowhere to attach
        // anything at all (standalone sections included).
        if (!NS.getTargetInsertionPoint()) return null;

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        let displayName = fetchedGameTitle;
        if (!displayName) {
            const slugPart = ignUrl.split('/games/')[1] || '';
            displayName = slugPart.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }

        const resolvedHltbUrl = resolveHltbUrl(hltbUrl, displayName);
        const hltbInline = NS.isInlineLocation(NS.getHltbLocation());
        const leisureInline = NS.isInlineLocation(NS.getLeisureLocation());
        const hltbHtml = buildHltbRow(hltbData, resolvedHltbUrl);

        const sectionHtml = {
            scores: buildTopRow(ignScore, userScore, ignUrl, displayName),
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: buildAwardRow(awardData),
            esrb: buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors),
            developer: buildDevRow(developerName),
            hltb: hltbInline ? hltbHtml : '',
            // Leisure data loads asynchronously after this function returns; reserve its slot
            // now (in the right order position) so it doesn't just get tacked on at the end later.
            // Only reserved when leisure is staying inline — a standalone leisure section is
            // created later, once fetched, by the orchestrator's attachLeisureSection().
            leisure: (leisureInline && NS.getConfig('showLeisure')) ? '<div class="ign_leisure_placeholder"></div>' : ''
        };

        const order = NS.getSectionOrder();
        const mainHtml = order.map(key => sectionHtml[key] || '').join('');
        const hasRealContent = !!mainHtml.replace(/<div class="ign_leisure_placeholder"><\/div>/g, '').trim();

        if (hasRealContent) {
            const badgeCtn = document.createElement('div');
            badgeCtn.className = 'ign_rating_row';
            badgeCtn.style.cssText = BADGE_STYLE;
            badgeCtn.innerHTML = mainHtml;
            insertBadge(badgeCtn);
        }

        // Standalone HLTB renders (or clears out a stale copy) independently of whether the
        // main badge itself had anything to show.
        NS.renderStandaloneSection('ign_hltb_standalone_row', hltbInline ? '' : hltbHtml, NS.getHltbLocation());

        if (!hasRealContent && hltbInline) return null;
        return resolvedHltbUrl;
    };

    // Shared sections (Developer/ESRB/HLTB/Award) come from whichever bundle entry we
    // successfully parsed first — a bundle listing rarely has a single unified page for those.
    // Returns the resolved HLTB url (for the async leisure fetch) or '' if there's no primary
    // parsed page to source HLTB data from.
    NS.renderMultiGameBadge = function renderMultiGameBadge(games, gameTitle) {
        if (!NS.getTargetInsertionPoint()) return '';

        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();

        const primary = games.find(g => g.parsed);
        const p = primary ? primary.parsed : null;
        const resolvedHltbUrl = p ? resolveHltbUrl(p.hltbUrl, gameTitle) : '';
        const hltbInline = NS.isInlineLocation(NS.getHltbLocation());
        const hltbHtml = p ? buildHltbRow(p.hltbData, resolvedHltbUrl) : '';

        const badgeCtn = document.createElement('div');
        badgeCtn.className = 'ign_rating_row';
        badgeCtn.style.cssText = BADGE_STYLE;

        const sectionHtml = {
            scores: buildMultiGameTopRow(games),
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: p ? buildAwardRow(p.awardData) : '',
            esrb: p ? buildEsrbRow(p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors) : '',
            developer: p ? buildDevRow(p.developerName) : '',
            hltb: (p && hltbInline) ? hltbHtml : '',
            leisure: (p && NS.isInlineLocation(NS.getLeisureLocation()) && NS.getConfig('showLeisure')) ? '<div class="ign_leisure_placeholder"></div>' : ''
        };

        const order = NS.getSectionOrder();
        badgeCtn.innerHTML = order.map(key => sectionHtml[key] || '').join('');

        insertBadge(badgeCtn);

        if (p) NS.renderStandaloneSection('ign_hltb_standalone_row', hltbInline ? '' : hltbHtml, NS.getHltbLocation());

        return p ? resolvedHltbUrl : '';
    };

    // Convenience used by the fetch orchestrator when nothing at all could be resolved.
    NS.renderEmpty = function renderEmpty(status, targetUrl, gameTitle) {
        NS.renderCompleteBadge(status, status, [], '', '', '', '', '', null, targetUrl, gameTitle);
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 06: Settings panel (in-page overlay)
// ===================================================================
// The overlay UI for editing settings. Reads/writes through NS.getConfig
// /NS.setSectionOrder/etc (01-config-store.js) and re-renders the badge
// via NS.init() (10-main.js) on save. Restyling the panel or changing its
// layout only ever touches this file.
(function (NS) {
    'use strict';

    const SETTINGS_PANEL_STYLE = `
        <style>
            #ign_settings_overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999;
                display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            #ign_settings_panel { background: linear-gradient(135deg, rgba(20,20,20,0.98), rgba(35,35,35,0.98));
                border-radius: 10px; border-left: 5px solid #ff3e3e; box-shadow: 0 8px 30px rgba(0,0,0,0.6);
                width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; padding: 20px 22px; color: #ffffff; }
            #ign_settings_panel h2 { margin: 0 0 4px; font-size: 16px; color: #ff3e3e; text-transform: uppercase; letter-spacing: 0.5px; }
            #ign_settings_panel h3 { margin: 0 0 10px; font-size: 11px; color: #a1b0bd; text-transform: uppercase; letter-spacing: 0.5px; }
            .ign_settings_sub { font-size: 11px; color: #8f98a0; margin: 0 0 18px; }
            .ign_settings_columns { display: flex; gap: 22px; flex-wrap: wrap; }
            .ign_settings_columns > div { flex: 1; min-width: 210px; }
            .ign_settings_toggle_row { display: flex; align-items: center; justify-content: space-between;
                padding: 7px 0; font-size: 12px; color: #c6d4df; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
            .ign_switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 10px; }
            .ign_switch input { opacity: 0; width: 0; height: 0; }
            .ign_switch_slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; transition: 0.2s; }
            .ign_switch_slider::before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; top: 3px;
                background: #ffffff; border-radius: 50%; transition: 0.2s; }
            .ign_switch input:checked + .ign_switch_slider { background: #66c0f4; }
            .ign_switch input:checked + .ign_switch_slider::before { transform: translateX(16px); }
            #ign_order_list { list-style: none; margin: 0; padding: 0; }
            .ign_order_item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 6px;
                background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; cursor: grab; }
            .ign_order_item.ign_drag_over { border: 1px dashed #66c0f4; }
            .ign_order_handle { color: #8f98a0; font-size: 14px; }
            .ign_settings_actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px;
                font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; }
            #ign_settings_save { background: #ff3e3e; color: #ffffff; }
            #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }
            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 10px; }
            .ign_locations_row > div { flex: 1; min-width: 200px; }
            .ign_locations_row label { display: block; font-size: 10px; color: #a1b0bd; text-transform: uppercase;
                font-weight: bold; letter-spacing: 0.3px; margin-bottom: 5px; }
            #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }
            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px;
                padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px;
                font-size: 12px; color: #c6d4df; }
            .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; }
            .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px;
                color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; }
            .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); }
            .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer;
                font-size: 13px; padding: 2px 6px; flex-shrink: 0; }
            .ign_override_remove:hover { color: #ff3e3e; }
            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; }
            .ign_override_form { display: flex; flex-direction: column; gap: 6px; }
            .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px;
                font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer;
                background: rgba(102,192,244,0.15); color: #66c0f4; }
        </style>`;

    function buildSettingsPanelHtml() {
        const toggleRows = Object.keys(NS.CONFIG_KEYS).map(key => `
            <label class="ign_settings_toggle_row">
                <span>${NS.escapeHtml(NS.CONFIG_KEYS[key])}</span>
                <span class="ign_switch">
                    <input type="checkbox" data-toggle-key="${key}" ${NS.getConfig(key) ? 'checked' : ''}>
                    <span class="ign_switch_slider"></span>
                </span>
            </label>`).join('');

        const orderRows = NS.getSectionOrder().map(key => `
            <li class="ign_order_item" draggable="true" data-key="${key}">
                <span class="ign_order_handle">⠿</span>
                <span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>
            </li>`).join('');

        const currentPosition = NS.getBadgePosition();
        const positionOptionsHtml = NS.BADGE_POSITION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentPosition ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        // HLTB and HLTB Leisure Time each get their own independent location — either can stay
        // 'inline' inside the main badge, or be moved to any of the same page locations the
        // main badge itself can use.
        const currentHltbLocation = NS.getHltbLocation();
        const hltbLocationOptionsHtml = NS.HLTB_LOCATION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentHltbLocation ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        const currentLeisureLocation = NS.getLeisureLocation();
        const leisureLocationOptionsHtml = NS.HLTB_LOCATION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentLeisureLocation ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        // Manual per-title overrides — see NS.getUserOverrides in 01-config-store.js.
        const userOverrides = NS.getUserOverrides();
        const overrideKeys = Object.keys(userOverrides);
        const overrideRowsHtml = overrideKeys.length === 0
            ? ''
            : overrideKeys.map(key => {
                const entry = userOverrides[key];
                const pills = [
                    entry.ignUrl ? `<span class="ign_override_pill">IGN</span>` : '',
                    entry.hltbUrl ? `<span class="ign_override_pill ign_override_pill_hltb">HLTB</span>` : ''
                ].join('');
                return `
                    <li class="ign_override_item">
                        <span class="ign_override_item_main">
                            <strong title="${NS.escapeHtml(entry.displayTitle || key)}">${NS.escapeHtml(entry.displayTitle || key)}</strong>
                            ${pills}
                        </span>
                        <button class="ign_override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button>
                    </li>`;
            }).join('');

        return `
            ${SETTINGS_PANEL_STYLE}
            <div id="ign_settings_overlay">
                <div id="ign_settings_panel">
                    <h2>IGN Script Settings</h2>
                    <p class="ign_settings_sub">Changes apply immediately on save — no page refresh needed.</p>
                    <div class="ign_settings_columns">
                        <div>
                            <h3>Visible Sections</h3>
                            ${toggleRows}
                        </div>
                        <div>
                            <h3>Section Order (drag to reorder)</h3>
                            <ul id="ign_order_list">${orderRows}</ul>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <h3>Overlay Position</h3>
                        <select id="ign_badge_position" class="ign_settings_select">
                            ${positionOptionsHtml}
                        </select>
                    </div>
                    <div class="ign_locations_row">
                        <div>
                            <label>HowLongToBeat Location</label>
                            <select id="ign_hltb_location" class="ign_settings_select">
                                ${hltbLocationOptionsHtml}
                            </select>
                        </div>
                        <div>
                            <label>HLTB Leisure Time Location</label>
                            <select id="ign_leisure_location" class="ign_settings_select">
                                ${leisureLocationOptionsHtml}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <h3>Per-Title Overrides</h3>
                        <p class="ign_settings_sub" style="margin-bottom:8px;">
                            For games that won't auto-resolve: force an exact IGN page and/or an exact
                            HowLongToBeat page for one title. Matched by exact title (case-insensitive).
                            Added/removed immediately — no need to hit Save below.
                        </p>
                        ${overrideKeys.length === 0 ? '<p class="ign_override_empty">No overrides added yet.</p>' : `<ul id="ign_override_list">${overrideRowsHtml}</ul>`}
                        <div class="ign_override_form">
                            <input type="text" id="ign_override_title" placeholder="Game title, exactly as shown on the store page">
                            <input type="text" id="ign_override_ign_url" placeholder="IGN URL (optional) — e.g. https://www.ign.com/games/some-slug">
                            <input type="text" id="ign_override_hltb_url" placeholder="HowLongToBeat URL (optional) — e.g. https://howlongtobeat.com/game/1234">
                            <button id="ign_override_add">Add / Update</button>
                        </div>
                    </div>
                    <div class="ign_settings_actions">
                        <button id="ign_settings_cancel">Cancel</button>
                        <button id="ign_settings_save">Save</button>
                    </div>
                </div>
            </div>`;
    }

    function refreshBadgeNow() {
        NS.state.lastProcessedTitle = '';
        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();
        NS.init();
    }

    NS.openSettingsPanel = function openSettingsPanel() {
        const existing = document.getElementById('ign_settings_overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', buildSettingsPanelHtml());
        const overlay = document.getElementById('ign_settings_overlay');
        const list = document.getElementById('ign_order_list');

        // Drag-and-drop reordering
        let draggedItem = null;
        list.querySelectorAll('.ign_order_item').forEach(item => {
            item.addEventListener('dragstart', () => { draggedItem = item; item.style.opacity = '0.4'; });
            item.addEventListener('dragend', () => { item.style.opacity = '1'; item.classList.remove('ign_drag_over'); });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const bounds = item.getBoundingClientRect();
                const isAfter = (e.clientY - bounds.top) > bounds.height / 2;
                item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
            });
        });

        // Per-title override add/remove — these apply immediately (not tied to Save/Cancel),
        // since they're closer to a small CRUD list than an on/off toggle. Simplest way to
        // reflect the change in the list is to just reopen the panel.
        overlay.querySelectorAll('.ign_override_remove').forEach(btn => {
            btn.addEventListener('click', () => {
                NS.removeUserOverride(btn.dataset.key);
                refreshBadgeNow();
                NS.openSettingsPanel();
            });
        });

        overlay.querySelector('#ign_override_add').addEventListener('click', () => {
            const titleInput = overlay.querySelector('#ign_override_title');
            const ignInput = overlay.querySelector('#ign_override_ign_url');
            const hltbInput = overlay.querySelector('#ign_override_hltb_url');
            const title = titleInput.value.trim();
            const ignUrl = ignInput.value.trim();
            const hltbUrl = hltbInput.value.trim();
            if (!title || (!ignUrl && !hltbUrl)) return;

            NS.setUserOverride(title, ignUrl, hltbUrl);
            refreshBadgeNow();
            NS.openSettingsPanel();
        });

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#ign_settings_cancel').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#ign_settings_save').addEventListener('click', () => {
            overlay.querySelectorAll('input[data-toggle-key]').forEach(input => {
                GM_setValue(input.dataset.toggleKey, input.checked);
            });
            const newOrder = Array.from(list.querySelectorAll('.ign_order_item')).map(li => li.dataset.key);
            NS.setSectionOrder(newOrder);
            const positionSelect = overlay.querySelector('#ign_badge_position');
            if (positionSelect) NS.setBadgePosition(positionSelect.value);
            const hltbLocationSelect = overlay.querySelector('#ign_hltb_location');
            if (hltbLocationSelect) NS.setHltbLocation(hltbLocationSelect.value);
            const leisureLocationSelect = overlay.querySelector('#ign_leisure_location');
            if (leisureLocationSelect) NS.setLeisureLocation(leisureLocationSelect.value);
            overlay.remove();
            NS.registerMenuCommands();
            refreshBadgeNow();
        });
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 07: IGN network calls & page parsing
// ===================================================================
// Everything that talks to ign.com or mollusk.apis.ign.com lives here:
// fetching a candidate URL and parsing its DOM into a plain data object,
// and the GraphQL site-search fallback. If IGN changes its markup or its
// search API, this is the only file that needs to change.
(function (NS) {
    'use strict';

    // ---- IGN site search (used when slug-guessing finds nothing) ----
    // This is IGN's actual search API — a GraphQL persisted query — rather than scraping the
    // HTML search page. Note: persisted-query hashes can go stale if IGN redeploys their
    // frontend; if this stops finding anything, grab a fresh sha256Hash from DevTools > Network
    // on ign.com while searching, and swap it in below.
    const IGN_SEARCH_PERSISTED_HASH = 'e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884';

    // The exact response schema isn't something we can verify from here, so this walks the
    // entire parsed JSON tree looking for any object with a "slug" or a "/games/" url field,
    // rather than assuming one specific shape.
    function extractGameResultsFromGraphQL(json) {
        const results = [];
        const seen = new Set();

        function addCandidate(slug, text) {
            if (!slug) return;
            const cleanSlug = String(slug).replace(/^\/+|\/+$/g, '').replace(/^games\//, '').toLowerCase();
            if (!cleanSlug || seen.has(cleanSlug)) return;
            seen.add(cleanSlug);
            results.push({ slug: cleanSlug, text: text || cleanSlug.replace(/-/g, ' ') });
        }

        function walk(node) {
            if (results.length > 30 || !node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(walk); return; }

            const name = typeof node.name === 'string' ? node.name : (typeof node.title === 'string' ? node.title : '');
            if (typeof node.slug === 'string' && node.slug) addCandidate(node.slug, name);
            if (typeof node.url === 'string' && /\/games\//i.test(node.url)) {
                const match = node.url.match(/\/games\/([a-z0-9-]+)/i);
                if (match) addCandidate(match[1], name);
            }

            Object.values(node).forEach(walk);
        }

        walk(json);
        return results;
    }

    // Scores each candidate by word-overlap with the searched title, preferring earlier
    // (higher-ranked) results on ties.
    function pickBestSearchResult(results, searchTerm) {
        if (!results.length) return null;

        const titleWords = new Set(
            searchTerm.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
        );

        let best = null, bestScore = -Infinity;
        results.forEach((r, index) => {
            const words = new Set(r.text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/));
            let overlap = 0;
            titleWords.forEach(w => { if (words.has(w)) overlap++; });
            const score = overlap - index * 0.01;
            if (score > bestScore) { bestScore = score; best = r; }
        });
        return best;
    }

    NS.fetchIgnSearch = function fetchIgnSearch(term, callback) {
        const variables = JSON.stringify({ term, count: 20, objectType: 'Game' });
        const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: IGN_SEARCH_PERSISTED_HASH } });
        const url = `https://mollusk.apis.ign.com/graphql?operationName=SearchObjectsByName&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback(null); return; }
                try {
                    const json = JSON.parse(response.responseText);
                    const results = extractGameResultsFromGraphQL(json);
                    const best = pickBestSearchResult(results, term);
                    callback(best ? { slug: best.slug, url: `https://www.ign.com/games/${best.slug}` } : null);
                } catch (e) {
                    callback(null);
                }
            },
            onerror: function () { callback(null); }
        });
    };

    // Parses a fetched IGN game page's DOM into a plain data object. Used for the main game
    // page fetch as well as HLTB-override fetches (which reuse this to pull just the HLTB block
    // off a different IGN page).
    NS.parseIgnPage = function parseIgnPage(doc) {
        let fetchedGameTitle = '';
        const h1TitleEl = doc.querySelector('h1[data-cy="object-header-display-title"]') || doc.querySelector('h1.display-title');
        if (h1TitleEl && h1TitleEl.textContent.trim()) fetchedGameTitle = h1TitleEl.textContent.trim();

        // IGN score (prefer JSON-LD, fall back to the hexagon widget)
        let ignScore = 'N/A';
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                if (data.reviewRating?.ratingValue) ignScore = String(data.reviewRating.ratingValue);
            } catch (e) {}
        });
        if (ignScore === 'N/A') {
            const el = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
            if (el) ignScore = el.textContent.trim();
        }

        // User score
        let userScore = 'N/A';
        const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
        if (userReviewsLink) {
            const ratingEl = userReviewsLink.querySelector('[data-cy="score-rating-small"]');
            if (ratingEl) userScore = ratingEl.textContent.trim();
        }
        if (userScore === 'N/A') {
            const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
            if (smallScoreEls.length > 0) userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
        }

        // Developer / producer
        let developerName = '';
        const devEl = doc.querySelector('[data-cy="developerLink"]') ||
            doc.querySelector('a[href*="/games/developer/"]') ||
            doc.querySelector('[data-cy="producerLink"]') ||
            doc.querySelector('a[href*="/games/producer/"]');
        if (devEl && devEl.textContent.trim()) developerName = devEl.textContent.trim();

        // ESRB rating + descriptors
        let esrbImgSrc = '', esrbAlt = '', esrbDescriptors = '';
        const esrbImgEl = doc.querySelector('img[data-cy^="icon-esrb"]') || doc.querySelector('img[alt*="ESRB:"]');
        if (esrbImgEl) {
            esrbImgSrc = esrbImgEl.getAttribute('src');
            esrbAlt = esrbImgEl.getAttribute('alt') || 'ESRB Rating';
        }
        if (esrbAlt && esrbAlt.includes(':')) {
            const [firstPart, ...rest] = esrbAlt.split(':');
            const label = firstPart.trim();
            const remainder = rest.join(':').trim();
            if (/^esrb$/i.test(label)) {
                // IGN's actual format: "ESRB: Mature" — the part after the colon IS the
                // rating name, not a descriptor list.
                esrbAlt = remainder;
            } else {
                // Fallback for the "<rating>: <descriptors>" format, if IGN ever uses it.
                esrbAlt = label;
                esrbDescriptors = remainder;
            }
        }
        esrbAlt = NS.normalizeEsrbLabel(esrbAlt);
        if (!esrbDescriptors) {
            const descContainer = doc.querySelector('[data-cy*="esrb-descriptors"]') || doc.querySelector('.esrb-descriptors');
            if (descContainer) esrbDescriptors = descContainer.textContent.trim();
        }

        // Leaderboard award
        let awardData = null;
        const awardEl = doc.querySelector('figure[data-cy="review-score"].icon-award') || doc.querySelector('[class*="icon-award"]');
        if (awardEl) {
            const rankText = awardEl.querySelector('figcaption')?.textContent.trim() || '';
            let labelType = 'Global Rank';
            if (awardEl.className.includes('icon-award-gold')) labelType = 'Gold Rank';
            else if (awardEl.className.includes('icon-award-silver')) labelType = 'Silver Rank';
            else if (awardEl.className.includes('icon-award-bronze')) labelType = 'Bronze Rank';
            if (rankText) awardData = { rank: rankText, label: labelType };
        }

        // HowLongToBeat
        const hltbData = [];
        let hltbUrl = '';
        const hltbContent = doc.querySelector('[data-cy="hl2b-content"]') || doc.querySelector('.hl2b-content');
        if (hltbContent) {
            hltbContent.querySelectorAll('.meta-item, [data-cy$="meta-item"]').forEach(item => {
                const timeEl = item.querySelector('.title4, [data-cy="title4"]');
                const captionEl = item.querySelector('.caption, [data-cy="caption"]');
                if (timeEl && captionEl) hltbData.push({ time: timeEl.textContent.trim(), label: captionEl.textContent.trim() });
            });

            const hltbLinkEl = hltbContent.closest('a[href*="howlongtobeat.com"]') || hltbContent.querySelector('a[href*="howlongtobeat.com"]');
            if (hltbLinkEl) hltbUrl = hltbLinkEl.getAttribute('href');
        }
        if (!hltbUrl) {
            const anyHltbLink = doc.querySelector('a[href*="howlongtobeat.com"]');
            if (anyHltbLink) hltbUrl = anyHltbLink.getAttribute('href');
        }

        return { fetchedGameTitle, ignScore, userScore, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, hltbData, hltbUrl };
    };

    // Tries each candidate URL in order; calls back with { url, parsed } for the first one that
    // returns 200, or null if none do. Shared by the single-game, dual-game, and package-item flows.
    NS.resolveFirstWorkingUrl = function resolveFirstWorkingUrl(candidateUrls, callback) {
        function tryNext(index) {
            if (index >= candidateUrls.length) { callback(null); return; }

            const url = candidateUrls[index];
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: function (response) {
                    if (response.status !== 200) { tryNext(index + 1); return; }
                    let parsed = null;
                    try {
                        const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                        parsed = NS.parseIgnPage(doc);
                    } catch (e) { parsed = null; }
                    callback({ url, parsed });
                },
                onerror: function () { tryNext(index + 1); }
            });
        }
        tryNext(0);
    };

    NS.gameEntryFromResult = function gameEntryFromResult(result, fallbackName) {
        const p = result.parsed;
        return {
            name: (p && p.fetchedGameTitle) || fallbackName,
            url: result.url,
            ignScore: p ? p.ignScore : 'N/A',
            userScore: p ? p.userScore : 'N/A',
            parsed: p
        };
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 08: HowLongToBeat network calls & page parsing
// ===================================================================
// Everything that talks to howlongtobeat.com, plus the two per-title
// override tables for games whose IGN page has missing/unreliable HLTB
// data. If HLTB changes its markup, or you need to add another override,
// this is the only file that needs to change.
(function (NS) {
    'use strict';

    // Games whose own IGN page has missing/unreliable HLTB data — pull it from another IGN page instead
    NS.HLTB_SOURCE_OVERRIDES = {
        'final fantasy vii remake intergrade': 'https://www.ign.com/games/final-fantasy-vii-remake'
    };

    // Games whose IGN page has no HLTB block/link at all — go straight to a known HowLongToBeat
    // game page instead of trying (and failing) to scrape one from IGN.
    NS.HLTB_DIRECT_URL_OVERRIDES = {
        "ninja gaiden 3: razor's edge": 'https://howlongtobeat.com/game/6623',
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": 'https://howlongtobeat.com/game/6623',
        'kingdom hearts -hd 1.5+2.5 remix-': 'https://howlongtobeat.com/game/42802'
    };

    // Fetches just the HLTB block from an override IGN URL. Calls back with { hltbData, hltbUrl }.
    NS.fetchHltbOverride = function fetchHltbOverride(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback({ hltbData: [], hltbUrl: '' }); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    const p = NS.parseIgnPage(doc);
                    callback({ hltbData: p.hltbData, hltbUrl: p.hltbUrl });
                } catch (e) {
                    callback({ hltbData: [], hltbUrl: '' });
                }
            },
            onerror: function () { callback({ hltbData: [], hltbUrl: '' }); }
        });
    };

    // Parses the HLTB game page's own play-time table (Polled/Average/Median/Rushed/Leisure),
    // pulling out one named column (e.g. "Average", "Leisure"), skipping "All PlayStyles".
    function parseHltbTableColumn(doc, columnName) {
        const table = doc.querySelector('table[class*="GameTimeTable"]');
        if (!table) return [];

        const headerCells = Array.from(table.querySelectorAll('thead td, thead th')).map(td => td.textContent.trim().toLowerCase());
        const colIndex = headerCells.indexOf(columnName.toLowerCase());
        if (colIndex === -1) return [];

        const results = [];
        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length <= colIndex) return;

            const label = cells[0].textContent.trim();
            if (!label || /all\s*playstyles/i.test(label)) return;

            const time = cells[colIndex].textContent.trim();
            if (time) results.push({ label, time });
        });

        return results;
    }

    function parseHltbLeisureData(doc) {
        return parseHltbTableColumn(doc, 'leisure');
    }

    // Fetches an HLTB game page directly and pulls its "Average" column as the main HLTB
    // stats (matching what IGN itself normally displays), for games whose IGN page has no
    // HLTB data of its own to scrape (see HLTB_DIRECT_URL_OVERRIDES).
    NS.fetchHltbDirect = function fetchHltbDirect(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback({ hltbData: [], hltbUrl: url }); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    callback({ hltbData: parseHltbTableColumn(doc, 'average'), hltbUrl: url });
                } catch (e) {
                    callback({ hltbData: [], hltbUrl: url });
                }
            },
            onerror: function () { callback({ hltbData: [], hltbUrl: url }); }
        });
    };

    // Fetches the HLTB game page and extracts its Leisure-time data. Never throws — callback
    // always receives an array (possibly empty) so a failure here can't break the rest of the overlay.
    NS.fetchHltbLeisure = function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) { callback([]); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: hltbUrl,
            onload: function (response) {
                if (response.status !== 200) { callback([]); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    callback(parseHltbLeisureData(doc));
                } catch (e) {
                    callback([]);
                }
            },
            onerror: function () { callback([]); }
        });
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 09: Fetch orchestration
// ===================================================================
// This is the "glue" file: it decides WHICH combination of title-resolver
// (03), page-scraper (04), badge-render (05), ign-api (07), and hltb-api
// (08) calls to make for a given title, and in what order/fallback chain.
// It doesn't parse anything itself and doesn't build any HTML itself —
// it only calls into those other files. NS.fetchIGNData is the single
// entry point main.js (10) calls.
(function (NS) {
    'use strict';

    // After rendering a badge that has a resolved HLTB url, fetch the HLTB page's Leisure-time
    // column and either splice it into the placeholder reserved by badge-render (when its
    // location is 'inline') or render it as its own standalone element at its own configured
    // location. Shared by every render path below so the "fetch leisure, then place it" pattern
    // only lives in one place.
    function attachLeisureSection(resolvedHltbUrl) {
        if (!resolvedHltbUrl || !NS.getConfig('showLeisure')) return;
        NS.fetchHltbLeisure(resolvedHltbUrl, (leisureData) => {
            const leisureHtml = NS.buildLeisureRow(leisureData, resolvedHltbUrl);

            if (!NS.isInlineLocation(NS.getLeisureLocation())) {
                NS.renderStandaloneSection('ign_leisure_standalone_row', leisureHtml, NS.getLeisureLocation());
                return;
            }

            const badge = document.querySelector('.ign_rating_row');
            if (!badge) return;
            const placeholder = badge.querySelector('.ign_leisure_placeholder');
            if (!leisureHtml) { if (placeholder) placeholder.remove(); return; }
            if (placeholder) placeholder.outerHTML = leisureHtml;
            else badge.insertAdjacentHTML('beforeend', leisureHtml);
        });
    }

    // Fetches each sub-game's IGN page in a bundle (sequentially, simplest to reason about),
    // then renders a badge with one score row per game.
    function fetchBundleData(bundle, gameTitle) {
        const results = [];

        function fetchNext(index) {
            if (index >= bundle.length) {
                const resolvedHltbUrl = NS.renderMultiGameBadge(results, gameTitle);
                attachLeisureSection(resolvedHltbUrl);
                NS.state.isFetching = false;
                return;
            }

            const entry = bundle[index];
            const url = `https://www.ign.com/games/${entry.slug}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: function (response) {
                    let parsed = null;
                    if (response.status === 200) {
                        try {
                            const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                            parsed = NS.parseIgnPage(doc);
                        } catch (e) { parsed = null; }
                    }
                    results.push({ name: entry.name, url, ignScore: parsed ? parsed.ignScore : 'N/A', userScore: parsed ? parsed.userScore : 'N/A', parsed });
                    fetchNext(index + 1);
                },
                onerror: function () {
                    results.push({ name: entry.name, url, ignScore: 'N/A', userScore: 'N/A', parsed: null });
                    fetchNext(index + 1);
                }
            });
        }

        fetchNext(0);
    }

    // A "+" in a Steam title is ambiguous: sometimes it's one combined game (e.g. an HD
    // collection, "1.5+2.5"), sometimes it's actually two separate IGN-listed games sharing a
    // common prefix (e.g. "Kingdom Hearts III + Re Mind (DLC)" -> base game + its own DLC page).
    // Rather than guess, try both interpretations and use whichever URLs actually resolve.
    function tryDualGameSplit(gameTitle, callback) {
        const plusIndex = gameTitle.indexOf('+');
        if (plusIndex === -1) { callback(false); return; }

        const leftPart = gameTitle.slice(0, plusIndex).trim();
        const rightPart = gameTitle.slice(plusIndex + 1).replace(/\(\s*dlc\s*\)/gi, '').trim();
        if (!leftPart || !rightPart) { callback(false); return; }

        const mergedTitle = `${leftPart} ${rightPart}`.replace(/\s+/g, ' ').trim();
        const leftUrls = NS.buildCandidateSlugs(leftPart).map(slug => `https://www.ign.com/games/${slug}`);
        const mergedUrls = NS.buildCandidateSlugs(mergedTitle).map(slug => `https://www.ign.com/games/${slug}`);

        let leftResult, mergedResult, leftDone = false, mergedDone = false;

        function maybeFinish() {
            if (!leftDone || !mergedDone) return;

            if (leftResult && mergedResult && leftResult.url !== mergedResult.url) {
                const games = [
                    NS.gameEntryFromResult(leftResult, leftPart),
                    NS.gameEntryFromResult(mergedResult, mergedTitle)
                ];
                const resolvedHltbUrl = NS.renderMultiGameBadge(games, gameTitle);
                attachLeisureSection(resolvedHltbUrl);
                NS.state.isFetching = false;
                callback(true);
            } else {
                callback(false);
            }
        }

        NS.resolveFirstWorkingUrl(leftUrls, (r) => { leftResult = r; leftDone = true; maybeFinish(); });
        NS.resolveFirstWorkingUrl(mergedUrls, (r) => { mergedResult = r; mergedDone = true; maybeFinish(); });
    }

    // Tries slug guesses first, then falls back to a live IGN search. Shared by the single-game
    // flow and by collection/package item resolution (below).
    function resolveGameByTitle(title, callback) {
        const urlsToTry = NS.buildCandidateSlugs(title).map(slug => `https://www.ign.com/games/${slug}`);
        NS.resolveFirstWorkingUrl(urlsToTry, (result) => {
            if (result) { callback(result); return; }
            NS.fetchIgnSearch(title, (searchHit) => {
                if (!searchHit) { callback(null); return; }
                NS.resolveFirstWorkingUrl([searchHit.url], (searchResult) => callback(searchResult));
            });
        });
    }

    // Resolves each included game in a Steam bundle/package separately. Used both (a) as a
    // fallback when the collection's own name has no single IGN page, and (b) alongside a
    // successfully-resolved dedicated collection page, per user request, so every included
    // game's score is shown stacked underneath the collection's own row.
    function fetchPackageItems(names, originalTitle, dedicatedEntry) {
        const results = new Array(names.length).fill(null);
        let remaining = names.length;

        if (names.length === 0) {
            if (dedicatedEntry) {
                const resolvedHltbUrl = NS.renderMultiGameBadge([dedicatedEntry], originalTitle);
                attachLeisureSection(resolvedHltbUrl);
            } else {
                NS.renderEmpty('N/A', 'https://www.ign.com', originalTitle);
            }
            NS.state.isFetching = false;
            return;
        }

        names.forEach((name, index) => {
            resolveGameByTitle(name, (result) => {
                results[index] = result ? NS.gameEntryFromResult(result, name) : null;
                remaining -= 1;
                if (remaining === 0) {
                    const found = results.filter(Boolean);
                    // Don't list the collection's own page twice if it happens to match one of
                    // the individual items' resolved URL.
                    const deduped = dedicatedEntry
                        ? found.filter(g => g.url !== dedicatedEntry.url)
                        : found;
                    const combined = dedicatedEntry ? [dedicatedEntry, ...deduped] : deduped;

                    if (combined.length === 0) {
                        NS.renderEmpty('N/A', 'https://www.ign.com', originalTitle);
                    } else {
                        const resolvedHltbUrl = NS.renderMultiGameBadge(combined, originalTitle);
                        attachLeisureSection(resolvedHltbUrl);
                    }
                    NS.state.isFetching = false;
                }
            });
        });
    }

    function renderResolvedGame(result, gameTitle, fallbackUrl) {
        const { url: targetUrl, parsed: p } = result;
        if (!p) {
            NS.renderEmpty('N/A', targetUrl || fallbackUrl, gameTitle);
            NS.state.isFetching = false;
            return;
        }

        // Per user request: even when the collection/bundle itself has a dedicated IGN page,
        // still show every individual game listed on the Steam package page stacked underneath
        // it, rather than only showing the dedicated page's score.
        const packageNames = NS.extractPackageItemNames();
        if (packageNames.length >= 2) {
            const dedicatedEntry = NS.gameEntryFromResult(result, p.fetchedGameTitle || gameTitle);
            dedicatedEntry.isDedicated = true;
            fetchPackageItems(packageNames, gameTitle, dedicatedEntry);
            return;
        }

        const finishRender = (hltbData, hltbUrl) => {
            const resolvedHltbUrl = NS.renderCompleteBadge(p.ignScore, p.userScore, hltbData, hltbUrl, p.developerName,
                p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors, p.awardData, targetUrl, p.fetchedGameTitle);
            NS.state.isFetching = false;

            // Leisure section is fetched from HLTB separately and injected after the
            // fact, so it never delays or breaks the rest of the overlay.
            attachLeisureSection(resolvedHltbUrl);
        };

        const lookupKey = gameTitle.toLowerCase().trim();
        const userOverride = NS.getUserOverrideForTitle(gameTitle);
        // A manually-added HLTB override (settings panel) takes priority over the hardcoded
        // table — it's the same "go straight to this howlongtobeat.com page" mechanism, just
        // user-editable at runtime instead of requiring a code change.
        const directHltbUrl = (userOverride && userOverride.hltbUrl) || NS.HLTB_DIRECT_URL_OVERRIDES[lookupKey];
        const overrideUrl = NS.HLTB_SOURCE_OVERRIDES[lookupKey];

        if (directHltbUrl) {
            NS.fetchHltbDirect(directHltbUrl, (r) => finishRender(r.hltbData, r.hltbUrl));
        } else if (overrideUrl) {
            NS.fetchHltbOverride(overrideUrl, (r) => finishRender(r.hltbData, r.hltbUrl));
        } else {
            finishRender(p.hltbData, p.hltbUrl);
        }
    }

    function fetchSingleGame(gameTitle, isFallback, onExhausted) {
        const urlsToTry = NS.buildCandidateSlugs(gameTitle).map(slug => `https://www.ign.com/games/${slug}`);

        // A manually-added override always gets tried first (see NS.getUserOverrideForTitle,
        // set from the settings panel) — for games whose auto slug-guessing never resolves,
        // this lets a user just point straight at the right IGN page.
        const userOverride = NS.getUserOverrideForTitle(gameTitle);
        if (userOverride && userOverride.ignUrl) urlsToTry.unshift(userOverride.ignUrl);

        NS.resolveFirstWorkingUrl(urlsToTry, (result) => {
            if (result) { renderResolvedGame(result, gameTitle, urlsToTry[0]); return; }

            // Some DLC pages don't have enough data of their own, but Steam tells us the base
            // game right on the page — retry once with that instead.
            if (!isFallback) {
                const baseGameName = NS.extractDlcBaseGameName();
                if (baseGameName && baseGameName.toLowerCase().trim() !== gameTitle.toLowerCase().trim()) {
                    NS.fetchIGNData(baseGameName, { isFallback: true, onExhausted });
                    return;
                }
            }

            // Last resort: none of our guessed slugs worked, so actually search IGN for the
            // title instead of just giving up.
            NS.fetchIgnSearch(gameTitle, (searchHit) => {
                if (searchHit) {
                    NS.resolveFirstWorkingUrl([searchHit.url], (searchResult) => {
                        if (searchResult) { renderResolvedGame(searchResult, gameTitle, urlsToTry[0]); return; }
                        finalFallback();
                    });
                    return;
                }
                finalFallback();
            });

            function finalFallback() {
                // A "Collection" title with no single IGN page of its own might be a bundle of
                // separate games — check if the current page lists them and rate each one.
                if (/collection/i.test(gameTitle)) {
                    const packageNames = NS.extractPackageItemNames();
                    if (packageNames.length >= 2) {
                        fetchPackageItems(packageNames, gameTitle, null);
                        return;
                    }
                }

                // Nothing worked for this title at all — try the next title candidate, if any
                // (e.g. the un-stripped original title, or the Sigma "S"-letter fallback).
                if (onExhausted) { onExhausted(); return; }

                NS.renderEmpty('N/A', urlsToTry[0] || 'https://www.ign.com', gameTitle);
                NS.state.isFetching = false;
            }
        });
    }

    // Single entry point for resolving+rendering a title. Handles the bundle-override case,
    // the ambiguous "+" dual-game case, then falls through to the plain single-game flow.
    NS.fetchIGNData = function fetchIGNData(gameTitle, options = {}) {
        NS.state.isFetching = true;
        const isFallback = !!options.isFallback;

        const bundle = NS.BUNDLE_TITLE_OVERRIDES[gameTitle.toLowerCase().trim()];
        if (bundle) {
            fetchBundleData(bundle, gameTitle);
            return;
        }

        if (!isFallback && gameTitle.includes('+')) {
            tryDualGameSplit(gameTitle, (handled) => {
                if (!handled) fetchSingleGame(gameTitle, isFallback, options.onExhausted);
            });
            return;
        }

        fetchSingleGame(gameTitle, isFallback, options.onExhausted);
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

// ===================================================================
// IGN Rating Badge — 10: Bootstrapping
// ===================================================================
// The only file that runs anything at load time. Wires up: which title
// variants to try and in what order (init), watching the page for SPA-style
// content changes (MutationObserver), and registering the Tampermonkey
// menu commands. Everything it calls (NS.fetchIGNData, NS.getGameTitle,
// NS.stripCollectionBracket, NS.sigmaLetterFallbackTitle, NS.openSettingsPanel)
// is defined in earlier files, so this file only ever changes when the
// bootstrapping *sequence* itself needs to change.
(function (NS) {
    'use strict';

    // Tries each title in order, only moving to the next once the previous one has completely
    // exhausted every resolution method (slug guesses, DLC fallback, search, package items).
    function fetchWithTitleChain(titles) {
        function attempt(index) {
            if (index >= titles.length) return;
            const isLast = index === titles.length - 1;
            NS.fetchIGNData(titles[index], { onExhausted: isLast ? null : () => attempt(index + 1) });
        }
        attempt(0);
    }

    NS.init = function init() {
        const title = NS.getGameTitle();
        if (!title) return;

        if (title !== NS.state.lastProcessedTitle) {
            NS.state.lastProcessedTitle = title;
            document.querySelector('.ign_rating_row')?.remove();
        }

        if (document.querySelector('.ign_rating_row') || NS.state.isFetching) return;

        // "Title [Some Collection]" -> the real game name is what precedes the bracket, so
        // prefer that; only fall back to the raw title (brackets included) if it fails outright.
        const titleAttempts = [];
        const strippedTitle = NS.stripCollectionBracket(title);
        if (strippedTitle) titleAttempts.push(strippedTitle);
        titleAttempts.push(title);

        // If a Sigma symbol is present, add one final fallback using a plain "S" in its place —
        // matching how the Steam/Epic URL itself transliterates it — in case the spelled-out
        // "Sigma" form (tried first, via createIgnSlugs) doesn't match anything.
        const sigmaFallback = NS.sigmaLetterFallbackTitle(strippedTitle || title);
        if (sigmaFallback) titleAttempts.push(sigmaFallback);

        fetchWithTitleChain(titleAttempts);
    };

    if (typeof GM_registerMenuCommand !== 'undefined') {
        NS.registerMenuCommands();
        GM_registerMenuCommand('⚙️ Open Settings Panel', NS.openSettingsPanel);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', NS.init);
    } else {
        NS.init();
    }

    const observer = new MutationObserver(() => {
        clearTimeout(NS.state.debounceTimer);
        NS.state.debounceTimer = setTimeout(NS.init, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
