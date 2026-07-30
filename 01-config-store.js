// ===================================================================
// IGN Rating Badge — 01: Settings storage & Tampermonkey menu
// ===================================================================
// Anything backed by GM_getValue/GM_setValue lives here: feature toggles,
// section ordering, and badge placement — plus the Tampermonkey menu that
// flips the toggles. This is the ONLY file that touches GM_registerMenuCommand
// or GM_getValue/GM_setValue for settings, so if you ever port this to an
// extension, this is the one file that needs to swap to chrome.storage.
//
// To add a new setting: add it to CONFIG_KEYS/CONFIG_DEFAULTS. Nothing
// elsewhere needs to change — other files just call NS.getConfig('key').
(function (NS) {
    'use strict';

    const CONFIG_KEYS = {
        showIgnScore: 'Show IGN Score',
        showUserRating: 'Show User Rating',
        showHltb: 'Show HowLongToBeat',
        showLeisure: 'Show HLTB Leisure Times',
        showSteamReviews: 'Show Steam Reviews',
        showDeveloper: 'Show Developer',
        showEsrb: 'Show ESRB Rating & Descriptors',
        showAward: 'Show IGN Award / Leaderboard'
    };

    const CONFIG_DEFAULTS = {
        showIgnScore: true,
        showUserRating: true,
        showHltb: true,
        showLeisure: true,
        showSteamReviews: true,
        showDeveloper: true,
        showEsrb: true,
        showAward: true
    };

    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;

    NS.getConfig = function getConfig(key) {
        return GM_getValue(key, CONFIG_DEFAULTS[key]);
    };

    // ---- Section ordering (used by both rendering and the settings panel) ----
    const SECTION_LABELS = {
        scores: 'IGN Score / User Rating',
        steamReviews: 'Steam Reviews',
        award: 'Leaderboard Rank',
        esrb: 'ESRB Rating',
        developer: 'Developer',
        hltb: 'HowLongToBeat',
        leisure: 'HLTB Leisure Time'
    };
    const DEFAULT_SECTION_ORDER = ['scores', 'steamReviews', 'award', 'esrb', 'developer', 'hltb', 'leisure'];

    NS.SECTION_LABELS = SECTION_LABELS;
    NS.DEFAULT_SECTION_ORDER = DEFAULT_SECTION_ORDER;

    NS.getSectionOrder = function getSectionOrder() {
        const stored = GM_getValue('sectionOrder', null);
        if (!Array.isArray(stored) || stored.length === 0) return [...DEFAULT_SECTION_ORDER];
        // Keep only known keys, then append any new sections the user's saved order predates
        const known = stored.filter(key => DEFAULT_SECTION_ORDER.includes(key));
        const missing = DEFAULT_SECTION_ORDER.filter(key => !known.includes(key));
        return [...known, ...missing];
    };

    NS.setSectionOrder = function setSectionOrder(order) {
        GM_setValue('sectionOrder', order);
    };

    // ---- Overlay position (where the whole badge gets inserted on the page) ----
    NS.BADGE_POSITION_OPTIONS = [
        { value: 'default', label: 'Default (near header / reviews)' },
        { value: 'aboveTitle', label: "Above the game's title" },
        { value: 'sidebarBottom', label: 'Bottom of right sidebar metadata' },
        { value: 'abovePrice', label: 'Above price / buy box (Steam only)' },
        { value: 'aboveExternalLinks', label: 'Above external links row (SteamDB, ProtonDB, etc.)' },
        { value: 'belowExternalLinks', label: 'Below external links row (SteamDB, ProtonDB, etc.)' }
    ];

    NS.getBadgePosition = function getBadgePosition() {
        return GM_getValue('badgePosition', 'default');
    };

    NS.setBadgePosition = function setBadgePosition(value) {
        GM_setValue('badgePosition', value);
    };

    // ---- HLTB / HLTB Leisure Time locations (independent of the main badge & each other) ----
    // Either can stay 'inline' (rendered as a section inside the main badge, in its usual
    // section-order position — the original/default behavior) or be pulled out to its own
    // standalone element at any of the same page locations the main badge can use.
    NS.HLTB_LOCATION_OPTIONS = [
        { value: 'inline', label: 'Inline within main badge (default)' },
        ...NS.BADGE_POSITION_OPTIONS
    ];

    NS.getHltbLocation = function getHltbLocation() {
        return GM_getValue('hltbLocation', 'inline');
    };
    NS.setHltbLocation = function setHltbLocation(value) {
        GM_setValue('hltbLocation', value);
    };

    NS.getLeisureLocation = function getLeisureLocation() {
        return GM_getValue('leisureLocation', 'inline');
    };
    NS.setLeisureLocation = function setLeisureLocation(value) {
        GM_setValue('leisureLocation', value);
    };

    NS.isInlineLocation = function isInlineLocation(value) {
        return !value || value === 'inline';
    };

    // ---- Manual per-title overrides ----
    // Future-proofing for games that never resolve on their own: force an exact IGN game
    // page and/or an exact HowLongToBeat page for one title, keyed by the store title
    // lowercased/trimmed (same matching convention as the hardcoded override tables in
    // 03-title-resolver.js and 08-hltb-api.js). Unlike those hardcoded tables, this one is
    // meant to be edited from the settings panel at runtime, no code changes required.
    NS.getUserOverrides = function getUserOverrides() {
        return GM_getValue('userTitleOverrides', {});
    };

    NS.setUserOverrides = function setUserOverrides(overridesObj) {
        GM_setValue('userTitleOverrides', overridesObj);
    };

    // Adds/updates one entry. Pass '' (or omit) for a field to leave it unset.
    NS.setUserOverride = function setUserOverride(title, ignUrl, hltbUrl) {
        const key = title.trim().toLowerCase();
        if (!key) return;
        const all = NS.getUserOverrides();
        all[key] = { displayTitle: title.trim(), ignUrl: ignUrl ? ignUrl.trim() : '', hltbUrl: hltbUrl ? hltbUrl.trim() : '' };
        NS.setUserOverrides(all);
    };

    NS.removeUserOverride = function removeUserOverride(key) {
        const all = NS.getUserOverrides();
        delete all[key];
        NS.setUserOverrides(all);
    };

    // Looks up a title the same way the rest of the app matches titles (lowercase + trim).
    // Returns { displayTitle, ignUrl, hltbUrl } or null.
    NS.getUserOverrideForTitle = function getUserOverrideForTitle(title) {
        const all = NS.getUserOverrides();
        return all[title.trim().toLowerCase()] || null;
    };

    // ---- Tampermonkey menu (checkbox-style toggles) ----
    const menuCommandIds = {};

    function menuLabel(key) {
        return `${NS.getConfig(key) ? '✅' : '⬜'} ${CONFIG_KEYS[key]}`;
    }

    NS.registerMenuCommands = function registerMenuCommands() {
        const canUnregister = typeof GM_unregisterMenuCommand !== 'undefined';
        for (const key of Object.keys(CONFIG_KEYS)) {
            if (canUnregister && menuCommandIds[key] !== undefined) {
                GM_unregisterMenuCommand(menuCommandIds[key]);
            }
            menuCommandIds[key] = GM_registerMenuCommand(menuLabel(key), () => NS.toggleConfig(key));
        }
    };

    NS.toggleConfig = function toggleConfig(key) {
        GM_setValue(key, !NS.getConfig(key));
        NS.registerMenuCommands(); // refresh checkbox glyphs immediately so it reads as a toggle, not a click
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
