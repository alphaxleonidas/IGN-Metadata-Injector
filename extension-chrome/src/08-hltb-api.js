(function (NS) {
    "use strict";
    NS.IGN_SOURCE_OVERRIDES = { "final fantasy vii remake intergrade": "https://www.ign.com/games/final-fantasy-vii-remake" };
    NS.HLTB_DIRECT_URL_OVERRIDES = {
        "ninja gaiden 3: razor's edge": "https://howlongtobeat.com/game/6623",
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": "https://howlongtobeat.com/game/6623",
        "kingdom hearts -hd 1.5+2.5 remix-": "https://howlongtobeat.com/game/42802",
        "schrodinger's cat burglar": "https://howlongtobeat.com/game/184497",
        "gothic 1 remake": "https://howlongtobeat.com/game/92900",
        "the relic: first guardian": "https://howlongtobeat.com/game/151982"
    };
    NS.fetchHltbOverride = function fetchHltbOverride(url, callback) {
        const empty = () => callback({ hltbData: [], hltbUrl: "" });
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return empty();
                try {
                    const p = NS.parseIgnPage(new DOMParser().parseFromString(response.responseText, "text/html"));
                    callback({ hltbData: p.hltbData, hltbUrl: p.hltbUrl });
                } catch (e) { empty(); }
            },
            onerror: empty
        });
    };
    // HLTB's table class names are CSS-module hashes (currently "M5Fuva_game_main_table", previously
    // "GameTimeTable_game_main_table__...") that change between deploys, so the table is found by what
    // it CONTAINS - a header cell with the wanted column name - never by class. The platform table on
    // the same page has no Average/Leisure header, so it is skipped automatically; with several
    // single/co-op/versus tables the first one that has the column wins, as before.
    function parseHltbTableColumn(doc, columnName) {
        const want = columnName.toLowerCase();
        for (const table of doc.querySelectorAll("table")) {
            const headerCells = Array.from(table.querySelectorAll("thead td, thead th")).map(td => td.textContent.trim().toLowerCase());
            const colIndex = headerCells.indexOf(want);
            if (colIndex === -1) continue;
            const results = [];
            table.querySelectorAll("tbody tr").forEach(row => {
                const cells = row.querySelectorAll("td");
                if (cells.length <= colIndex) return;
                const label = cells[0].textContent.trim();
                if (!label || /all\s*playstyles/i.test(label)) return;
                const time = cells[colIndex].textContent.trim();
                if (time) results.push({ label, time });
            });
            if (results.length) return results;
        }
        return [];
    }
    // Fallback when the visible table can't be parsed at all: the same numbers are in the page's
    // Next.js data (#__NEXT_DATA__ -> props.pageProps.game.data.game[0]) in seconds. Checked against
    // a real HLTB page: Average=comp_*_avg, Median=comp_*_med, Rushed=comp_*_l, Leisure=comp_*_h, and
    // HLTB shows whole minutes (floor), e.g. comp_main_h 29132s -> "8h 5m", comp_plus_h 39741s -> "11h 2m".
    const HLTB_JSON_SUFFIX = { average: "avg", median: "med", rushed: "l", leisure: "h" };
    function formatHltbSeconds(sec) {
        const totalMin = Math.floor(sec / 60), h = Math.floor(totalMin / 60), m = totalMin % 60;
        return h ? (m ? h + "h " + m + "m" : h + "h") : m + "m";
    }
    function parseHltbNextData(doc, columnName) {
        const suffix = HLTB_JSON_SUFFIX[columnName.toLowerCase()], script = doc.getElementById("__NEXT_DATA__");
        if (!suffix || !script) return [];
        let game;
        try { game = JSON.parse(script.textContent).props.pageProps.game.data.game[0]; } catch (e) { return []; }
        if (!game) return [];
        return [["Main Story", "comp_main"], ["Main + Sides", "comp_plus"], ["Completionist", "comp_100"]]
            .map(([label, key]) => ({ label, seconds: Number(game[key + "_" + suffix]) }))
            .filter(r => r.seconds > 0)
            .map(r => ({ label: r.label, time: formatHltbSeconds(r.seconds) }));
    }
    function parseHltbColumn(doc, columnName) {
        const rows = parseHltbTableColumn(doc, columnName);
        return rows.length ? rows : parseHltbNextData(doc, columnName);
    }
    NS.fetchHltbDirect = function fetchHltbDirect(url, callback) {
        const empty = () => callback({ hltbData: [], hltbUrl: url });
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return empty();
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, "text/html");
                    callback({ hltbData: parseHltbColumn(doc, "average"), hltbUrl: url });
                } catch (e) { empty(); }
            },
            onerror: empty
        });
    };
    // Leisure Time is the only HLTB value scraped from HowLongToBeat's own game page (everything else
    // comes from IGN's page), so when HLTB changes its markup or blocks the request it used to fail
    // completely silently - every path just returned []. Each failure mode now says which one it was
    // in the console (prefixed so it's easy to filter), including a short description of what the
    // response actually contained, so a markup change can be fixed against the real page.
    const LEISURE_LOG = "[IGN Metadata Injector] HLTB Leisure Time:";
    function describeHltbDoc(doc, responseText) {
        return {
            responseLength: (responseText || "").length,
            pageTitle: (doc.title || "").slice(0, 80),
            hasNextData: !!doc.getElementById("__NEXT_DATA__"),
            tables: Array.from(doc.querySelectorAll("table")).slice(0, 6).map(t => ({
                className: String(t.className).slice(0, 80),
                headers: Array.from(t.querySelectorAll("thead td, thead th")).map(c => c.textContent.trim()),
                bodyRows: t.querySelectorAll("tbody tr").length
            }))
        };
    }
    NS.fetchHltbLeisure = function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) return callback([]);
        const watchdog = setTimeout(() => console.warn(LEISURE_LOG, "no response after 20s from", hltbUrl), 20000);
        NS.http.get(hltbUrl, {
            onload: function (response) {
                clearTimeout(watchdog);
                if (response.status !== 200) { console.warn(LEISURE_LOG, "HTTP " + response.status + " from", hltbUrl, "(HowLongToBeat refused or redirected the request)"); return callback([]); }
                let rows = [];
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, "text/html");
                    rows = parseHltbColumn(doc, "leisure");
                    if (!rows.length) console.warn(LEISURE_LOG, "page fetched OK but no \"Leisure\" column could be parsed from", hltbUrl, describeHltbDoc(doc, response.responseText));
                } catch (e) { console.warn(LEISURE_LOG, "error while parsing", hltbUrl, e); rows = []; }
                callback(rows);
            },
            onerror: err => { clearTimeout(watchdog); console.warn(LEISURE_LOG, "request failed for", hltbUrl, "(blocked by Tampermonkey @connect permission, network error, or HowLongToBeat bot protection?)", err); callback([]); }
        });
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
