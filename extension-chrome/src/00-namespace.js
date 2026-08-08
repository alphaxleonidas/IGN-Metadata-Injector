(function(NS) {
    "use strict";
    NS.IS_STEAM = window.location.hostname.includes("steampowered.com");
    NS.IS_EPIC = window.location.hostname.includes("epicgames.com");
    NS.state = { isFetching: false, lastProcessedTitle: "", debounceTimer: null };
    NS.escapeHtml = str => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    NS.findSafeBeforeTarget = function findSafeBeforeTarget(el) {
        let node = el;
        while (node.parentElement) {
            const display = getComputedStyle(node.parentElement).display;
            if (display === "flex" || display === "inline-flex" || display === "grid" || display === "inline-grid") { node = node.parentElement; continue; }
            break;
        }
        return node;
    };
    // For "insert after X, so it lands below X": only climbs past ancestors laying children out
    // horizontally (row flex, or a multi-column grid) — stops once it reaches one that stacks
    // children vertically, since inserting there already lands on its own line.
    NS.findSafeAfterTarget = function findSafeAfterTarget(el) {
        let node = el;
        while (node.parentElement) {
            const cs = getComputedStyle(node.parentElement);
            const isRowFlex = cs.display.indexOf("flex") !== -1 && cs.flexDirection.indexOf("row") === 0;
            const isMultiColGrid = cs.display.indexOf("grid") !== -1 && cs.gridTemplateColumns.split(" ").filter(Boolean).length > 1;
            if (isRowFlex || isMultiColGrid) { node = node.parentElement; continue; }
            break;
        }
        return node;
    };
    if (typeof GM_getValue !== "undefined") {
        NS.storage = {
            ready: Promise.resolve(),
            getSync: (key, defaultValue) => GM_getValue(key, defaultValue),
            set: (key, value) => GM_setValue(key, value)
        };
    } else if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        const cache = {};
        NS.storage = {
            ready: new Promise(resolve => chrome.storage.local.get(null, all => { Object.assign(cache, all || {}); resolve(); })),
            getSync: (key, defaultValue) => cache.hasOwnProperty(key) ? cache[key] : defaultValue,
            set: (key, value) => { cache[key] = value; chrome.storage.local.set({ [key]: value }); }
        };
    } else {
        const cache = {};
        NS.storage = {
            ready: Promise.resolve(),
            getSync: (key, defaultValue) => cache.hasOwnProperty(key) ? cache[key] : defaultValue,
            set: (key, value) => { cache[key] = value; }
        };
    }
    NS.http = typeof GM_xmlhttpRequest !== "undefined" ? {
        get: (url, handlers) => GM_xmlhttpRequest({ method: "GET", url: url, onload: handlers.onload, onerror: handlers.onerror })
    } : {
        get: (url, handlers) => {
            fetch(url, { method: "GET", credentials: "omit" })
                .then(res => res.text().then(text => ({ status: res.status, responseText: text })))
                .then(response => { if (handlers.onload) handlers.onload(response); })
                .catch(() => { if (handlers.onerror) handlers.onerror(); });
        }
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
