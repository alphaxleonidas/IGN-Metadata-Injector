(function (NS) {
    "use strict";
    NS.HLTB_SOURCE_OVERRIDES = { "final fantasy vii remake intergrade": "https://www.ign.com/games/final-fantasy-vii-remake" };
    NS.HLTB_DIRECT_URL_OVERRIDES = {
        "ninja gaiden 3: razor's edge": "https://howlongtobeat.com/game/6623",
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": "https://howlongtobeat.com/game/6623",
        "kingdom hearts -hd 1.5+2.5 remix-": "https://howlongtobeat.com/game/42802",
        "schrodinger's cat burglar": "https://howlongtobeat.com/game/184497"
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
    function parseHltbTableColumn(doc, columnName) {
        const table = doc.querySelector('table[class*="GameTimeTable"]');
        if (!table) return [];
        const headerCells = Array.from(table.querySelectorAll("thead td, thead th")).map(td => td.textContent.trim().toLowerCase());
        const colIndex = headerCells.indexOf(columnName.toLowerCase());
        if (colIndex === -1) return [];
        const results = [];
        table.querySelectorAll("tbody tr").forEach(row => {
            const cells = row.querySelectorAll("td");
            if (cells.length <= colIndex) return;
            const label = cells[0].textContent.trim();
            if (!label || /all\s*playstyles/i.test(label)) return;
            const time = cells[colIndex].textContent.trim();
            if (time) results.push({ label, time });
        });
        return results;
    }
    NS.fetchHltbDirect = function fetchHltbDirect(url, callback) {
        const empty = () => callback({ hltbData: [], hltbUrl: url });
        NS.http.get(url, {
            onload: function (response) {
                if (response.status !== 200) return empty();
                try {
                    const doc = new DOMParser().parseFromString(response.responseText, "text/html");
                    callback({ hltbData: parseHltbTableColumn(doc, "average"), hltbUrl: url });
                } catch (e) { empty(); }
            },
            onerror: empty
        });
    };
    NS.fetchHltbLeisure = function fetchHltbLeisure(hltbUrl, callback) {
        if (!hltbUrl || !/howlongtobeat\.com/i.test(hltbUrl)) return callback([]);
        NS.http.get(hltbUrl, {
            onload: function (response) {
                if (response.status !== 200) return callback([]);
                try { callback(parseHltbTableColumn(new DOMParser().parseFromString(response.responseText, "text/html"), "leisure")); } catch (e) { callback([]); }
            },
            onerror: () => callback([])
        });
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
