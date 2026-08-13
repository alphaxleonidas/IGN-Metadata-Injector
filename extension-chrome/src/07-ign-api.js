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
