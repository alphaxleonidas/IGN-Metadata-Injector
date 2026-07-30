// ===================================================================
// IGN Rating Badge — 00: Shared namespace & tiny cross-cutting utils
// ===================================================================
// Every other file attaches its exports to this one object instead of
// the global scope. This is the ONLY thing every other file depends on,
// so as long as the NS.* names below don't change, every other file can
// be edited freely without touching the rest.
//
// This file MUST load first (it creates window.IGN_METADATA_INJECTOR). Load order
// after that doesn't matter for correctness — nothing runs until
// 10-main.js calls init() — but the numeric prefixes keep the files in
// a sensible reading order.
(function (NS) {
    'use strict';

    NS.IS_STEAM = window.location.hostname.includes('steampowered.com');
    NS.IS_EPIC = window.location.hostname.includes('epicgames.com');

    // Mutable runtime state shared across modules (fetch-in-progress guard,
    // last title processed, MutationObserver debounce handle). Kept in one
    // place so it's obvious it's the only shared mutable state in the app.
    NS.state = {
        isFetching: false,
        lastProcessedTitle: '',
        debounceTimer: null
    };

    NS.escapeHtml = function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
