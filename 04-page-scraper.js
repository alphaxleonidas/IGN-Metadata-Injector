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
