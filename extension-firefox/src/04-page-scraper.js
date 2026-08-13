(function (NS) {
    "use strict";
    const cleanSteamTitle = raw => raw.replace(/^Save \d+% on /i, "").replace(/^Pre-purchase /i, "").replace(/ on Steam$/i, "").trim();
    // Demo listings are separate store pages from the full game (e.g. "Ratchet & Clank: Rift Apart
    // Demo") but should still resolve to the full game's IGN/HLTB data, so "Demo" is stripped from
    // whatever title gets used for matching/display.
    const stripDemoSuffix = title => title.replace(/[\s:-]*\bdemo\b\s*$/i, "").trim();
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
        if (!title && NS.IS_EPIC) {
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
