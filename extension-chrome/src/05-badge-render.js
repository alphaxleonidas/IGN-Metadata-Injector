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
        const desc = esrbDescriptors ? `<span style="color:#d0d0d0;font-size:10px;line-height:1.3;margin-top:2px;">${NS.escapeHtml(esrbDescriptors)}</span>` : "";
        const displayAlt = NS.normalizeEsrbLabel(esrbAlt);
        return `<div style="${sectionRow("display:flex;align-items:flex-start;gap:12px;")}">${img}<div style="display:flex;flex-direction:column;justify-content:flex-start;gap:2px;flex:1;"><span style="color:#ffffff;font-size:15px;font-weight:bold;line-height:1.2;">${NS.escapeHtml(displayAlt)}</span>${desc}</div>${gearButtonHtml("margin-left:auto;")}</div>`;
    }
    function buildDevRow(developerName) {
        if (!NS.getConfig("showDeveloper") || !developerName) return "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Developer:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(developerName)}">${NS.escapeHtml(developerName)}</span></div>`;
    }
    function buildPublisherRow(publisherName) {
        if (!NS.getConfig("showPublisher") || !publisherName) return "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Publisher:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;" title="${NS.escapeHtml(publisherName)}">${NS.escapeHtml(publisherName)}</span></div>`;
    }
    function buildGenresRow(genres) {
        if (!NS.getConfig("showGenres") || !genres || genres.length === 0) return "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Genres:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-align:right;">${NS.escapeHtml(genres.join(", "))}</span></div>`;
    }
    function buildFeaturesRow(features) {
        if (!NS.getConfig("showFeatures") || !features || features.length === 0) return "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Features:</span><span style="color:#c6d4df;font-weight:bold;font-size:12px;text-align:right;">${NS.escapeHtml(features.join(", "))}</span></div>`;
    }
    function buildPlatformsRow(platforms) {
        if (!NS.getConfig("showPlatforms") || !platforms || platforms.length === 0) return "";
        const chips = platforms.map(p => p.iconSrc
            ? `<span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;background:rgba(255,255,255,0.08);border-radius:5px;flex-shrink:0;" title="${NS.escapeHtml(p.name)}"><img src="${p.iconSrc}" alt="${NS.escapeHtml(p.name)}" style="height:14px;width:14px;" /></span>`
            : `<span style="font-size:10px;font-weight:bold;color:#c6d4df;background:rgba(255,255,255,0.08);border-radius:5px;padding:4px 6px;">${NS.escapeHtml(p.name)}</span>`
        ).join("");
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Platforms:</span><span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;justify-content:flex-end;">${chips}</span></div>`;
    }
    function buildDescriptionRow(description) {
        if (!NS.getConfig("showDescription") || !description) return "";
        return `<div style="${sectionRow("display:flex;flex-direction:column;gap:4px;")}"><span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Description:</span><span style="font-size:13px;line-height:1.55;color:#e4e9ee;">${NS.escapeHtml(description)}</span></div>`;
    }
    function buildReviewGradingRow(gradingText, gradingBadge) {
        if (!NS.getConfig("showReviewGrading") || !gradingText) return "";
        const badge = gradingBadge ? `<span style="background:#f1c40f;color:#1a1a1a;font-size:9px;font-weight:bold;text-transform:uppercase;letter-spacing:0.3px;border-radius:3px;padding:2px 6px;white-space:nowrap;">${NS.escapeHtml(gradingBadge)}</span>` : "";
        return `<div style="${sectionRow("display:flex;align-items:center;justify-content:space-between;font-size:11px;")}"><span style="color:#a1b0bd;font-weight:bold;">Review Grading:</span><span style="display:flex;align-items:center;gap:8px;"><span style="color:#ffffff;font-weight:bold;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">${NS.escapeHtml(gradingText)}</span>${badge}</span></div>`;
    }
    function buildReviewRow(reviewSummary, reviewUrl) {
        if (!NS.getConfig("showReview") || !reviewSummary) return "";
        const link = reviewUrl ? `<a href="${encodeURI(reviewUrl)}" target="_blank" rel="noopener noreferrer" style="font-size:10px;color:#ff3e3e;text-transform:uppercase;font-weight:bold;text-decoration:none;flex-shrink:0;">Full Review ↗</a>` : "";
        return `<div style="${sectionRow("display:flex;flex-direction:column;gap:4px;")}"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;"><span style="color:#a1b0bd;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">Review Summary:</span>${link}</div><span style="font-size:13px;line-height:1.55;color:#e4e9ee;">${NS.escapeHtml(reviewSummary)}</span></div>`;
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
    // first), or does nothing if html is empty. Used for the settings gear standalone.
    NS.renderStandalone = function renderStandalone(className, html, location) {
        document.querySelector("." + className)?.remove();
        if (!html) return;
        const targetObj = NS.getTargetInsertionPoint(location);
        if (targetObj) insertAtTarget(makeCtn(className, BADGE_STYLE, html), targetObj);
    };
    // Every section other than Leisure Time resolves synchronously (no async fetch to wait on) —
    // including HLTB itself, which is parsed directly off the IGN page alongside everything else.
    // Each one independently resolves to "inline" (folded into the main badge) or a standalone
    // Location. When 2+ of them share the exact same non-inline Location, they're combined into ONE
    // element (ordered per their relative order in NS.getSectionOrder() — the same list that already
    // orders everything else) rather than being inserted independently, since several independent
    // inserts at the same spot would otherwise have an undefined/fighting relative order.
    //
    // Leisure Time is the one exception: it needs its own async fetch that resolves after this whole
    // synchronous pass is done. Rather than holding back a whole group's render just because Leisure
    // might join it, every group renders immediately with whatever's available now; if Leisure's
    // Location matches a group that was just rendered, `pendingCombine` remembers that group's
    // contents so placeLeisureAndFinalize can rebuild that same element in place — in the right
    // Section Order position — once Leisure actually resolves, instead of everyone waiting on it.
    const SIMPLE_SECTION_KEYS = ["scores", "reviewGrading", "review", "steamReviews", "award", "esrb", "developer", "publisher", "genres", "platforms", "features", "description", "hltb"];
    const groupClassName = loc => "ign_group_standalone_" + loc.replace(/[^a-zA-Z0-9]/g, "");
    function clearAllGroupStandalones() {
        document.querySelectorAll("[data-ign-group-standalone]").forEach(el => el.remove());
    }
    function renderGroupAt(loc, html) {
        document.querySelector("." + groupClassName(loc))?.remove();
        if (!html) return;
        const targetObj = NS.getTargetInsertionPoint(loc);
        if (!targetObj) return;
        const ctn = makeCtn(groupClassName(loc), BADGE_STYLE, html);
        ctn.setAttribute("data-ign-group-standalone", "1");
        insertAtTarget(ctn, targetObj);
    }
    const orderedHtml = (order, items) => {
        const htmlByKey = {};
        items.forEach(i => { htmlByKey[i.key] = i.html; });
        return order.filter(k => htmlByKey[k]).map(k => htmlByKey[k]).join("");
    };
    let pendingCombine = null;
    function placeSections(htmlByKey) {
        const order = NS.getSectionOrder();
        const groups = {};
        const inlineHtmlByKey = {};
        order.filter(key => SIMPLE_SECTION_KEYS.includes(key)).forEach(key => {
            const html = htmlByKey[key];
            if (!html) return;
            const loc = NS.getSectionLocation(key);
            if (loc === "inline") { inlineHtmlByKey[key] = html; return; }
            (groups[loc] = groups[loc] || []).push({ key, html });
        });
        const leisureLoc = NS.getSectionLocation("leisure");
        pendingCombine = (leisureLoc !== "inline" && NS.getConfig("showLeisure")) ? { loc: leisureLoc, items: groups[leisureLoc] || [] } : null;
        Object.keys(groups).forEach(loc => renderGroupAt(loc, orderedHtml(order, groups[loc])));
        return inlineHtmlByKey;
    }
    // Called once Leisure Time data (if any) has resolved. If its Location matched a group that
    // already rendered synchronously, rebuilds that same element in place with Leisure inserted at
    // its correct Section Order position; otherwise places Leisure on its own.
    NS.placeLeisureAndFinalize = function placeLeisureAndFinalize(leisureHtml, leisureLoc) {
        if (pendingCombine && pendingCombine.loc === leisureLoc) {
            const items = pendingCombine.items.concat(leisureHtml ? [{ key: "leisure", html: leisureHtml }] : []);
            pendingCombine = null;
            renderGroupAt(leisureLoc, orderedHtml(NS.getSectionOrder(), items));
        } else {
            // No matching pending group (e.g. settings changed mid-fetch) — place Leisure at its own
            // location; whatever else was pending already rendered itself, so nothing else to flush.
            pendingCombine = null;
            renderGroupAt(leisureLoc, leisureHtml);
        }
    };
    // Leisure is disabled or was never fetched (no HLTB URL resolved) — the group it would have
    // joined already rendered itself without it, so there's nothing left to do but forget it was
    // ever pending.
    NS.finalizeHltbStandalone = function finalizeHltbStandalone() { pendingCombine = null; };
    // Leisure just rendered inline — same as above, nothing to flush since nothing was held back.
    NS.clearLeisureStandalones = function clearLeisureStandalones() { pendingCombine = null; };
    function buildSectionHtml(map) { return NS.getSectionOrder().map(key => map[key] || "").join(""); }
    NS.renderCompleteBadge = function renderCompleteBadge(ignScore, userScore, hltbData, hltbUrl, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, ignUrl, fetchedGameTitle = "", extra = {}) {
        if (!NS.getTargetInsertionPoint()) return null;
        document.querySelector(".ign_rating_row")?.remove();
        clearAllGroupStandalones();
        let displayName = fetchedGameTitle;
        if (!displayName) {
            const slugPart = ignUrl.split("/games/")[1] || "";
            displayName = slugPart.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        }
        const resolvedHltbUrl = resolveHltbUrl(hltbUrl, displayName);
        const leisureLoc = NS.getSectionLocation("leisure");
        const hltbHtml = buildHltbRow(hltbData, resolvedHltbUrl);
        const inlineHtmlByKey = placeSections({
            scores: buildTopRow(ignScore, userScore, ignUrl, displayName),
            reviewGrading: buildReviewGradingRow(extra.reviewGradingText, extra.reviewGradingBadge),
            review: buildReviewRow(extra.reviewSummaryText, extra.reviewUrl),
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: buildAwardRow(awardData),
            esrb: buildEsrbRow(esrbImgSrc, esrbAlt, esrbDescriptors),
            developer: buildDevRow(developerName),
            publisher: buildPublisherRow(extra.publisherName),
            genres: buildGenresRow(extra.genres),
            platforms: buildPlatformsRow(extra.platforms),
            features: buildFeaturesRow(extra.features),
            description: buildDescriptionRow(extra.description),
            hltb: hltbHtml
        });
        const mainHtml = buildSectionHtml({
            ...inlineHtmlByKey,
            leisure: (leisureLoc === "inline" && NS.getConfig("showLeisure")) ? '<div class="ign_leisure_placeholder"></div>' : ""
        });
        const hasRealContent = !!mainHtml.replace(/<div class="ign_leisure_placeholder"><\/div>/g, "").trim();
        if (hasRealContent) insertBadge(makeCtn("ign_rating_row", BADGE_STYLE, mainHtml));
        if (!hasRealContent && NS.getSectionLocation("hltb") === "inline") return null;
        return resolvedHltbUrl;
    };
    NS.renderMultiGameBadge = function renderMultiGameBadge(games, gameTitle) {
        if (!NS.getTargetInsertionPoint()) return "";
        document.querySelector(".ign_rating_row")?.remove();
        clearAllGroupStandalones();
        const primary = games.find(g => g.parsed);
        const p = primary ? primary.parsed : null;
        const resolvedHltbUrl = p ? resolveHltbUrl(p.hltbUrl, gameTitle) : "";
        const leisureLoc = NS.getSectionLocation("leisure");
        const hltbHtml = p ? buildHltbRow(p.hltbData, resolvedHltbUrl) : "";
        const inlineHtmlByKey = placeSections({
            scores: buildMultiGameTopRow(games),
            reviewGrading: p ? buildReviewGradingRow(p.reviewGradingText, p.reviewGradingBadge) : "",
            review: p ? buildReviewRow(p.reviewSummaryText, p.reviewUrl) : "",
            steamReviews: buildSteamReviewsRow(NS.extractSteamReviews()),
            award: p ? buildAwardRow(p.awardData) : "",
            esrb: p ? buildEsrbRow(p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors) : "",
            developer: p ? buildDevRow(p.developerName) : "",
            publisher: p ? buildPublisherRow(p.publisherName) : "",
            genres: p ? buildGenresRow(p.genres) : "",
            platforms: p ? buildPlatformsRow(p.platforms) : "",
            features: p ? buildFeaturesRow(p.features) : "",
            description: p ? buildDescriptionRow(p.description) : "",
            hltb: hltbHtml
        });
        const mainHtml = buildSectionHtml({
            ...inlineHtmlByKey,
            leisure: (p && leisureLoc === "inline" && NS.getConfig("showLeisure")) ? '<div class="ign_leisure_placeholder"></div>' : ""
        });
        insertBadge(makeCtn("ign_rating_row", BADGE_STYLE, mainHtml));
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
