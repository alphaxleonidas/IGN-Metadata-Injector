(function (NS) {
    "use strict";
    // ============================================================================
    // IGN search + matching. This replaces the old "guess a slug from the title,
    // probe it with HTTP requests" approach entirely: every game is found via
    // IGN's own persisted-query search API, then the best result is picked with
    // a recall-gated similarity score instead of a loose word-overlap heuristic.
    // Everything below fetchIgnSearchScored()/searchAndResolveTitle() down to
    // parseIgnPage()/resolveFirstWorkingUrl()/gameEntryFromResult() is the
    // "how do we read an ign.com page once we're on it" logic and is unchanged
    // from the original script.
    // ============================================================================

    const IGN_SEARCH_PERSISTED_HASH = "e1c2e012a21b4a98aaa618ef1b43eb0cafe9136303274a34f5d9ea4f2446e884";

    // ---- text normalization for matching (never used for displayed text) ----

    // Edition/version qualifiers add noise that dilutes comparison without
    // helping distinguish one game from another.
    const EDITION_NOISE_RE =
        /\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi;

    // Words too generic to count as evidence of a match either way.
    const STOPWORDS = new Set(["the", "a", "an", "of", "and", "edition"]);

    const ROMAN_TABLE = [[50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
    function toRoman(num) {
        let n = num, result = "";
        for (const [value, numeral] of ROMAN_TABLE) { while (n >= value) { result += numeral; n -= value; } }
        return result;
    }
    const ROMAN_LOOKUP = {}; // 'iii' -> 3, etc.
    for (let n = 1; n <= 50; n++) ROMAN_LOOKUP[toRoman(n)] = n;

    // Rewrites roman numerals to arabic digits so "Ninja Gaiden III" and
    // "Ninja Gaiden 3" tokenize identically instead of silently mismatching.
    function normalizeNumerals(tokens) {
        return tokens.map(t => ROMAN_LOOKUP.hasOwnProperty(t) ? String(ROMAN_LOOKUP[t]) : t);
    }

    // Transliterate accented/non-Latin characters to plain ASCII equivalents
    // *before* the ASCII-only strip in normalize(), so e.g. "Pokémon" or a
    // stylized "Ninja Gaiden Σ2" don't lose whole words to a single stray
    // character. NFD + diacritic-strip handles most accented Latin generically;
    // the explicit replacements below cover cases NFD doesn't decompose (German
    // ß has no base+combining-mark form) or non-Latin letters that sometimes
    // appear stylistically in game titles (Greek Σ/Δ/Ω).
    // NOTE: this is used ONLY for internal matching. Anything shown in the
    // badge (title, description, genres, etc.) must always come from the raw,
    // un-transliterated API/page data - see parseIgnPage() below, which never
    // calls this.
    function transliterate(str) {
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/ß/gi, "ss")
            .replace(/[Σσς](\d)/g, "Sigma $1")
            .replace(/[Σσς]/g, "Sigma")
            .replace(/Δ/g, "Delta").replace(/δ/g, "delta")
            .replace(/Ω/g, "Omega").replace(/ω/g, "omega");
    }

    function normalize(name) {
        return transliterate(name)
            .toLowerCase()
            .replace(/[®™©]/g, "")
            .replace(/&/g, " and ") // "Ratchet & Clank" <-> "Ratchet and Clank"
            .replace(EDITION_NOISE_RE, " ")
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }
    function tokenize(name) {
        return normalizeNumerals(normalize(name).split(" ").filter(Boolean));
    }
    // Significant tokens only: drops stopwords, since matching on "the"/"and"
    // tells us nothing about whether two titles are the same game.
    function significantTokens(name) {
        return tokenize(name).filter(t => !STOPWORDS.has(t));
    }

    // ---- name/year extraction from IGN's actual GraphQL schema ----
    // (metadata.names.name, not a flat "name" field; objectRegions[].releases[].date
    // as "yyyy-MM-dd" strings, not a flat release-year field.)
    function getGameName(obj) {
        const names = obj?.metadata?.names;
        if (!names) return null;
        return (names.name || names.short || (names.alt && names.alt[0]) || null)?.trim() ?? null;
    }
    function getIgnReleaseYear(obj) {
        const dates = (obj?.objectRegions ?? [])
            .flatMap(r => r.releases ?? [])
            .map(r => r.date)
            .filter(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
            .sort();
        return dates.length ? parseInt(dates[0].slice(0, 4), 10) : null;
    }

    // Steam's release date block usually reads "22 Jul, 2021" or similar -
    // just grab the 4-digit year, if present, as a secondary disambiguator.
    function getStoreReleaseYear() {
        if (!NS.IS_STEAM) return null;
        const el = document.querySelector(".release_date .date");
        const text = el?.textContent ?? "";
        const match = text.match(/\b(19|20)\d{2}\b/);
        return match ? parseInt(match[0], 10) : null;
    }

    // ---- recall-gated similarity scoring ----
    // A candidate is only eligible if nearly all of the *significant* words in
    // the store title actually appear in it - not just "shares some words".
    // This is what stops e.g. the base franchise entry "Ratchet and Clank"
    // from beating "Ratchet and Clank: Rift Apart": it's missing "rift" and
    // "apart" entirely, so it's disqualified rather than merely down-scored.
    const MIN_RECALL = 0.75; // allow at most ~1 missing significant word on longer titles
    const MIN_MATCH_SCORE = 0.5; // final F1-style score floor, post-recall-gate
    const YEAR_MATCH_BONUS = 0.15;
    const YEAR_MISMATCH_PENALTY = 0.15;

    function scoreCandidate(targetTokens, candidateTokens, storeYear, candidateObj) {
        if (targetTokens.length === 0 || candidateTokens.length === 0) return -1;
        const targetSet = new Set(targetTokens);
        const candidateSet = new Set(candidateTokens);
        let overlap = 0;
        targetSet.forEach(t => { if (candidateSet.has(t)) overlap++; });

        const recall = overlap / targetSet.size;
        if (recall < MIN_RECALL) return -1; // hard gate: disqualify, don't just penalize

        const precision = overlap / candidateSet.size;
        let score = (2 * recall * precision) / (recall + precision); // F1

        if (storeYear != null) {
            const ignYear = getIgnReleaseYear(candidateObj);
            if (ignYear != null) score += ignYear === storeYear ? YEAR_MATCH_BONUS : -YEAR_MISMATCH_PENALTY;
        }
        return score;
    }

    // ---- raw GraphQL search call ----
    // NS.http.get (00-namespace.js) never sends custom headers - fine for
    // plain page fetches, but IGN's GraphQL endpoint runs Apollo Server's
    // CSRF prevention, which rejects any request that doesn't carry either a
    // non-simple content-type or the apollo-require-preflight header. This
    // talks to GM_xmlhttpRequest directly (still exempt from CORS, same as
    // NS.http.get is) so those headers can actually be set; it falls back to
    // NS.http.get - without the special headers - only in the rare case
    // GM_xmlhttpRequest itself isn't available (e.g. a future runtime), where
    // the search call may still be rejected by IGN's CSRF check.
    const IGN_GRAPHQL_HEADERS = {
        "apollographql-client-name": "kraken",
        "apollographql-client-version": "v0.67.0",
        referer: "https://www.ign.com/reviews/games",
        accept: "application/json",
        "apollo-require-preflight": "true",
    };
    function ignGraphqlGet(url, callback) {
        if (typeof GM_xmlhttpRequest !== "undefined") {
            GM_xmlhttpRequest({ method: "GET", url, headers: IGN_GRAPHQL_HEADERS, onload: callback, onerror: () => callback(null) });
        } else {
            NS.http.get(url, { onload: callback, onerror: () => callback(null) });
        }
    }
    function rawIgnSearch(term, callback) {
        const variables = JSON.stringify({ term, count: 20, objectType: "Game" });
        const extensions = JSON.stringify({ persistedQuery: { version: 1, sha256Hash: IGN_SEARCH_PERSISTED_HASH } });
        const url = `https://mollusk.apis.ign.com/graphql?operationName=SearchObjectsByName&variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
        ignGraphqlGet(url, response => {
            if (!response || response.status !== 200) return callback(null);
            try {
                const json = JSON.parse(response.responseText);
                const objects = json?.data?.searchObjectsByName?.objects ?? [];
                callback(Array.isArray(objects) ? objects : []);
            } catch (e) { callback(null); }
        });
    }

    // Scored search: runs the search term, scores every candidate against it,
    // and returns the best one IF it clears the confidence floor - otherwise
    // null, so callers can try another term (alias) instead of guessing wrong.
    function fetchIgnSearchScored(term, storeYear, callback) {
        rawIgnSearch(term, results => {
            if (!results || results.length === 0) return callback(null);
            const targetTokens = significantTokens(term);
            let best = null, bestScore = -Infinity;
            results.forEach(obj => {
                const name = getGameName(obj);
                if (!name || !obj.slug) return;
                const score = scoreCandidate(targetTokens, significantTokens(name), storeYear, obj);
                if (score > bestScore) { bestScore = score; best = obj; }
            });
            if (!best || bestScore < MIN_MATCH_SCORE) return callback(null);
            callback({ slug: String(best.slug).toLowerCase(), url: `https://www.ign.com/games/${best.slug}` });
        });
    }

    // Public entry point used by the fetch orchestrator: tries the store title
    // first, then each configured alias (03-title-resolver.js) in order, until
    // one produces a confident match. Returns {url, parsed} (same shape as
    // resolveFirstWorkingUrl) or null via callback if nothing was confident.
    NS.searchAndResolveTitle = function searchAndResolveTitle(title, callback) {
        const storeYear = getStoreReleaseYear();
        const terms = [title, ...NS.getTitleAliases(title)];
        function tryTerm(index) {
            if (index >= terms.length) return callback(null);
            fetchIgnSearchScored(terms[index], storeYear, hit => {
                if (!hit) return tryTerm(index + 1);
                NS.resolveFirstWorkingUrl([hit.url], result => callback(result));
            });
        }
        tryTerm(0);
    };

    // ---- reading an ign.com game page once we're on it (unchanged) ----
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
        // Everything below comes from the page's object summary box (ratings, description, genres,
        // platforms, developer/publisher, features) — scoped to that one container rather than the
        // whole document, since IGN game pages can repeat similar-looking widgets elsewhere (e.g.
        // franchise/related-game rails) that would otherwise be matched by mistake, silently pulling
        // in another title's rating/descriptors or leaving them blank.
        const summaryBox = doc.querySelector('[data-cy="object-summary-box"]') || doc;
        let developerName = "";
        const devEl = summaryBox.querySelector('[data-cy="developers-info"] [data-cy="developerLink"]') ||
            summaryBox.querySelector('[data-cy="developers-info"] [data-cy="producerLink"]') ||
            summaryBox.querySelector('[data-cy="developers-info"] a');
        if (devEl && devEl.textContent.trim()) developerName = devEl.textContent.trim();
        let publisherName = "";
        const pubEl = summaryBox.querySelector('[data-cy="publishers-info"] [data-cy="publisherLink"]') ||
            summaryBox.querySelector('[data-cy="publishers-info"] a');
        if (pubEl && pubEl.textContent.trim()) publisherName = pubEl.textContent.trim();
        // ESRB: the object summary box nests the age-rating link/img and its descriptors text as
        // ["ESRB: E10+" title / "ESRB: Everyone 10+" img alt] on an <a data-cy="object-age-rating">,
        // with the descriptor text in a sibling data-cy="content-rating-description" block — not
        // baked into the alt text itself, so it's read separately here rather than split out of it.
        let esrbImgSrc = "", esrbAlt = "", esrbDescriptors = "";
        const ageRatingEl = summaryBox.querySelector('a[data-cy="object-age-rating"]');
        if (ageRatingEl) {
            const img = ageRatingEl.querySelector("img");
            if (img) { esrbImgSrc = img.getAttribute("src") || ""; esrbAlt = img.getAttribute("alt") || ""; }
            if (!esrbAlt) esrbAlt = ageRatingEl.getAttribute("title") || "";
            const descEl = ageRatingEl.parentElement && ageRatingEl.parentElement.querySelector('[data-cy="content-rating-description"]');
            if (descEl) esrbDescriptors = descEl.textContent.trim();
        } else {
            const esrbImgEl = summaryBox.querySelector('img[data-cy^="icon-esrb"]') || summaryBox.querySelector('img[alt*="ESRB:"]');
            if (esrbImgEl) { esrbImgSrc = esrbImgEl.getAttribute("src"); esrbAlt = esrbImgEl.getAttribute("alt") || "ESRB Rating"; }
        }
        if (esrbAlt && esrbAlt.includes(":")) {
            const [firstPart, ...rest] = esrbAlt.split(":");
            const label = firstPart.trim(), remainder = rest.join(":").trim();
            if (/^esrb$/i.test(label)) esrbAlt = remainder;
            else { esrbAlt = label; if (!esrbDescriptors) esrbDescriptors = remainder; }
        }
        esrbAlt = NS.normalizeEsrbLabel(esrbAlt);
        if (!esrbDescriptors) {
            const descContainer = summaryBox.querySelector('[data-cy*="esrb-descriptors"]') || summaryBox.querySelector(".esrb-descriptors");
            if (descContainer) esrbDescriptors = descContainer.textContent.trim();
        }
        // Game description: the object summary box's own blurb, not the ESRB content-rating-description
        // (same data-cy value is reused for both — this one lives inside data-cy="summary-info").
        let description = "";
        const descriptionEl = summaryBox.querySelector('[data-cy="summary-info"] [data-cy="content-rating-description"]');
        if (descriptionEl) description = descriptionEl.textContent.trim();
        const genres = [];
        summaryBox.querySelectorAll('[data-cy="genres-info"] a[data-cy="genreLink"]').forEach(a => { const t = a.textContent.trim(); if (t) genres.push(t); });
        const features = [];
        summaryBox.querySelectorAll('[data-cy="features-info"] a[data-cy="featureLink"]').forEach(a => { const t = a.textContent.trim(); if (t) features.push(t); });
        const platforms = [];
        summaryBox.querySelectorAll('[data-cy="platforms-info"] a.platform-icon').forEach(a => {
            const img = a.querySelector("img");
            const name = a.getAttribute("title") || (img && img.getAttribute("alt")) || "";
            if (name) platforms.push({ name, iconSrc: img ? img.getAttribute("src") : "" });
        });
        // Critic review card (score hexagon + "amazing"-style grading text + Editors' Choice badge +
        // review blurb/link) — scoped strictly to .review-details, which only exists on pages that
        // actually have a review. No review card means no grading data at all, rather than falling
        // back to a document-wide search: data-cy="title1"/"article-subtitle" etc. are reused by
        // unrelated widgets elsewhere on the page (e.g. a "<Game> News" teaser card), so searching
        // the whole document when there's no review picked up that unrelated content instead.
        let reviewGradingText = "", reviewGradingBadge = "", reviewSummaryText = "", reviewUrl = "";
        const reviewRoot = doc.querySelector(".review-details");
        if (reviewRoot) {
            const gradingEl = reviewRoot.querySelector('[data-cy="title1"]');
            if (gradingEl) reviewGradingText = gradingEl.textContent.trim();
            const badgeEl = reviewRoot.querySelector(".tag [data-cy=\"caption\"]");
            if (badgeEl) reviewGradingBadge = badgeEl.textContent.trim();
            const subtitleEl = reviewRoot.querySelector('[data-cy="article-subtitle"]');
            if (subtitleEl) reviewSummaryText = subtitleEl.textContent.trim();
            const reviewLinkEl = reviewRoot.querySelector('[data-cy="article-review-link"]');
            if (reviewLinkEl) {
                const href = reviewLinkEl.getAttribute("href") || "";
                if (href) reviewUrl = /^https?:\/\//i.test(href) ? href : `https://www.ign.com${href.startsWith("/") ? "" : "/"}${href}`;
            }
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
        return {
            fetchedGameTitle, ignScore, userScore, developerName, publisherName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, hltbData, hltbUrl,
            description, genres, features, platforms, reviewGradingText, reviewGradingBadge, reviewSummaryText, reviewUrl
        };
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
