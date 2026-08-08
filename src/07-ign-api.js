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
        let developerName = "";
        const devEl = doc.querySelector('[data-cy="developerLink"]') || doc.querySelector('a[href*="/games/developer/"]') ||
            doc.querySelector('[data-cy="producerLink"]') || doc.querySelector('a[href*="/games/producer/"]');
        if (devEl && devEl.textContent.trim()) developerName = devEl.textContent.trim();
        let esrbImgSrc = "", esrbAlt = "", esrbDescriptors = "";
        const esrbImgEl = doc.querySelector('img[data-cy^="icon-esrb"]') || doc.querySelector('img[alt*="ESRB:"]');
        if (esrbImgEl) { esrbImgSrc = esrbImgEl.getAttribute("src"); esrbAlt = esrbImgEl.getAttribute("alt") || "ESRB Rating"; }
        if (esrbAlt && esrbAlt.includes(":")) {
            const [firstPart, ...rest] = esrbAlt.split(":");
            const label = firstPart.trim(), remainder = rest.join(":").trim();
            if (/^esrb$/i.test(label)) esrbAlt = remainder;
            else { esrbAlt = label; esrbDescriptors = remainder; }
        }
        esrbAlt = NS.normalizeEsrbLabel(esrbAlt);
        if (!esrbDescriptors) {
            const descContainer = doc.querySelector('[data-cy*="esrb-descriptors"]') || doc.querySelector(".esrb-descriptors");
            if (descContainer) esrbDescriptors = descContainer.textContent.trim();
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
        return { fetchedGameTitle, ignScore, userScore, developerName, esrbImgSrc, esrbAlt, esrbDescriptors, awardData, hltbData, hltbUrl };
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
