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

(function(NS) {
    "use strict";
    NS.IS_STEAM = window.location.hostname.includes("steampowered.com");
    NS.IS_EPIC = window.location.hostname.includes("epicgames.com");
    NS.state = { isFetching: false, lastProcessedTitle: "", debounceTimer: null };
    NS.escapeHtml = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    NS.findSafeBeforeTarget = function findSafeBeforeTarget(el) {
        let node = el;
        while (node.parentElement) {
            const display = getComputedStyle(node.parentElement).display;
            if (display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid") { node = node.parentElement; continue; }
            break;
        }
        return node;
    };
    // For "insert after X, so it lands below X": only climbs past ancestors laying children out
    // horizontally (row flex, or a multi-column grid) — stops once it reaches one that stacks
    // children vertically, since inserting there already lands on its own line.
    NS.findSafeAfterTarget = function findSafeAfterTarget(el) {
        let node = el;
        while (node.parentElement) {
            const cs = getComputedStyle(node.parentElement);
            const isRowFlex = cs.display.indexOf("flex") !== -1 && cs.flexDirection.indexOf("row") === 0;
            const isMultiColGrid = cs.display.indexOf("grid") !== -1 && cs.gridTemplateColumns.split(" ").filter(Boolean).length > 1;
            if (isRowFlex || isMultiColGrid) { node = node.parentElement; continue; }
            break;
        }
        return node;
    };
    if (typeof GM_getValue !== "undefined") {
        NS.storage = {
            ready: Promise.resolve(),
            getSync: (key, defaultValue) => GM_getValue(key, defaultValue),
            set: (key, value) => GM_setValue(key, value)
        };
    } else if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const cache = {};
        NS.storage = {
            ready: new Promise(resolve => chrome.storage.local.get(null, all => { Object.assign(cache, all || {}); resolve(); })),
            getSync: (key, defaultValue) => cache.hasOwnProperty(key) ? cache[key] : defaultValue,
            set: (key, value) => { cache[key] = value; chrome.storage.local.set({ [key]: value }); }
        };
    } else {
        const cache = {};
        NS.storage = {
            ready: Promise.resolve(),
            getSync: (key, defaultValue) => cache.hasOwnProperty(key) ? cache[key] : defaultValue,
            set: (key, value) => { cache[key] = value; }
        };
    }
    NS.http = typeof GM_xmlhttpRequest !== "undefined" ? {
        get: (url, handlers) => GM_xmlhttpRequest({ method: "GET", url: url, onload: handlers.onload, onerror: handlers.onerror })
    } : {
        get: (url, handlers) => {
            fetch(url, { method: "GET", credentials: "omit" })
                .then(res => res.text().then(text => ({ status: res.status, responseText: text })))
                .then(response => { if (handlers.onload) handlers.onload(response); })
                .catch(() => { if (handlers.onerror) handlers.onerror(); });
        }
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
    const CONFIG_KEYS = {
        showIgnScore: "Show IGN Score", showUserRating: "Show User Rating", showHltb: "Show HowLongToBeat",
        showLeisure: "Show HLTB Leisure Times", showSteamReviews: "Show Steam Reviews", showDeveloper: "Show Developer",
        showEsrb: "Show ESRB Rating & Descriptors", showAward: "Show IGN Award / Leaderboard"
    };
    const CONFIG_DEFAULTS = {
        showIgnScore: true, showUserRating: true, showHltb: true, showLeisure: true,
        showSteamReviews: true, showDeveloper: true, showEsrb: true, showAward: true
    };
    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
    NS.getConfig = key => NS.storage.getSync(key, CONFIG_DEFAULTS[key]);
    const SECTION_LABELS = {
        scores: "IGN Score / User Rating", steamReviews: "Steam Reviews", award: "Leaderboard Rank",
        esrb: "ESRB Rating", developer: "Developer", hltb: "HowLongToBeat", leisure: "HLTB Leisure Time"
    };
    const DEFAULT_SECTION_ORDER = [ "scores", "steamReviews", "award", "esrb", "developer", "hltb", "leisure" ];
    NS.SECTION_LABELS = SECTION_LABELS;
    NS.DEFAULT_SECTION_ORDER = DEFAULT_SECTION_ORDER;
    NS.getSectionOrder = function getSectionOrder() {
        const stored = NS.storage.getSync("sectionOrder", null);
        if (!Array.isArray(stored) || stored.length === 0) return [ ...DEFAULT_SECTION_ORDER ];
        const known = stored.filter(key => DEFAULT_SECTION_ORDER.includes(key));
        return [ ...known, ...DEFAULT_SECTION_ORDER.filter(key => !known.includes(key)) ];
    };
    NS.setSectionOrder = order => NS.storage.set("sectionOrder", order);
    NS.BADGE_POSITION_OPTIONS = [
        { value: "default", label: "Default" }, { value: "aboveTitle", label: "Above Game Title" },
        { value: "belowGameMedia", label: "Below Game Media" },
        { value: "abovePrice", label: "Steam: Above Game Price | Epic: Above Game Description" },
        { value: "belowLeftSidebar", label: "Below Left Sidebar" },
        { value: "aboveRightSidebarMetadata", label: "Above Right Side Metadata" },
        { value: "belowRightSidebarMetadata", label: "Below Right Side Metadata" },
        { value: "sidebarBottom", label: "Bottom of Right Sidebar" }
    ];
    // Position/location settings are per-platform (Steam vs Epic); getBadgePosition/getSectionLocation
    // resolve to the current page's platform, the ...For() variants take an explicit platform name so
    // the settings UI can edit both regardless of which site is currently open.
    NS.PLATFORMS = ["Steam", "Epic"];
    function currentPlatform() { return NS.IS_STEAM ? "Steam" : NS.IS_EPIC ? "Epic" : ""; }
    NS.getBadgePositionFor = platform => NS.storage.getSync("badgePosition" + platform, "default");
    NS.setBadgePositionFor = (platform, value) => NS.storage.set("badgePosition" + platform, value);
    NS.getBadgePosition = () => NS.getBadgePositionFor(currentPlatform());
    NS.setBadgePosition = value => NS.setBadgePositionFor(currentPlatform(), value);
    // Per-site enable/disable — checked once at the top of NS.init().
    NS.getSiteEnabled = platform => NS.storage.getSync("enabled" + platform, true);
    NS.setSiteEnabled = (platform, value) => NS.storage.set("enabled" + platform, value);
    NS.isEnabledForCurrentSite = () => NS.getSiteEnabled(currentPlatform());
    // Placement sharing: on writes one set of placement controls to both platforms; off gives each
    // enabled site its own column. getVisiblePlatforms() is what the settings UI renders columns for.
    NS.getPlacementShared = () => NS.storage.getSync("placementShared", false);
    NS.setPlacementShared = value => NS.storage.set("placementShared", value);
    NS.getEnabledPlatforms = () => NS.PLATFORMS.filter(p => NS.getSiteEnabled(p));
    NS.getVisiblePlatforms = () => { const enabled = NS.getEnabledPlatforms(); return NS.getPlacementShared() ? enabled.slice(0, 1) : enabled; };
    // Independent placement for HLTB / Leisure: 'inline' (default, inside the main badge) or any of
    // the positions above, rendered as their own element.
    NS.LOCATION_OPTIONS = [{ value: "inline", label: "Inline (Default)" }, ...NS.BADGE_POSITION_OPTIONS];
    NS.getSectionLocationFor = (key, platform) => NS.storage.getSync(key + "Location" + platform, "inline");
    NS.setSectionLocationFor = (key, platform, value) => NS.storage.set(key + "Location" + platform, value);
    NS.getSectionLocation = key => NS.getSectionLocationFor(key, currentPlatform());
    NS.setSectionLocation = (key, value) => NS.setSectionLocationFor(key, currentPlatform(), value);
    NS.getUserOverrides = () => NS.storage.getSync("userTitleOverrides", {});
    NS.setUserOverrides = overridesObj => NS.storage.set("userTitleOverrides", overridesObj);
    NS.setUserOverride = function setUserOverride(title, ignUrl, hltbUrl) {
        const key = title.trim().toLowerCase();
        if (!key) return;
        const all = NS.getUserOverrides();
        all[key] = { displayTitle: title.trim(), ignUrl: ignUrl ? ignUrl.trim() : "", hltbUrl: hltbUrl ? hltbUrl.trim() : "" };
        NS.setUserOverrides(all);
    };
    NS.removeUserOverride = function removeUserOverride(key) { const all = NS.getUserOverrides(); delete all[key]; NS.setUserOverrides(all); };
    NS.getUserOverrideForTitle = title => NS.getUserOverrides()[title.trim().toLowerCase()] || null;
    const menuCommandIds = {};
    const menuLabel = key => `${NS.getConfig(key) ? "✅" : "⬜"} ${CONFIG_KEYS[key]}`;
    NS.registerMenuCommands = function registerMenuCommands() {
        if (typeof GM_registerMenuCommand === "undefined") return;
        const canUnregister = typeof GM_unregisterMenuCommand !== "undefined";
        for (const key of Object.keys(CONFIG_KEYS)) {
            if (canUnregister && menuCommandIds[key] !== undefined) GM_unregisterMenuCommand(menuCommandIds[key]);
            menuCommandIds[key] = GM_registerMenuCommand(menuLabel(key), () => NS.toggleConfig(key));
        }
    };
    NS.toggleConfig = function toggleConfig(key) { NS.storage.set(key, !NS.getConfig(key)); NS.registerMenuCommands(); };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
    const ESRB_FULL_NAMES = {
        e: "Everyone", everyone: "Everyone", "e10+": "Everyone 10+", "e 10+": "Everyone 10+", "everyone 10+": "Everyone 10+",
        t: "Teen", teen: "Teen", m: "Mature 17+", mature: "Mature 17+", "mature 17+": "Mature 17+",
        ao: "Adults Only", "adults only": "Adults Only", rp: "Rating Pending", "rating pending": "Rating Pending"
    };
    NS.normalizeEsrbLabel = function normalizeEsrbLabel(rawLabel) {
        if (!rawLabel) return rawLabel;
        const key = rawLabel.trim().toLowerCase().replace(/^esrb:?\s*/i, "");
        return ESRB_FULL_NAMES[key] || rawLabel.trim();
    };
    const HLTB_LABEL_OVERRIDES = { "main story": "Main", "story + sides": "Main + Sides" };
    NS.relabelHltb = label => HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()] || label;
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
    NS.BUNDLE_TITLE_OVERRIDES = {
        "metal gear & metal gear 2: solid snake": [
            { name: "Metal Gear", slug: "metal-gear" },
            { name: "Metal Gear 2: Solid Snake", slug: "metal-gear-2-solid-snake" }
        ]
    };
    const TITLE_ALIASES = {
        "counter-strike 2": ["counter-strike: global offensive", "counter-strike"], cs2: ["counter-strike: global offensive"],
        "overwatch 2": ["overwatch"], "ea sports fc 24": ["fifa 24", "fifa 23"], "eafc 24": ["fifa 24"],
        "final fantasy vii remake intergrade": ["final fantasy vii remake"], "jurassic world evolution 3: rebirth expansion": ["jurassic world evolution 3"],
        "conan exiles enhanced: isle of siptah": ["conan exiles"], "ratchet & clank: rift apart": ["ratchet and clank rift apart"],
        "brütal legend": ["brutal legend", "brtal-legend"], "brutal legend": ["brtal-legend"],
        "guilty gear xrd rev 2": ["guilty gear xrd revelator 2"], "guilty gear": ["guilty-gear-1998"],
        "grand theft auto v": ["grand theft auto 5", "gta v", "gta 5"], "nioh 2": ["nioh 2"], "nioh 2 the complete edition": ["nioh 2"],
        "ninja gaiden 3": ["ninja gaiden iii"], "ninja gaiden 3: razor's edge": ["ninja gaiden iii razors edge"],
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": ["ninja gaiden iii razors edge"]
    };
    NS.TITLE_ALIASES = TITLE_ALIASES;
    const slugify = str => str.replace(/'/g, "").replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    function createIgnSlugs(title) {
        const noPeriods = title.replace(/\./g, "");
        let cleaned = noPeriods.replace(/[™®©]/g, "").replace(/[’‘]/g, "'").replace(/[–—]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ä/g, "a").replace(/Ä/g, "a").replace(/ö/g, "o").replace(/Ö/g, "o").replace(/ß/g, "ss")
            .replace(/[Σσς](\d)/g, "Sigma $1").replace(/[Σσς]/g, "Sigma").replace(/Δ/g, "delta").replace(/Ω/g, "omega");
        cleaned = cleaned.replace(/\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, "")
            .replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi, "").replace(/[–—-]\s*$/g, "").trim();
        const slug = slugify(cleaned);
        const primarySlug = slug.replace(/&/g, "and");
        const secondarySlug = slug.replace(/&/g, "");
        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, "");
        const tertiarySlug = noPrefix !== cleaned && noPrefix.length > 0 ? slugify(noPrefix).replace(/&/g, "and") : null;
        const aggressiveDropSlug = slugify(noPeriods.replace(/[^\x00-\x7F]/g, ""));
        return { primarySlug, secondarySlug, tertiarySlug, aggressiveDropSlug: aggressiveDropSlug !== primarySlug ? aggressiveDropSlug : null };
    }
    const slugsToList = s => [ s.primarySlug, s.secondarySlug, s.tertiarySlug, s.aggressiveDropSlug ].filter(Boolean);
    function toRoman(num) {
        const table = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
        let n = num, result = "";
        for (const [value, numeral] of table) while (n >= value) { result += numeral; n -= value; }
        return result;
    }
    const ROMAN_LOOKUP = {};
    for (let n = 1; n <= 50; n++) ROMAN_LOOKUP[toRoman(n).toLowerCase()] = n;
    const arabicToRomanVariant = title => title.replace(/\b(\d{1,2})\.5\b|\b(\d{1,2})\b/g, (match, decimalPart, intPart) => {
        if (decimalPart !== undefined) return `${toRoman(parseInt(decimalPart, 10))}.5`;
        const num = parseInt(intPart, 10);
        return num >= 1 && num <= 50 ? toRoman(num) : match;
    });
    const romanToArabicVariant = title => title.replace(/\b[a-zA-Z]+\b/g, word => {
        const key = word.toLowerCase();
        return ROMAN_LOOKUP.hasOwnProperty(key) ? String(ROMAN_LOOKUP[key]) : word;
    });
    function generateTitleVariants(title) {
        const variants = new Set([title]);
        const dashUnwrapped = title.replace(/\s-([^-]+)-\s*$/i, " $1").trim();
        if (dashUnwrapped !== title) variants.add(dashUnwrapped);
        for (const base of [...variants]) { const noDlc = base.replace(/\(\s*dlc\s*\)/gi, "").replace(/\s+/g, " ").trim(); if (noDlc !== base) variants.add(noDlc); }
        for (const base of [...variants]) {
            if (!base.includes("+")) continue;
            variants.add(base.replace(/\s*\+\s*/g, " and ").replace(/\s+/g, " ").trim());
            variants.add(base.replace(/\s*\+\s*/g, " ").replace(/\s+/g, " ").trim());
        }
        for (const base of [...variants]) {
            const romanVariant = arabicToRomanVariant(base), arabicVariant = romanToArabicVariant(base);
            if (romanVariant !== base) variants.add(romanVariant);
            if (arabicVariant !== base) variants.add(arabicVariant);
        }
        return [...variants];
    }
    NS.stripCollectionBracket = function stripCollectionBracket(title) {
        const match = title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i);
        return match ? match[1].trim() : null;
    };
    NS.sigmaLetterFallbackTitle = function sigmaLetterFallbackTitle(title) {
        if (!/[Σσς]/.test(title)) return null;
        return title.replace(/[Σσς](\d)/g, "S$1").replace(/[Σσς]/g, "S");
    };
    NS.buildCandidateSlugs = function buildCandidateSlugs(gameTitle) {
        let slugs = [];
        for (const variant of generateTitleVariants(gameTitle)) slugs = slugs.concat(slugsToList(createIgnSlugs(variant)));
        const lowerTitle = gameTitle.toLowerCase().trim();
        for (const alias of TITLE_ALIASES[lowerTitle] || []) {
            if (!alias.includes(" ")) slugs.push(alias);
            for (const aliasVariant of generateTitleVariants(alias)) slugs = slugs.concat(slugsToList(createIgnSlugs(aliasVariant)));
        }
        return [ ...new Set(slugs) ];
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function (NS) {
    "use strict";
    const cleanSteamTitle = raw => raw.replace(/^Save \d+% on /i, "").replace(/^Pre-purchase /i, "").replace(/ on Steam$/i, "").trim();
    NS.getGameTitle = function getGameTitle() {
        if (NS.IS_STEAM) {
            const titleEl = document.getElementById("appHubAppName") || document.querySelector(".page_title_area .apphub_AppName") || document.querySelector(".app_header_content .app_name");
            if (titleEl && titleEl.textContent.trim()) return titleEl.textContent.trim();
            const ogTitle = document.querySelector('meta[property="og:title"]');
            if (ogTitle && ogTitle.content) { const title = cleanSteamTitle(ogTitle.content.trim()); if (title) return title; }
            if (document.title) { const title = cleanSteamTitle(document.title); if (title && title !== "Steam") return title; }
        }
        if (NS.IS_EPIC) { const h1El = document.querySelector("h1") || document.querySelector('[data-testid="pdp-title"]'); if (h1El) return h1El.textContent.trim(); }
        return null;
    };
    NS.extractSteamReviews = function extractSteamReviews() {
        if (!NS.IS_STEAM) return [];
        const SENTIMENT_COLORS = { positive: "#66c0f4", mixed: "#e2b93d", negative: "#a34c25" };
        const results = [];
        document.querySelectorAll("#userReviews .user_reviews_summary_row").forEach(row => {
            const subtitleEl = row.querySelector(".subtitle"), summaryEl = row.querySelector(".game_review_summary");
            if (!subtitleEl || !summaryEl) return;
            const label = subtitleEl.textContent.trim().replace(/:\s*$/, ""), summaryText = summaryEl.textContent.trim();
            if (!label || !summaryText) return;
            const countEl = row.querySelector(".responsive_hidden");
            const count = countEl ? countEl.textContent.trim().replace(/[()]/g, "") : "";
            let percent = "";
            const percentMatch = (row.getAttribute("data-tooltip-html") || "").match(/(\d+)%/);
            if (percentMatch) percent = `${percentMatch[1]}%`;
            let sentiment = "mixed";
            if (/\bpositive\b/i.test(summaryEl.className)) sentiment = "positive";
            else if (/\bnegative\b/i.test(summaryEl.className)) sentiment = "negative";
            results.push({ label, summaryText, count, percent, color: SENTIMENT_COLORS[sentiment] });
        });
        return results;
    };
    NS.extractDlcBaseGameName = function extractDlcBaseGameName() {
        if (!NS.IS_STEAM) return null;
        for (const p of document.querySelectorAll(".content p, p")) {
            if (!/requires the base game/i.test(p.textContent || "")) continue;
            const link = p.querySelector('a[href*="/app/"]') || p.querySelector("a");
            const name = link ? link.textContent.trim() : "";
            if (name) return name;
        }
        return null;
    };
    NS.extractPackageItemNames = function extractPackageItemNames() {
        if (!NS.IS_STEAM) return [];
        const names = [], seen = new Set();
        document.querySelectorAll(".package_landing_page_item_list .tab_item_name").forEach(el => {
            const name = (el.textContent || "").trim(), key = name.toLowerCase();
            if (name && !seen.has(key)) { seen.add(key); names.push(name); }
        });
        return names;
    };
    // Climbs from a marker element up to the row that's a direct child of `container` — anchors to
    // real content (a testid, a link) instead of hashed/unstable classes.
    function rowUnder(container, markerEl) {
        if (!container || !markerEl) return null;
        let node = markerEl;
        while (node && node.parentElement && node.parentElement !== container) node = node.parentElement;
        return node && node.parentElement === container ? node : null;
    }
    // `a`'s own ancestor-or-self that's a direct child of the nearest ancestor shared with `b` —
    // anchors "insert before this whole section" without needing the exact (unstable) nesting depth.
    function commonAncestorChild(a, b) {
        let common = a.parentElement;
        while (common && !common.contains(b)) common = common.parentElement;
        return common ? rowUnder(common, a) : null;
    }
    NS.getTargetInsertionPoint = function getTargetInsertionPoint(explicitPosition) {
        const pref = explicitPosition || NS.getBadgePosition();
        if (NS.IS_STEAM) {
            if (pref === "aboveTitle") { const titleArea = document.querySelector(".page_title_area.game_title_area") || document.querySelector(".page_title_area"); if (titleArea) return { element: NS.findSafeBeforeTarget(titleArea), position: "before" }; }
            if (pref === "sidebarBottom" || pref === "belowRightSidebarMetadata" || pref === "aboveRightSidebarMetadata") { const sidebar = document.querySelector(".rightcol.game_meta_data") || document.querySelector(".game_meta_data"); if (sidebar) return { element: sidebar, position: pref === "aboveRightSidebarMetadata" ? "prepend" : "append" }; }
            if (pref === "abovePrice") { const purchaseArea = document.querySelector("#game_area_purchase"); if (purchaseArea) return { element: purchaseArea, position: "before" }; }
            if (pref === "belowGameMedia") { const media = document.querySelector(".highlight_ctn"); if (media) return { element: media, position: "after" }; }
            if (pref === "belowLeftSidebar") {
                // Anchored on "System Requirements" (.sys_req + its fade/read-more overlay share one
                // .game_page_autocollapse_ctn wrapper) — stays inside .leftcol's normal flow, so no
                // findSafeAfterTarget/alignTo needed here (unlike escaping the leftcol/rightcol row).
                const sysReq = document.querySelector(".sys_req");
                const sysReqCtn = sysReq && sysReq.closest(".game_page_autocollapse_ctn");
                if (sysReqCtn) return { element: sysReqCtn, position: "after" };
                const leftCol = document.querySelector(".leftcol.game_description_column");
                if (leftCol) return { element: NS.findSafeAfterTarget(leftCol), position: "after", alignTo: leftCol };
            }
            const headerImage = document.querySelector(".game_header_image_full") || document.querySelector(".game_header_image_ctn") || document.querySelector(".glance_ctn_responsive .game_header_image_full");
            if (headerImage) return { element: headerImage, position: "before" };
            const glanceCtn = document.querySelector(".glance_ctn_responsive") || document.querySelector(".game_meta_data");
            if (glanceCtn) return { element: glanceCtn, position: "prepend" };
            const mobileReviews = document.querySelector("#user_reviews_container") || document.querySelector(".user_reviews_filter_score") || document.querySelector(".review_histogram_rollup");
            if (mobileReviews) return { element: mobileReviews, position: "after" };
            const packageList = document.querySelector(".package_landing_page_item_list");
            if (packageList) return { element: packageList, position: "before" };
        }
        if (NS.IS_EPIC) {
            const buyBtn = document.querySelector('[data-testid="purchase-cta-button"]');
            // Anchoring off the buy button (rather than a bare "aside" selector) finds the actual
            // sidebar, not an unrelated aside elsewhere on the page (e.g. a recommendations rail).
            const aside = (buyBtn && buyBtn.closest("aside")) || document.querySelector("aside");
            if (pref === "aboveTitle") { const titleSpan = document.querySelector('[data-testid="pdp-title"]'); const titleH1 = titleSpan ? titleSpan.closest("h1") : null; if (titleH1) return { element: NS.findSafeBeforeTarget(titleH1), position: "before" }; }
            // <aside> is sticky-positioned, so content appended inside only becomes visible once it
            // un-sticks, by when the page has scrolled past it. Escaping to normal flow after the whole
            // row avoids that; alignTo re-aligns it visually under the sidebar's column afterward.
            if ((pref === "sidebarBottom" || pref === "belowRightSidebarMetadata") && aside) return { element: NS.findSafeAfterTarget(aside), position: "after", alignTo: aside };
            if (pref === "abovePrice") {
                const metaCols = document.querySelectorAll('[data-testid="about-metadata-layout-column"]');
                const metaRow = metaCols.length ? metaCols[metaCols.length - 1].parentElement : null;
                if (metaRow) return { element: metaRow, position: "after" };
                const about = document.getElementById("about-long-description");
                if (about) return { element: about, position: "before" };
            }
            if (pref === "aboveRightSidebarMetadata") { const row = rowUnder(aside, document.querySelector('[data-testid="metadata-developer-single"]')); if (row) return { element: row, position: "before" }; }
            if (pref === "belowGameMedia") { const metaCol = document.querySelector('[data-testid="about-metadata-layout-column"]'), aboutDesc = document.getElementById("about-long-description"); const row = metaCol && aboutDesc ? commonAncestorChild(metaCol, aboutDesc) : null; if (row) return { element: row, position: "before" }; }
            if (pref === "belowLeftSidebar") {
                // The whole "System Requirements" section shares this site-wide two-level wrapper (h3
                // in a title div, both in one outer section div — same as "Follow Us"/"Editions"/"DLC"/
                // "Ratings"). Inserting after that outer section keeps the badge outside the card's
                // rounded background instead of squeezed between the OS tabs and the info rows below.
                const sysReqHeading = Array.from(document.querySelectorAll("h3")).find(h => /system requirements/i.test(h.textContent || ""));
                const sysReqSection = sysReqHeading && sysReqHeading.parentElement && sysReqHeading.parentElement.parentElement;
                if (sysReqSection && sysReqSection.parentElement && sysReqSection.parentElement.children.length > 1) return { element: sysReqSection, position: "after" };
                // Fallback: right after the tabs, before whichever info block comes next in the card.
                const tabs = document.querySelector('[role="tablist"]');
                const nextLabel = Array.from(document.querySelectorAll("p")).find(p => /login accounts required|languages supported/i.test(p.textContent || ""));
                const row = tabs && nextLabel ? commonAncestorChild(tabs, nextLabel) : null;
                if (row) return { element: row, position: "after" };
                // Last resort: after the whole info card, aligned to the actual left content column.
                const main = document.querySelector('main');
                const fallbackRow = rowUnder(main, Array.from(document.querySelectorAll("p")).find(p => /languages supported/i.test(p.textContent || "")));
                if (fallbackRow) return { element: fallbackRow, position: "after", alignTo: (aside && aside.previousElementSibling) || fallbackRow };
            }
            const epicTarget = aside || document.querySelector('main');
            if (epicTarget) return { element: epicTarget, position: "prepend" };
        }
        return null;
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
    const BADGE_STYLE = `margin: 10px auto; padding: 14px 16px; background: linear-gradient(135deg, rgba(20,20,20,0.95), rgba(35,35,35,0.95)); border-radius: 8px; border-left: 5px solid #ff3e3e; box-shadow: 0 4px 15px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; clear: both; color: #ffffff; grid-column: 1 / -1;`;
    const statBlock = (value, label, valueSize = "18px", valueColor = "#ffffff", labelSize = "8px") => `<div style="display:flex;flex-direction:column;align-items:center;flex:1;text-align:center;"><span style="font-size:${valueSize};font-weight:bold;color:${valueColor};line-height:1.1;">${NS.escapeHtml(value)}</span><span style="font-size:${labelSize};color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-top:3px;white-space:nowrap;">${NS.escapeHtml(label)}</span></div>`;
    const divider = (height = "32px") => `<div style="border-left:1px solid rgba(255,255,255,0.15);height:${height};"></div>`;
    const sectionRow = (extra = "") => `border-top:1px solid rgba(255,255,255,0.15);padding-top:10px;${extra}`;
    const gearButtonHtml = (extraStyle = "") => `<button type="button" class="ign_open_settings_gear" title="IGN Metadata Injector settings" style="background:transparent;border:none;color:#8f98a0;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px;flex-shrink:0;${extraStyle}">⚙</button>`;
    function buildTopRow(ignScore, userScore, ignUrl, displayName) {
        const showIgn = NS.getConfig("showIgnScore"), showUser = NS.getConfig("showUserRating");
        if (!showIgn && !showUser) return "";
        const scoresHtml = (showIgn ? statBlock(ignScore, "IGN Score", "22px", "#ffffff", "11px") : "") + (showIgn && showUser ? divider() : "") + (showUser ? statBlock(userScore, "User Rating", "22px", "#ffffff", "11px") : "");
        return `<div style="display:flex;align-items:center;justify-content:space-between;width:100%;"><div style="display:flex;flex-direction:column;align-items:flex-start;justify-content:center;max-width:130px;overflow:hidden;"><a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" style="font-weight:bold;color:#ff3e3e;font-size:13px;letter-spacing:0.5px;text-transform:uppercase;text-decoration:none;white-space:nowrap;">IGN Overview ↗</a><a href="${encodeURI(ignUrl)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(displayName)}" style="font-size:10px;font-weight:bold;color:#b8b8b8;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-top:2px;">${NS.escapeHtml(displayName)} ↗</a></div><div style="display:flex;align-items:center;gap:14px;">${scoresHtml}</div></div>`;
    }
    function buildMultiGameTopRow(games) {
        if (!games || games.length === 0) return "";
        const showIgn = NS.getConfig("showIgnScore"), showUser = NS.getConfig("showUserRating");
        if (!showIgn && !showUser) return "";
        const scoreCol = "flex:0 0 70px;text-align:center;";
        const headerCells = [ `<div style="flex:1;overflow:hidden;">IGN Overview</div>` ];
        if (showIgn) headerCells.push(`<div style="${scoreCol}">IGN Score</div>`);
        if (showUser) headerCells.push(`<div style="${scoreCol}">User Rating</div>`);
        const headerRow = `<div style="display:flex;align-items:center;gap:8px;font-size:9px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.12);">${headerCells.join("")}</div>`;
        const valueRows = games.map(g => {
            const cells = [ `<div style="flex:1;overflow:hidden;"><a href="${encodeURI(g.url)}" target="_blank" rel="noopener noreferrer" title="${NS.escapeHtml(g.name)}" style="font-weight:bold;color:#ff3e3e;font-size:12px;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${NS.escapeHtml(g.name)}${g.isDedicated ? " (Collection)" : ""} ↗</a></div>` ];
            if (showIgn) cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.ignScore)}</div>`);
            if (showUser) cells.push(`<div style="${scoreCol}font-weight:bold;color:#ffffff;font-size:13px;">${NS.escapeHtml(g.userScore)}</div>`);
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05);">${cells.join("")}</div>`;
        }).join("");
        return `<div style="display:flex;flex-direction:column;">${headerRow}${valueRows}</div>`;
    }
    function buildSteamReviewsRow(reviewsData) {
        if (!NS.getConfig("showSteamReviews") || !reviewsData || reviewsData.length === 0) return "";
        const blocks = reviewsData.map(r => {
            const subParts = [];
            if (r.count) subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.count)}</span>`);
            if (r.percent) subParts.push(`<span style="font-size:13px;color:#c6d4df;font-weight:bold;white-space:nowrap;">${NS.escapeHtml(r.percent)} Positive</span>`);
            const subHtml = subParts.join(divider("12px"));
            return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;text-align:center;"><span style="font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;letter-spacing:0.3px;white-space:nowrap;">${NS.escapeHtml(r.label)}</span><span style="font-size:14px;font-weight:bold;color:${r.color};text-transform:uppercase;letter-spacing:0.3px;">${NS.escapeHtml(r.summaryText)}</span><div style="display:flex;align-items:center;gap:8px;">${subHtml}</div></div>`;
        }).join(divider("48px"));
        return `<div style="${sectionRow("display:flex;align-items:flex-start;justify-content:space-around;")}">${blocks}</div>`;
    }
    function buildAwardRow(awardData) {
        if (!NS.getConfig("showAward") || !awardData) return "";
        return `<a href="https://www.ign.com/icons" target="_blank" rel="noopener noreferrer" style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;text-decoration:none;")}"><span style="color:#a1b0bd;font-weight:bold;">Leaderboard Rank:</span><span style="color:#f1c40f;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">#${NS.escapeHtml(awardData.rank)} (${NS.escapeHtml(awardData.label)}) ↗</span></a>`;
    }
    function buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors) {
        if (!NS.getConfig("showEsrb") || !(esrbImgSrc || esrbDescriptors)) return "";
        const img = esrbImgSrc ? `<img src="${esrbImgSrc}" alt="${NS.escapeHtml(esrbAlt)}" title="${NS.escapeHtml(esrbAlt)}" style="height:56px;border-radius:4px;flex-shrink:0;box-shadow:0 2px 5px rgba(0,0,0,0.3);" />` : "";
        const desc = esrbDescriptors ? `<span style="color:#d0d0d0;font-size:10px;line-height:1.3;margin-top:2px;"><strong>Description:</strong> ${NS.escapeHtml(esrbDescriptors)}</span>` : "";
        const displayAlt = NS.normalizeEsrbLabel(esrbAlt);
        return `<div style="${sectionRow("display:flex;align-items:flex-start;gap:12px;")}">${img}<div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2px;flex:1;"><span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">ESRB</span><span style="color:#ffffff;font-size:15px;font-weight:bold;line-height:1.2;">${NS.escapeHtml(displayAlt)}</span>${desc}</div>${gearButtonHtml("margin-left:auto;")}</div>`;
    }
    function buildDevRow(developerName) {
        if (!NS.getConfig("showDeveloper") || !developerName) return "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Developer:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(developerName)}">${NS.escapeHtml(developerName)}</span></div>`;
    }
    function buildHltbRow(hltbData, hltbUrl) {
        if (!NS.getConfig("showHltb") || !(hltbData && hltbData.length > 0)) return "";
        const displayData = hltbData.filter(item => !/all styles/i.test(item.label));
        return displayData.length === 0 ? "" : hltbSectionHtml("HowLongToBeat", "#66c0f4", displayData, hltbUrl);
    }
    NS.buildLeisureRow = (leisureData, hltbUrl) =>
        (!NS.getConfig("showLeisure") || !leisureData || leisureData.length === 0) ? "" : hltbSectionHtml("HLTB Leisure Time", "#9b59b6", leisureData, hltbUrl);
    // Shared by buildHltbRow/buildLeisureRow: only the title text links out to HowLongToBeat — the
    // stat blocks stay plain — plus a settings gear beside it.
    function hltbSectionHtml(title, color, data, hltbUrl) {
        const items = data.map(item => statBlock(item.time, NS.relabelHltb(item.label), "16px", color, "10px")).join(divider("26px"));
        return `<div style="${sectionRow("display:flex;flex-direction:column;gap:8px;")}"><div style="display:flex;align-items:center;justify-content:space-between;"><a href="${encodeURI(hltbUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:${color};text-transform:uppercase;font-weight:bold;text-decoration:none;">${title} ↗</a>${gearButtonHtml()}</div><div style="display:flex;align-items:center;justify-content:space-around;background:rgba(0,0,0,0.4);padding:8px 4px;border-radius:4px;">${items}</div></div>`;
    }
    const resolveHltbUrl = (hltbUrl, displayName) => hltbUrl || `https://howlongtobeat.com/?q=${encodeURIComponent(displayName)}`;
    function insertAtTarget(node, targetObj) {
        const { element, position, alignTo } = targetObj;
        if (position === "after" && element.parentNode) element.parentNode.insertBefore(node, element.nextSibling);
        else if (position === "before" && element.parentNode) element.parentNode.insertBefore(node, element);
        else if (position === "prepend") element.prepend(node);
        else element.appendChild(node);
        if (!alignTo) return;
        // node now sits in normal flow outside alignTo's original (sticky) column — visually
        // re-align it under that column using real measured position/width.
        const targetRect = alignTo.getBoundingClientRect(), parentRect = node.parentNode.getBoundingClientRect();
        node.style.width = targetRect.width + "px";
        node.style.marginLeft = (targetRect.left - parentRect.left) + "px";
        node.style.marginRight = "auto";
    }
    function makeCtn(className, cssText, html) {
        const ctn = document.createElement("div");
        ctn.className = className;
        ctn.style.cssText = cssText;
        ctn.innerHTML = html;
        return ctn;
    }
    function insertBadge(badgeCtn) {
        const targetObj = NS.getTargetInsertionPoint();
        if (!targetObj) return false;
        insertAtTarget(badgeCtn, targetObj);
        return true;
    }
    // Renders a section as its own standalone element at `location` (removing any stale copy
    // first), or does nothing if html is empty. Shared by HLTB/Leisure.
    NS.renderStandalone = function renderStandalone(className, html, location) {
        document.querySelector("." + className)?.remove();
        if (!html) return;
        const targetObj = NS.getTargetInsertionPoint(location);
        if (targetObj) insertAtTarget(makeCtn(className, BADGE_STYLE, html), targetObj);
    };
    function buildSectionHtml(map) { return NS.getSectionOrder().map(key => map[key] || "").join(""); }
    NS.renderCompleteBadge = function renderCompleteBadge(ignScore, userScore, hltbData, hltbUrl, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, ignUrl, fetchedGameTitle = "") {
        if (!NS.getTargetInsertionPoint()) return null;
        document.querySelector(".ign_rating_row")?.remove();
        let displayName = fetchedGameTitle;
        if (!displayName) {
            const slugPart = ignUrl.split("/games/")[1] || "";
            displayName = slugPart.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        }
        const resolvedHltbUrl = resolveHltbUrl(hltbUrl, displayName);
        const hltbLoc = NS.getSectionLocation("hltb"), leisureLoc = NS.getSectionLocation("leisure");
        const hltbHtml = buildHltbRow(hltbData, resolvedHltbUrl);
        const mainHtml = buildSectionHtml({
            scores: buildTopRow(ignScore, userScore, ignUrl, displayName),
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: buildAwardRow(awardData),
            esrb: buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors),
            developer: buildDevRow(developerName),
            hltb: hltbLoc === "inline" ? hltbHtml : "",
            leisure: (leisureLoc === "inline" && NS.getConfig("showLeisure")) ? '<div class="ign_leisure_placeholder"></div>' : ""
        });
        const hasRealContent = !!mainHtml.replace(/<div class="ign_leisure_placeholder"><\/div>/g, "").trim();
        if (hasRealContent) insertBadge(makeCtn("ign_rating_row", BADGE_STYLE, mainHtml));
        NS.renderStandalone("ign_hltb_standalone", hltbLoc === "inline" ? "" : hltbHtml, hltbLoc);
        if (!hasRealContent && hltbLoc === "inline") return null;
        return resolvedHltbUrl;
    };
    NS.renderMultiGameBadge = function renderMultiGameBadge(games, gameTitle) {
        if (!NS.getTargetInsertionPoint()) return "";
        document.querySelector(".ign_rating_row")?.remove();
        const primary = games.find(g => g.parsed);
        const p = primary ? primary.parsed : null;
        const resolvedHltbUrl = p ? resolveHltbUrl(p.hltbUrl, gameTitle) : "";
        const hltbLoc = NS.getSectionLocation("hltb"), leisureLoc = NS.getSectionLocation("leisure");
        const hltbHtml = p ? buildHltbRow(p.hltbData, resolvedHltbUrl) : "";
        const mainHtml = buildSectionHtml({
            scores: buildMultiGameTopRow(games),
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: p ? buildAwardRow(p.awardData) : "",
            esrb: p ? buildEsrbRow(p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors) : "",
            developer: p ? buildDevRow(p.developerName) : "",
            hltb: (p && hltbLoc === "inline") ? hltbHtml : "",
            leisure: (p && leisureLoc === "inline" && NS.getConfig("showLeisure")) ? '<div class="ign_leisure_placeholder"></div>' : ""
        });
        insertBadge(makeCtn("ign_rating_row", BADGE_STYLE, mainHtml));
        if (p) NS.renderStandalone("ign_hltb_standalone", hltbLoc === "inline" ? "" : hltbHtml, hltbLoc);
        return p ? resolvedHltbUrl : "";
    };
    NS.fillLeisurePlaceholder = function fillLeisurePlaceholder(html) {
        const placeholder = document.querySelector(".ign_leisure_placeholder");
        if (placeholder) placeholder.outerHTML = html || "";
    };
    NS.renderEmpty = (status, targetUrl, gameTitle) => NS.renderCompleteBadge(status, status, [], "", "", "", "", "", null, targetUrl, gameTitle);
    NS.renderSettingsGearStandalone = function renderSettingsGearStandalone() {
        if (document.querySelector(".ign_settings_gear_standalone")) return;
        const targetObj = NS.getTargetInsertionPoint("sidebarBottom");
        if (!targetObj) return;
        const html = `<button type="button" class="ign_open_settings_gear" title="IGN Metadata Injector settings" style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:#a1b0bd;cursor:pointer;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;padding:5px 10px;">⚙ Settings</button>`;
        insertAtTarget(makeCtn("ign_settings_gear_standalone", "display:flex;align-items:center;justify-content:flex-end;padding:6px 2px;grid-column:1/-1;", html), targetObj);
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
    const SETTINGS_PANEL_STYLE = `
        <style>
            #ign_settings_overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            #ign_settings_panel { background: linear-gradient(135deg, rgba(20,20,20,0.98), rgba(35,35,35,0.98)); border-radius: 10px; border-left: 5px solid #ff3e3e; box-shadow: 0 8px 30px rgba(0,0,0,0.6); width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; padding: 20px 22px; color: #ffffff; } #ign_settings_panel h2 { margin: 0 0 4px; font-size: 16px; color: #ff3e3e; text-transform: uppercase; letter-spacing: 0.5px; }
            #ign_settings_panel h3 { margin: 0 0 10px; font-size: 11px; color: #a1b0bd; text-transform: uppercase; letter-spacing: 0.5px; } .ign_settings_sub { font-size: 11px; color: #8f98a0; margin: 0 0 18px; } .ign_settings_columns { display: flex; gap: 22px; flex-wrap: wrap; } .ign_settings_columns > div { flex: 1; min-width: 210px; }
            .ign_settings_toggle_row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 12px; color: #c6d4df; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; } .ign_switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 10px; } .ign_switch input { opacity: 0; width: 0; height: 0; }
            .ign_switch_slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; transition: 0.2s; } .ign_switch_slider::before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; top: 3px; background: #ffffff; border-radius: 50%; transition: 0.2s; } .ign_switch input:checked + .ign_switch_slider { background: #66c0f4; } .ign_switch input:checked + .ign_switch_slider::before { transform: translateX(16px); }
            #ign_order_list { list-style: none; margin: 0; padding: 0; } .ign_order_item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; cursor: grab; } .ign_order_item.ign_drag_over { border: 1px dashed #66c0f4; } .ign_order_handle { color: #8f98a0; font-size: 14px; } .ign_settings_actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; } #ign_settings_save { background: #ff3e3e; color: #ffffff; } #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }
            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; } .ign_settings_columns > div, .ign_locations_row > div { flex: 1; min-width: 200px; } .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 18px; } #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }
            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; } .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; } .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; } .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); } .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 13px; padding: 2px 6px; flex-shrink: 0; } .ign_override_remove:hover { color: #ff3e3e; }
            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; } .ign_override_form { display: flex; flex-direction: column; gap: 6px; } .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; background: rgba(102,192,244,0.15); color: #66c0f4; }
        </style>`;
    function buildSettingsPanelHtml() {
        const toggleRows = Object.keys(NS.CONFIG_KEYS).map(key =>
            `<label class="ign_settings_toggle_row"><span>${NS.escapeHtml(NS.CONFIG_KEYS[key])}</span><span class="ign_switch"><input type="checkbox" data-toggle-key="${key}" ${NS.getConfig(key) ? "checked" : ""}><span class="ign_switch_slider"></span></span></label>`).join("");
        const orderRows = NS.getSectionOrder().map(key =>
            `<li class="ign_order_item" draggable="true" data-key="${key}"><span class="ign_order_handle">⠿</span><span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span></li>`).join("");
        const enableRows = NS.PLATFORMS.map(p =>
            `<label class="ign_settings_toggle_row"><span>Enable on ${p}</span><span class="ign_switch"><input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p) ? "checked" : ""}><span class="ign_switch_slider"></span></span></label>`).join("");
        const shared = NS.getPlacementShared();
        const placementPlatforms = NS.getVisiblePlatforms();
        const platformLabel = p => shared ? "Steam + Epic" : p;
        const positionSelect = platform => {
            const current = NS.getBadgePositionFor(platform);
            const opts = NS.BADGE_POSITION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div><label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platformLabel(platform)}</label><select id="ign_badge_position_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        const locationSelect = (key, label, platform) => {
            const current = NS.getSectionLocationFor(key, platform);
            const opts = NS.LOCATION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div><label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platformLabel(platform)}: ${label}</label><select id="ign_${key}_location_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        const userOverrides = NS.getUserOverrides();
        const overrideKeys = Object.keys(userOverrides);
        const overrideRowsHtml = overrideKeys.length === 0 ? "" : overrideKeys.map(key => {
            const entry = userOverrides[key];
            const pills = [ entry.ignUrl ? `<span class="ign_override_pill">IGN</span>` : "", entry.hltbUrl ? `<span class="ign_override_pill ign_override_pill_hltb">HLTB</span>` : "" ].join("");
            return `<li class="ign_override_item"><span class="ign_override_item_main"><strong title="${NS.escapeHtml(entry.displayTitle || key)}">${NS.escapeHtml(entry.displayTitle || key)}</strong>${pills}</span><button class="ign_override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button></li>`;
        }).join("");
        return `
            ${SETTINGS_PANEL_STYLE}
            <div id="ign_settings_overlay">
                <div id="ign_settings_panel">
                    <h2>IGN Script Settings</h2>
                    <p class="ign_settings_sub">Changes apply immediately on save — no page refresh needed.</p>
                    <div class="ign_settings_columns">
                        <div><h3>Visible Sections</h3>${toggleRows}<h3 style="margin-top:14px;">Enable / Disable Per Site</h3>${enableRows}</div>
                        <div>
                            <h3>Section Order (drag to reorder)</h3>
                            <p class="ign_settings_sub">HowLongToBeat / HLTB Leisure Time order only applies when their Location below is set to "Inline".</p>
                            <ul id="ign_order_list">${orderRows}</ul>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <label class="ign_settings_toggle_row" style="border-bottom:none;">
                            <span>Share the same placement for Steam and Epic</span>
                            <span class="ign_switch"><input type="checkbox" id="ign_placement_shared" ${shared ? "checked" : ""}><span class="ign_switch_slider"></span></span>
                        </label>
                    </div>
                    ${placementPlatforms.length === 0 ? '<p class="ign_settings_sub">Enable at least one site above to configure placement.</p>' : `
                    <div style="margin-top:10px;"><h3>Overlay Position</h3><div class="ign_locations_row">${placementPlatforms.map(positionSelect).join("")}</div></div>
                    <div class="ign_locations_row">${placementPlatforms.map(p => locationSelect("hltb", "HowLongToBeat Location", p)).join("")}</div>
                    <div class="ign_locations_row">${placementPlatforms.map(p => locationSelect("leisure", "HLTB Leisure Time Location", p)).join("")}</div>`}
                    <div style="margin-top:18px;">
                        <h3>Per-Title Overrides</h3>
                        <p class="ign_settings_sub" style="margin-bottom:8px;">For games that won't auto-resolve: force an exact IGN page and/or an exact HowLongToBeat page for one title. Matched by exact title (case-insensitive). Added/removed immediately — no need to hit Save below.</p>
                        ${overrideKeys.length === 0 ? '<p class="ign_override_empty">No overrides added yet.</p>' : `<ul id="ign_override_list">${overrideRowsHtml}</ul>`}
                        <div class="ign_override_form">
                            <input type="text" id="ign_override_title" placeholder="Game title, exactly as shown on the store page">
                            <input type="text" id="ign_override_ign_url" placeholder="IGN URL (optional) — e.g. https://www.ign.com/games/some-slug">
                            <input type="text" id="ign_override_hltb_url" placeholder="HowLongToBeat URL (optional) — e.g. https://howlongtobeat.com/game/1234">
                            <button id="ign_override_add">Add / Update</button>
                        </div>
                    </div>
                    <div class="ign_settings_actions"><button id="ign_settings_cancel">Cancel</button><button id="ign_settings_save">Save</button></div>
                </div>
            </div>`;
    }
    function refreshBadgeNow() {
        NS.state.lastProcessedTitle = "";
        document.querySelector(".ign_rating_row")?.remove();
        NS.init();
    }
    NS.openSettingsPanel = function openSettingsPanel() {
        document.getElementById("ign_settings_overlay")?.remove();
        document.body.insertAdjacentHTML("beforeend", buildSettingsPanelHtml());
        const overlay = document.getElementById("ign_settings_overlay");
        const list = document.getElementById("ign_order_list");
        let draggedItem = null;
        list.querySelectorAll(".ign_order_item").forEach(item => {
            item.addEventListener("dragstart", () => { draggedItem = item; item.style.opacity = "0.4"; });
            item.addEventListener("dragend", () => { item.style.opacity = "1"; item.classList.remove("ign_drag_over"); });
            item.addEventListener("dragover", e => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const bounds = item.getBoundingClientRect();
                const isAfter = e.clientY - bounds.top > bounds.height / 2;
                item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
            });
        });
        overlay.querySelectorAll(".ign_override_remove").forEach(btn => btn.addEventListener("click", () => { NS.removeUserOverride(btn.dataset.key); refreshBadgeNow(); NS.openSettingsPanel(); }));
        overlay.querySelector("#ign_override_add").addEventListener("click", () => {
            const title = overlay.querySelector("#ign_override_title").value.trim();
            const ignUrl = overlay.querySelector("#ign_override_ign_url").value.trim();
            const hltbUrl = overlay.querySelector("#ign_override_hltb_url").value.trim();
            if (!title || !ignUrl && !hltbUrl) return;
            NS.setUserOverride(title, ignUrl, hltbUrl);
            refreshBadgeNow();
            NS.openSettingsPanel();
        });
        overlay.querySelector("#ign_placement_shared").addEventListener("change", e => { NS.setPlacementShared(e.target.checked); NS.openSettingsPanel(); });
        overlay.querySelectorAll("input[data-site-enable]").forEach(input => input.addEventListener("change", () => { NS.setSiteEnabled(input.dataset.siteEnable, input.checked); refreshBadgeNow(); NS.openSettingsPanel(); }));
        overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector("#ign_settings_cancel").addEventListener("click", () => overlay.remove());
        overlay.querySelector("#ign_settings_save").addEventListener("click", () => {
            overlay.querySelectorAll("input[data-toggle-key]").forEach(input => NS.storage.set(input.dataset.toggleKey, input.checked));
            NS.setSectionOrder(Array.from(list.querySelectorAll(".ign_order_item")).map(li => li.dataset.key));
            const shared = NS.getPlacementShared();
            NS.getVisiblePlatforms().forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [ platform ];
                const posSel = overlay.querySelector(`#ign_badge_position_${platform}`);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                ["hltb", "leisure"].forEach(key => {
                    const sel = overlay.querySelector(`#ign_${key}_location_${platform}`);
                    if (sel) targets.forEach(p => NS.setSectionLocationFor(key, p, sel.value));
                });
            });
            overlay.remove();
            NS.registerMenuCommands();
            refreshBadgeNow();
        });
    };
    NS.openSettings = function openSettings() {
        if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.openOptionsPage === "function") chrome.runtime.openOptionsPage();
        else NS.openSettingsPanel();
    };
    document.addEventListener("click", e => { const gear = e.target.closest ? e.target.closest(".ign_open_settings_gear") : null; if (gear) NS.openSettings(); });
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function (NS) {
    "use strict";
    const IGN_SEARCH_PERSISTED_HASH = "e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884";
    function extractGameResultsFromGraphQL(json) {
        const results = [], seen = new Set();
        function addCandidate(slug, text) {
            if (!slug) return;
            const cleanSlug = String(slug).replace(/^\/+|\/+$/g, "").replace(/^games\//, "").toLowerCase();
            if (!cleanSlug || seen.has(cleanSlug)) return;
            seen.add(cleanSlug);
            results.push({ slug: cleanSlug, text: text || cleanSlug.replace(/-/g, " ") });
        }
        function walk(node) {
            if (results.length > 30 || !node || typeof node !== "object") return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            const name = typeof node.name === "string" ? node.name : typeof node.title === "string" ? node.title : "";
            if (typeof node.slug === "string" && node.slug) addCandidate(node.slug, name);
            if (typeof node.url === "string" && /\/games\//i.test(node.url)) {
                const match = node.url.match(/\/games\/([a-z0-9-]+)/i);
                if (match) addCandidate(match[1], name);
            }
            Object.values(node).forEach(walk);
        }
        walk(json);
        return results;
    }
    function pickBestSearchResult(results, searchTerm) {
        if (!results.length) return null;
        const titleWords = new Set(searchTerm.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 2));
        let best = null, bestScore = -Infinity;
        results.forEach((r, index) => {
            const words = new Set(r.text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/));
            let overlap = 0;
            titleWords.forEach(w => { if (words.has(w)) overlap++; });
            const score = overlap - index * 0.01;
            if (score > bestScore) { bestScore = score; best = r; }
        });
        return best;
    }
    NS.fetchIgnSearch = function fetchIgnSearch(term, callback) {
        const variables = JSON.stringify({ term: term, count: 20, objectType: "Game" });
        const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: IGN_SEARCH_PERSISTED_HASH } });
        const url = `https://mollusk.apis.ign.com/graphql?operationName=SearchObjectsByName&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return callback(null);
                try {
                    const results = extractGameResultsFromGraphQL(JSON.parse(response.responseText));
                    const best = pickBestSearchResult(results, term);
                    callback(best ? { slug: best.slug, url: `https://www.ign.com/games/${best.slug}` } : null);
                } catch (e) { callback(null); }
            },
            onerror: function () { callback(null); }
        });
    };
    NS.parseIgnPage = function parseIgnPage(doc) {
        let fetchedGameTitle = "";
        const h1TitleEl = doc.querySelector('h1[data-cy="object-header-display-title"]') || doc.querySelector("h1.display-title");
        if (h1TitleEl && h1TitleEl.textContent.trim()) fetchedGameTitle = h1TitleEl.textContent.trim();
        let ignScore = "N/A";
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
            try { const data = JSON.parse(script.textContent); if (data.reviewRating?.ratingValue) ignScore = String(data.reviewRating.ratingValue); } catch (e) {}
        });
        if (ignScore === "N/A") {
            const el = doc.querySelector('[data-cy="review-score-hexagon-content-wrapper"] figcaption');
            if (el) ignScore = el.textContent.trim();
        }
        let userScore = "N/A";
        const userReviewsLink = doc.querySelector('a[href*="/user-reviews"]');
        const ratingEl = userReviewsLink && userReviewsLink.querySelector('[data-cy="score-rating-small"]');
        if (ratingEl) userScore = ratingEl.textContent.trim();
        if (userScore === "N/A") {
            const smallScoreEls = doc.querySelectorAll('[data-cy="score-rating-small"]');
            if (smallScoreEls.length > 0) userScore = smallScoreEls[smallScoreEls.length - 1].textContent.trim();
        }
        let developerName = "";
        const devEl = doc.querySelector('[data-cy="developerLink"]') || doc.querySelector('a[href*="/games/developer/"]') ||
            doc.querySelector('[data-cy="producerLink"]') || doc.querySelector('a[href*="/games/producer/"]');
        if (devEl && devEl.textContent.trim()) developerName = devEl.textContent.trim();
        let esrbImgSrc = "", esrbAlt = "", esrbDescriptors = "";
        const esrbImgEl = doc.querySelector('img[data-cy^="icon-esrb"]') || doc.querySelector('img[alt*="ESRB:"]');
        if (esrbImgEl) { esrbImgSrc = esrbImgEl.getAttribute("src"); esrbAlt = esrbImgEl.getAttribute("alt") || "ESRB Rating"; }
        if (esrbAlt && esrbAlt.includes(":")) {
            const [firstPart, ...rest] = esrbAlt.split(":");
            const label = firstPart.trim(), remainder = rest.join(":").trim();
            if (/^esrb$/i.test(label)) esrbAlt = remainder;
            else { esrbAlt = label; esrbDescriptors = remainder; }
        }
        esrbAlt = NS.normalizeEsrbLabel(esrbAlt);
        if (!esrbDescriptors) {
            const descContainer = doc.querySelector('[data-cy*="esrb-descriptors"]') || doc.querySelector(".esrb-descriptors");
            if (descContainer) esrbDescriptors = descContainer.textContent.trim();
        }
        let awardData = null;
        const awardEl = doc.querySelector('figure[data-cy="review-score"].icon-award') || doc.querySelector('[class*="icon-award"]');
        if (awardEl) {
            const rankText = awardEl.querySelector("figcaption")?.textContent.trim() || "";
            const labelType = awardEl.className.includes("icon-award-gold") ? "Gold Rank" : awardEl.className.includes("icon-award-silver") ? "Silver Rank" : awardEl.className.includes("icon-award-bronze") ? "Bronze Rank" : "Global Rank";
            if (rankText) awardData = { rank: rankText, label: labelType };
        }
        const hltbData = [];
        let hltbUrl = "";
        const hltbContent = doc.querySelector('[data-cy="hl2b-content"]') || doc.querySelector(".hl2b-content");
        if (hltbContent) {
            hltbContent.querySelectorAll('.meta-item, [data-cy$="meta-item"]').forEach(item => {
                const timeEl = item.querySelector('.title4, [data-cy="title4"]'), captionEl = item.querySelector('.caption, [data-cy="caption"]');
                if (timeEl && captionEl) hltbData.push({ time: timeEl.textContent.trim(), label: captionEl.textContent.trim() });
            });
            const hltbLinkEl = hltbContent.closest('a[href*="howlongtobeat.com"]') || hltbContent.querySelector('a[href*="howlongtobeat.com"]');
            if (hltbLinkEl) hltbUrl = hltbLinkEl.getAttribute("href");
        }
        if (!hltbUrl) { const anyHltbLink = doc.querySelector('a[href*="howlongtobeat.com"]'); if (anyHltbLink) hltbUrl = anyHltbLink.getAttribute("href"); }
        return { fetchedGameTitle, ignScore, userScore, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, hltbData, hltbUrl };
    };
    NS.resolveFirstWorkingUrl = function resolveFirstWorkingUrl(candidateUrls, callback) {
        function tryNext(index) {
            if (index >= candidateUrls.length) return callback(null);
            const url = candidateUrls[index];
            NS.http.get(url, {
                onload: function (response) {
                    if (response.status !== 200) return tryNext(index + 1);
                    let parsed = null;
                    try { parsed = NS.parseIgnPage(new DOMParser().parseFromString(response.responseText, "text/html")); } catch (e) { parsed = null; }
                    callback({ url, parsed });
                },
                onerror: function () { tryNext(index + 1); }
            });
        }
        tryNext(0);
    };
    NS.gameEntryFromResult = function gameEntryFromResult(result, fallbackName) {
        const p = result.parsed;
        return { name: (p && p.fetchedGameTitle) || fallbackName, url: result.url, ignScore: p ? p.ignScore : "N/A", userScore: p ? p.userScore : "N/A", parsed: p };
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function (NS) {
    "use strict";
    NS.HLTB_SOURCE_OVERRIDES = { "final fantasy vii remake intergrade": "https://www.ign.com/games/final-fantasy-vii-remake" };
    NS.HLTB_DIRECT_URL_OVERRIDES = {
        "ninja gaiden 3: razor's edge": "https://howlongtobeat.com/game/6623",
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": "https://howlongtobeat.com/game/6623",
        "kingdom hearts -hd 1.5+2.5 remix-": "https://howlongtobeat.com/game/42802"
    };
    NS.fetchHltbOverride = function fetchHltbOverride(url, callback) {
        const empty = () => callback({ hltbData: [], hltbUrl: "" });
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return empty();
                try {
                    const p = NS.parseIgnPage(new DOMParser().parseFromString(response.responseText, "text/html"));
                    callback({ hltbData: p.hltbData, hltbUrl: p.hltbUrl });
                } catch (e) { empty(); }
            },
            onerror: empty
        });
    };
    function parseHltbTableColumn(doc, columnName) {
        const table = doc.querySelector('table[class*="GameTimeTable"]');
        if (!table) return [];
        const headerCells = Array.from(table.querySelectorAll("thead td, thead th")).map(td => td.textContent.trim().toLowerCase());
        const colIndex = headerCells.indexOf(columnName.toLowerCase());
        if (colIndex === -1) return [];
        const results = [];
        table.querySelectorAll("tbody tr").forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length <= colIndex) return;
            const label = cells[0].textContent.trim();
            if (!label || /all\s*playstyles/i.test(label)) return;
            const time = cells[colIndex].textContent.trim();
            if (time) results.push({ label, time });
        });
        return results;
    }
    NS.fetchHltbDirect = function fetchHltbDirect(url, callback) {
        const empty = () => callback({ hltbData: [], hltbUrl: url });
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return empty();
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, "text/html");
                    callback({ hltbData: parseHltbTableColumn(doc, "average"), hltbUrl: url });
                } catch (e) { empty(); }
            },
            onerror: empty
        });
    };
    NS.fetchHltbLeisure = function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) return callback([]);
        NS.http.get(hltbUrl, {
            onload: function (response) {
                if (response.status !== 200) return callback([]);
                try { callback(parseHltbTableColumn(new DOMParser().parseFromString(response.responseText, "text/html"), "leisure")); } catch (e) { callback([]); }
            },
            onerror: () => callback([])
        });
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function (NS) {
    "use strict";
    function attachLeisureSection(resolvedHltbUrl) {
        if (!resolvedHltbUrl || !NS.getConfig("showLeisure")) return;
        NS.fetchHltbLeisure(resolvedHltbUrl, leisureData => {
            const html = NS.buildLeisureRow(leisureData, resolvedHltbUrl), loc = NS.getSectionLocation("leisure");
            if (loc === "inline") NS.fillLeisurePlaceholder(html);
            else NS.renderStandalone("ign_leisure_standalone", html, loc);
        });
    }
    function fetchBundleData(bundle, gameTitle) {
        const results = [];
        function fetchNext(index) {
            if (index >= bundle.length) { attachLeisureSection(NS.renderMultiGameBadge(results, gameTitle)); NS.state.isFetching = false; return; }
            const entry = bundle[index], url = `https://www.ign.com/games/${entry.slug}`;
            const push = parsed => { results.push({ name: entry.name, url, ignScore: parsed ? parsed.ignScore : "N/A", userScore: parsed ? parsed.userScore : "N/A", parsed }); fetchNext(index + 1); };
            NS.http.get(url, {
                onload: function (response) {
                    let parsed = null;
                    if (response.status === 200) { try { parsed = NS.parseIgnPage(new DOMParser().parseFromString(response.responseText, "text/html")); } catch (e) { parsed = null; } }
                    push(parsed);
                },
                onerror: () => push(null)
            });
        }
        fetchNext(0);
    }
    function tryDualGameSplit(gameTitle, callback) {
        const plusIndex = gameTitle.indexOf("+");
        if (plusIndex === -1) return callback(false);
        const leftPart = gameTitle.slice(0, plusIndex).trim();
        const rightPart = gameTitle.slice(plusIndex + 1).replace(/\(\s*dlc\s*\)/gi, "").trim();
        if (!leftPart || !rightPart) return callback(false);
        const mergedTitle = `${leftPart} ${rightPart}`.replace(/\s+/g, " ").trim();
        const leftUrls = NS.buildCandidateSlugs(leftPart).map(slug => `https://www.ign.com/games/${slug}`);
        const mergedUrls = NS.buildCandidateSlugs(mergedTitle).map(slug => `https://www.ign.com/games/${slug}`);
        let leftResult, mergedResult, leftDone = false, mergedDone = false;
        function maybeFinish() {
            if (!leftDone || !mergedDone) return;
            if (leftResult && mergedResult && leftResult.url !== mergedResult.url) {
                const games = [NS.gameEntryFromResult(leftResult, leftPart), NS.gameEntryFromResult(mergedResult, mergedTitle)];
                attachLeisureSection(NS.renderMultiGameBadge(games, gameTitle));
                NS.state.isFetching = false;
                callback(true);
            } else callback(false);
        }
        NS.resolveFirstWorkingUrl(leftUrls, r => { leftResult = r; leftDone = true; maybeFinish(); });
        NS.resolveFirstWorkingUrl(mergedUrls, r => { mergedResult = r; mergedDone = true; maybeFinish(); });
    }
    function resolveGameByTitle(title, callback) {
        const urlsToTry = NS.buildCandidateSlugs(title).map(slug => `https://www.ign.com/games/${slug}`);
        NS.resolveFirstWorkingUrl(urlsToTry, result => {
            if (result) return callback(result);
            NS.fetchIgnSearch(title, searchHit => {
                if (!searchHit) return callback(null);
                NS.resolveFirstWorkingUrl([searchHit.url], searchResult => callback(searchResult));
            });
        });
    }
    function fetchPackageItems(names, originalTitle, dedicatedEntry) {
        const results = new Array(names.length).fill(null);
        let remaining = names.length;
        if (names.length === 0) {
            if (dedicatedEntry) attachLeisureSection(NS.renderMultiGameBadge([dedicatedEntry], originalTitle)); else NS.renderEmpty("N/A", "https://www.ign.com", originalTitle);
            NS.state.isFetching = false;
            return;
        }
        names.forEach((name, index) => {
            resolveGameByTitle(name, result => {
                results[index] = result ? NS.gameEntryFromResult(result, name) : null;
                if (--remaining !== 0) return;
                const found = results.filter(Boolean);
                const deduped = dedicatedEntry ? found.filter(g => g.url !== dedicatedEntry.url) : found;
                const combined = dedicatedEntry ? [dedicatedEntry, ...deduped] : deduped;
                if (combined.length === 0) NS.renderEmpty("N/A", "https://www.ign.com", originalTitle);
                else attachLeisureSection(NS.renderMultiGameBadge(combined, originalTitle));
                NS.state.isFetching = false;
            });
        });
    }
    function renderResolvedGame(result, gameTitle, fallbackUrl) {
        const { url: targetUrl, parsed: p } = result;
        if (!p) { NS.renderEmpty("N/A", targetUrl || fallbackUrl, gameTitle); NS.state.isFetching = false; return; }
        const packageNames = NS.extractPackageItemNames();
        if (packageNames.length >= 2) {
            const dedicatedEntry = NS.gameEntryFromResult(result, p.fetchedGameTitle || gameTitle);
            dedicatedEntry.isDedicated = true;
            return fetchPackageItems(packageNames, gameTitle, dedicatedEntry);
        }
        const finishRender = (hltbData, hltbUrl) => {
            const resolvedHltbUrl = NS.renderCompleteBadge(p.ignScore, p.userScore, hltbData, hltbUrl, p.developerName, p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors, p.awardData, targetUrl, p.fetchedGameTitle);
            NS.state.isFetching = false;
            attachLeisureSection(resolvedHltbUrl);
        };
        const lookupKey = gameTitle.toLowerCase().trim();
        const userOverride = NS.getUserOverrideForTitle(gameTitle);
        const directHltbUrl = (userOverride && userOverride.hltbUrl) || NS.HLTB_DIRECT_URL_OVERRIDES[lookupKey];
        const overrideUrl = NS.HLTB_SOURCE_OVERRIDES[lookupKey];
        if (directHltbUrl) NS.fetchHltbDirect(directHltbUrl, r => finishRender(r.hltbData, r.hltbUrl));
        else if (overrideUrl) NS.fetchHltbOverride(overrideUrl, r => finishRender(r.hltbData, r.hltbUrl));
        else finishRender(p.hltbData, p.hltbUrl);
    }
    function fetchSingleGame(gameTitle, isFallback, onExhausted) {
        const urlsToTry = NS.buildCandidateSlugs(gameTitle).map(slug => `https://www.ign.com/games/${slug}`);
        const userOverride = NS.getUserOverrideForTitle(gameTitle);
        if (userOverride && userOverride.ignUrl) urlsToTry.unshift(userOverride.ignUrl);
        function finalFallback() {
            if (/collection/i.test(gameTitle)) {
                const packageNames = NS.extractPackageItemNames();
                if (packageNames.length >= 2) return fetchPackageItems(packageNames, gameTitle, null);
            }
            if (onExhausted) return onExhausted();
            NS.renderEmpty("N/A", urlsToTry[0] || "https://www.ign.com", gameTitle);
            NS.state.isFetching = false;
        }
        NS.resolveFirstWorkingUrl(urlsToTry, result => {
            if (result) return renderResolvedGame(result, gameTitle, urlsToTry[0]);
            if (!isFallback) {
                const baseGameName = NS.extractDlcBaseGameName();
                if (baseGameName && baseGameName.toLowerCase().trim() !== gameTitle.toLowerCase().trim()) return NS.fetchIGNData(baseGameName, { isFallback: true, onExhausted });
            }
            NS.fetchIgnSearch(gameTitle, searchHit => {
                if (!searchHit) return finalFallback();
                NS.resolveFirstWorkingUrl([searchHit.url], searchResult => { if (searchResult) return renderResolvedGame(searchResult, gameTitle, urlsToTry[0]); finalFallback(); });
            });
        });
    }
    NS.fetchIGNData = function fetchIGNData(gameTitle, options = {}) {
        NS.state.isFetching = true;
        const isFallback = !!options.isFallback;
        const bundle = NS.BUNDLE_TITLE_OVERRIDES[gameTitle.toLowerCase().trim()];
        if (bundle) return fetchBundleData(bundle, gameTitle);
        if (!isFallback && gameTitle.includes("+")) return tryDualGameSplit(gameTitle, handled => { if (!handled) fetchSingleGame(gameTitle, isFallback, options.onExhausted); });
        fetchSingleGame(gameTitle, isFallback, options.onExhausted);
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});

