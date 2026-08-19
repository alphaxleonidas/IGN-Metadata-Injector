(function (NS) {
    "use strict";
    function attachLeisureSection(resolvedHltbUrl) {
        const leisureLoc = NS.getSectionLocation("leisure");
        if (!resolvedHltbUrl || !NS.getConfig("showLeisure")) { NS.finalizeHltbStandalone(); return; }
        NS.fetchHltbLeisure(resolvedHltbUrl, leisureData => {
            const html = NS.buildLeisureRow(leisureData, resolvedHltbUrl);
            if (leisureLoc === "inline") { NS.fillLeisurePlaceholder(html); NS.clearLeisureStandalones(); }
            else NS.placeLeisureAndFinalize(html, leisureLoc);
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
    // Resolves a store title to an ign.com game page purely via the search API
    // (NS.searchAndResolveTitle, in 07-ign-api.js) - no local slug-guessing.
    function resolveGameByTitle(title, callback) {
        NS.searchAndResolveTitle(title, result => callback(result));
    }
    function tryDualGameSplit(gameTitle, callback) {
        const plusIndex = gameTitle.indexOf("+");
        if (plusIndex === -1) return callback(false);
        const leftPart = gameTitle.slice(0, plusIndex).trim();
        const rightPart = gameTitle.slice(plusIndex + 1).replace(/\(\s*dlc\s*\)/gi, "").trim();
        if (!leftPart || !rightPart) return callback(false);
        const mergedTitle = `${leftPart} ${rightPart}`.replace(/\s+/g, " ").trim();
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
        resolveGameByTitle(leftPart, r => { leftResult = r; leftDone = true; maybeFinish(); });
        resolveGameByTitle(mergedTitle, r => { mergedResult = r; mergedDone = true; maybeFinish(); });
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
            const resolvedHltbUrl = NS.renderCompleteBadge(p.ignScore, p.userScore, hltbData, hltbUrl, p.developerName, p.esrbImgSrc, p.esrbAlt, p.esrbDescriptors, p.awardData, targetUrl, p.fetchedGameTitle, {
                description: p.description, genres: p.genres, platforms: p.platforms, publisherName: p.publisherName, features: p.features,
                reviewGradingText: p.reviewGradingText, reviewGradingBadge: p.reviewGradingBadge,
                reviewSummaryText: p.reviewSummaryText, reviewUrl: p.reviewUrl
            });
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
    // Generic IGN site-search link, used only as the "couldn't find it" fallback
    // link so an empty-state badge still points somewhere useful. Deliberately
    // NOT pre-encoded here: every url that reaches the badge renderer
    // (05-badge-render.js) gets exactly one encodeURI() applied when it's
    // written into an href - pre-encoding here too would double-encode (e.g.
    // a space becomes %20, then that %25 20 on the second pass).
    function ignSearchFallbackUrl(title) {
        return `https://www.ign.com/search?q=${title.trim()}`;
    }
    function fetchSingleGame(gameTitle, isFallback, onExhausted) {
        const userOverride = NS.getUserOverrideForTitle(gameTitle);
        function finalFallback() {
            if (/collection/i.test(gameTitle)) {
                const packageNames = NS.extractPackageItemNames();
                if (packageNames.length >= 2) return fetchPackageItems(packageNames, gameTitle, null);
            }
            if (onExhausted) return onExhausted();
            NS.renderEmpty("N/A", ignSearchFallbackUrl(gameTitle), gameTitle);
            NS.state.isFetching = false;
        }
        function searchAndRender() {
            resolveGameByTitle(gameTitle, result => {
                if (result) return renderResolvedGame(result, gameTitle, ignSearchFallbackUrl(gameTitle));
                if (!isFallback) {
                    const baseGameName = NS.extractDlcBaseGameName();
                    if (baseGameName && baseGameName.toLowerCase().trim() !== gameTitle.toLowerCase().trim()) return NS.fetchIGNData(baseGameName, { isFallback: true, onExhausted });
                }
                finalFallback();
            });
        }
        // A per-title override wins outright when present and reachable - it's
        // an intentional pin, not a guess, so it's tried before search. The
        // user's own runtime override (set in the settings panel) takes
        // priority over the built-in IGN_URL_OVERRIDES default for the same
        // title, in case they ever want to pin something different.
        const pinnedIgnUrl = (userOverride && userOverride.ignUrl) || NS.IGN_URL_OVERRIDES[gameTitle.toLowerCase().trim()];
        if (pinnedIgnUrl) {
            NS.resolveFirstWorkingUrl([pinnedIgnUrl], result => {
                if (result) return renderResolvedGame(result, gameTitle, pinnedIgnUrl);
                searchAndRender();
            });
        } else {
            searchAndRender();
        }
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
