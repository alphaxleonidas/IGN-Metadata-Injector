(function (NS) {
    "use strict";
    const cleanSteamTitle = raw => raw.replace(/^Save \d+% on /i, "").replace(/^Pre-purchase /i, "").replace(/ on Steam$/i, "").trim();
    // Demo listings are separate store pages from the full game (e.g. "Ratchet & Clank: Rift Apart
    // Demo") but should still resolve to the full game's IGN/HLTB data, so "Demo" is stripped from
    // whatever title gets used for matching/display.
    const stripDemoSuffix = title => title.replace(/[\s:-]*\bdemo\b\s*$/i, "").trim();
    // Epic's storefront is a single-domain SPA - the homepage, /browse listing,
    // /news, /wishlist, /library, /achievements, etc. all share the same
    // origin as an actual game page and can still contain some <h1> (e.g. a
    // hero banner or section heading), which would otherwise get misread as a
    // game title. Real product/DLC pages and bundle pages are the only ones
    // that live under a /p/<slug> or /bundles/<slug> path (locale prefix
    // optional, e.g. /en-US/p/hades) - everything else is treated as "not a
    // game page" regardless of what's in the DOM.
    function isEpicProductPage() {
        return /\/(p|bundles)\/[^/?#]+/i.test(window.location.pathname);
    }
    NS.getGameTitle = function getGameTitle() {
        let title = null;
        if (NS.IS_STEAM) {
            const titleEl = document.getElementById("appHubAppName") || document.querySelector(".page_title_area .apphub_AppName") || document.querySelector(".app_header_content .app_name");
            if (titleEl && titleEl.textContent.trim()) title = titleEl.textContent.trim();
            if (!title) {
                const ogTitle = document.querySelector('meta[property="og:title"]');
                if (ogTitle && ogTitle.content) { const t = cleanSteamTitle(ogTitle.content.trim()); if (t) title = t; }
            }
            if (!title && document.title) { const t = cleanSteamTitle(document.title); if (t && t !== "Steam") title = t; }
        }
        if (!title && NS.IS_EPIC && isEpicProductPage()) {
            const h1El = document.querySelector("h1") || document.querySelector('[data-testid="pdp-title"]');
            if (h1El) title = h1El.textContent.trim();
        }
        return title ? stripDemoSuffix(title) : null;
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
    // Epic's product page, as of the current markup (verified against a saved copy of a real page):
    //   <main> > <header><h1>title</h1>...</header>, tab nav, and a two-column row:
    //     [main column: media carousel, short description, tag rows, long description ([data-testid="ldesc"])]
    //     [sidebar wrapper > <section>: logo, ratings, price + buy buttons, metadata rows (with a <time>)]
    //   then full-width <section>s below (editions, DLC, reviews, "System Requirements", ...).
    // There is no <aside>, and none of the old data-testids (purchase-cta-button, pdp-title,
    // metadata-developer-single, about-*) exist any more. Class names are hashed CSS-module names that
    // change between deploys, so nothing here selects by class: anchors are found through tags
    // (h1/header/section/time/button), the one stable test id (ldesc), and structure (siblings/parents).
    // Every field is null when its anchor can't be found, and the caller then warns (see below).
    function findEpicLayout() {
        const main = document.querySelector("main") || document.body;
        const h1 = main.querySelector("h1") || document.querySelector("h1");
        const header = h1 ? (h1.closest("header") || h1) : null;
        const ldesc = main.querySelector('[data-testid="ldesc"]');
        const timeEl = main.querySelector("time[datetime]");
        let sidebarSection = timeEl ? timeEl.closest("section") : null;
        let sidebarWrapper = sidebarSection ? sidebarSection.parentElement : null;
        let mainColumn = sidebarWrapper ? sidebarWrapper.previousElementSibling : null;
        if (!mainColumn && ldesc) {
            // Fallback: climb from the long description to the column whose next sibling holds the sidebar.
            for (let node = ldesc; node && node.parentElement && node.parentElement !== main; node = node.parentElement) {
                const sib = node.nextElementSibling;
                if (sib && sib.querySelector("section")) { mainColumn = node; sidebarWrapper = sib; sidebarSection = sib.querySelector("section"); break; }
            }
        }
        // The release-date row's container: climb from <time> to the first ancestor whose parent has
        // several children (that ancestor is one metadata row; its parent is the list of rows).
        let metaContainer = null;
        if (timeEl && sidebarSection && sidebarSection.contains(timeEl)) {
            let row = timeEl;
            while (row.parentElement && row.parentElement !== sidebarSection && row.parentElement.children.length < 3) row = row.parentElement;
            const container = row.parentElement;
            if (container && container !== sidebarSection && sidebarSection.contains(container)) metaContainer = container;
        }
        // The price + buy-button block: the sidebar row that contains the first button in the sidebar.
        const firstSidebarButton = sidebarSection ? sidebarSection.querySelector("button") : null;
        return {
            main, header, sidebarSection, sidebarWrapper, mainColumn, metaContainer,
            carousel: mainColumn ? mainColumn.firstElementChild : null,
            descRoot: mainColumn && ldesc ? rowUnder(mainColumn, ldesc) : null,
            purchasePanel: sidebarSection && firstSidebarButton ? rowUnder(sidebarSection, firstSidebarButton) : null
        };
    }
    // Epic: anchor immediately after the whole "System Requirements" section (shared by the explicit
    // "Bottom of Left Sidebar" position and the settings gear on mobile). The heading text is
    // localized, so when it can't be matched the last full-width <section> outside the sidebar is
    // used instead (System Requirements is the last one on the page).
    function findEpicBelowSystemRequirements(layout) {
        const heading = Array.from(document.querySelectorAll("h2, h3")).find(h => /system requirements/i.test(h.textContent || ""));
        let section = heading ? heading.closest("section") : null;
        if (!section && layout.main) {
            const lowers = Array.from(layout.main.querySelectorAll("section")).filter(sec => !(layout.sidebarSection && layout.sidebarSection.contains(sec)) && !sec.parentElement.closest("section"));
            section = lowers.length ? lowers[lowers.length - 1] : null;
        }
        return section && section.parentElement ? { element: section, position: "after" } : null;
    }
    // Epic's markup changes without notice. When a Location's anchor can't be found the code falls back
    // to the top of <main> (above the game title) no matter what the setting says - so that case is
    // reported once per Location, with a dump of what the page actually contains, instead of failing
    // silently.
    const epicAnchorWarned = {};
    function warnEpicAnchorMissing(pref, layout) {
        if (epicAnchorWarned[pref]) return;
        epicAnchorWarned[pref] = true;
        const probes = ["main", "main h1", "main header", "time[datetime]", '[data-testid="ldesc"]', "section", "aside", '[role="tablist"]'];
        const found = {};
        probes.forEach(sel => { found[sel] = document.querySelectorAll(sel).length; });
        const resolved = {};
        Object.keys(layout || {}).forEach(k => { resolved[k] = !!layout[k]; });
        const testIds = Array.from(new Set(Array.from(document.querySelectorAll("[data-testid]")).map(e => e.getAttribute("data-testid")))).slice(0, 80);
        const headings = Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, 25)
            .map(h => h.tagName + ": " + (h.textContent || "").trim().slice(0, 40) + (h.getAttribute("data-testid") ? " [" + h.getAttribute("data-testid") + "]" : ""));
        console.warn('[IGN Metadata Injector] Epic: no anchor found for Location "' + pref + '" - falling back to the top of the page.', { anchorsFound: found, layoutResolved: resolved, testIds, headings });
    }
    NS.getTargetInsertionPoint = function getTargetInsertionPoint(explicitPosition) {
        const pref = explicitPosition || NS.getBadgePosition();
        if (NS.IS_STEAM) {
            if (pref === "aboveTitle") { const titleArea = document.querySelector(".page_title_area.game_title_area") || document.querySelector(".page_title_area"); if (titleArea) return { element: NS.findSafeBeforeTarget(titleArea), position: "before" }; }
            if (pref === "sidebarBottom" || pref === "belowRightSidebarMetadata" || pref === "aboveRightSidebarMetadata") { const sidebar = document.querySelector(".rightcol.game_meta_data") || document.querySelector(".game_meta_data"); if (sidebar) return { element: sidebar, position: pref === "aboveRightSidebarMetadata" ? "prepend" : "append" }; }
            if (pref === "abovePrice") { const purchaseArea = document.querySelector("#game_area_purchase"); if (purchaseArea) return { element: purchaseArea, position: "before" }; }
            if (pref === "belowGameMedia") {
                const media = document.querySelector(".highlight_ctn");
                // Align width/position to .highlight_overflow (the actual clipped carousel bounds)
                // rather than .highlight_ctn itself — the outer wrapper's own measured rect runs
                // wider than the visible media, which was stretching the badge too far right.
                if (media) return { element: media, position: "after", alignTo: media.querySelector(".highlight_overflow") || media };
            }
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
            const layout = findEpicLayout();
            if (pref === "aboveTitle" && layout.header) return { element: layout.header, position: "before" };
            if (pref === "belowGameMedia" && layout.carousel) return { element: layout.carousel, position: "after" };
            // Epic's "Above Game Description" = between the tag rows and the long description.
            if (pref === "abovePrice" && layout.descRoot) return { element: layout.descRoot, position: "before" };
            if (pref === "aboveRightSidebarMetadata" && layout.metaContainer) return { element: layout.metaContainer, position: "before" };
            if (pref === "belowRightSidebarMetadata" && layout.metaContainer) return { element: layout.metaContainer, position: "after" };
            // The sidebar column is sticky-positioned, so content appended inside it only becomes visible
            // once it un-sticks, by when the page has scrolled past. Escaping to normal flow after the whole
            // row avoids that; alignTo re-aligns it visually under the sidebar's column afterward.
            if (pref === "sidebarBottom" && layout.sidebarWrapper) return { element: NS.findSafeAfterTarget(layout.sidebarWrapper), position: "after", alignTo: layout.sidebarWrapper };
            if (pref === "belowLeftSidebar") { const anchor = findEpicBelowSystemRequirements(layout); if (anchor) return anchor; }
            // "Default" = top of the right-hand sidebar column (the old <aside> prepend, on today's markup).
            if (pref === "default" && layout.sidebarWrapper) return { element: layout.sidebarWrapper, position: "prepend" };
            warnEpicAnchorMissing(pref, layout);
            if (layout.main) return { element: layout.main, position: "prepend" };
        }
        return null;
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