(function(NS) {
    "use strict";
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
        NS.renderSettingsGearStandalone();
        if (!NS.isEnabledForCurrentSite()) return;
        if (title !== NS.state.lastProcessedTitle) {
            NS.state.lastProcessedTitle = title;
            document.querySelector(".ign_rating_row")?.remove();
        }
        if (document.querySelector(".ign_rating_row") || NS.state.isFetching) return;
        const titleAttempts = [];
        const strippedTitle = NS.stripCollectionBracket(title);
        if (strippedTitle) titleAttempts.push(strippedTitle);
        titleAttempts.push(title);
        const sigmaFallback = NS.sigmaLetterFallbackTitle(strippedTitle || title);
        if (sigmaFallback) titleAttempts.push(sigmaFallback);
        fetchWithTitleChain(titleAttempts);
    };
    NS.storage.ready.then(() => {
        NS.registerMenuCommands();
        if (typeof GM_registerMenuCommand !== "undefined") GM_registerMenuCommand("⚙️ Open Settings Panel", NS.openSettings);
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", NS.init);
        else NS.init();
        const observer = new MutationObserver(mutations => {
            const isOwnElement = node => node.nodeType === 1 && node.className && String(node.className).startsWith("ign_") || node.id && String(node.id).startsWith("ign_");
            const relevant = mutations.some(m => Array.from(m.addedNodes).some(n => !isOwnElement(n)) || Array.from(m.removedNodes).some(n => !isOwnElement(n)));
            if (!relevant) return;
            clearTimeout(NS.state.debounceTimer);
            NS.state.debounceTimer = setTimeout(NS.init, 250);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
