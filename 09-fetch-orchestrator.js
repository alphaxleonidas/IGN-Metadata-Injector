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
