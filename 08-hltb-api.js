// ===================================================================
// IGN Rating Badge — 08: HowLongToBeat network calls & page parsing
// ===================================================================
// Everything that talks to howlongtobeat.com, plus the two per-title
// override tables for games whose IGN page has missing/unreliable HLTB
// data. If HLTB changes its markup, or you need to add another override,
// this is the only file that needs to change.
(function (NS) {
    'use strict';

    // Games whose own IGN page has missing/unreliable HLTB data — pull it from another IGN page instead
    NS.HLTB_SOURCE_OVERRIDES = {
        'final fantasy vii remake intergrade': 'https://www.ign.com/games/final-fantasy-vii-remake'
    };

    // Games whose IGN page has no HLTB block/link at all — go straight to a known HowLongToBeat
    // game page instead of trying (and failing) to scrape one from IGN.
    NS.HLTB_DIRECT_URL_OVERRIDES = {
        "ninja gaiden 3: razor's edge": 'https://howlongtobeat.com/game/6623',
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": 'https://howlongtobeat.com/game/6623',
        'kingdom hearts -hd 1.5+2.5 remix-': 'https://howlongtobeat.com/game/42802'
    };

    // Fetches just the HLTB block from an override IGN URL. Calls back with { hltbData, hltbUrl }.
    NS.fetchHltbOverride = function fetchHltbOverride(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback({ hltbData: [], hltbUrl: '' }); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    const p = NS.parseIgnPage(doc);
                    callback({ hltbData: p.hltbData, hltbUrl: p.hltbUrl });
                } catch (e) {
                    callback({ hltbData: [], hltbUrl: '' });
                }
            },
            onerror: function () { callback({ hltbData: [], hltbUrl: '' }); }
        });
    };

    // Parses the HLTB game page's own play-time table (Polled/Average/Median/Rushed/Leisure),
    // pulling out one named column (e.g. "Average", "Leisure"), skipping "All PlayStyles".
    function parseHltbTableColumn(doc, columnName) {
        const table = doc.querySelector('table[class*="GameTimeTable"]');
        if (!table) return [];

        const headerCells = Array.from(table.querySelectorAll('thead td, thead th')).map(td => td.textContent.trim().toLowerCase());
        const colIndex = headerCells.indexOf(columnName.toLowerCase());
        if (colIndex === -1) return [];

        const results = [];
        table.querySelectorAll('tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length <= colIndex) return;

            const label = cells[0].textContent.trim();
            if (!label || /all\s*playstyles/i.test(label)) return;

            const time = cells[colIndex].textContent.trim();
            if (time) results.push({ label, time });
        });

        return results;
    }

    function parseHltbLeisureData(doc) {
        return parseHltbTableColumn(doc, 'leisure');
    }

    // Fetches an HLTB game page directly and pulls its "Average" column as the main HLTB
    // stats (matching what IGN itself normally displays), for games whose IGN page has no
    // HLTB data of its own to scrape (see HLTB_DIRECT_URL_OVERRIDES).
    NS.fetchHltbDirect = function fetchHltbDirect(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url,
            onload: function (response) {
                if (response.status !== 200) { callback({ hltbData: [], hltbUrl: url }); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    callback({ hltbData: parseHltbTableColumn(doc, 'average'), hltbUrl: url });
                } catch (e) {
                    callback({ hltbData: [], hltbUrl: url });
                }
            },
            onerror: function () { callback({ hltbData: [], hltbUrl: url }); }
        });
    };

    // Fetches the HLTB game page and extracts its Leisure-time data. Never throws — callback
    // always receives an array (possibly empty) so a failure here can't break the rest of the overlay.
    NS.fetchHltbLeisure = function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) { callback([]); return; }
        GM_xmlhttpRequest({
            method: 'GET',
            url: hltbUrl,
            onload: function (response) {
                if (response.status !== 200) { callback([]); return; }
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, 'text/html');
                    callback(parseHltbLeisureData(doc));
                } catch (e) {
                    callback([]);
                }
            },
            onerror: function () { callback([]); }
        });
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
