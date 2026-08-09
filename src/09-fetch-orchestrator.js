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
