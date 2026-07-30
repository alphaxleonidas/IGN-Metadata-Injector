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
