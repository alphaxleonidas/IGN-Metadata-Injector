(function(NS) {
    "use strict";
    const CONFIG_KEYS = {
        showIgnScore: "Show IGN Score", showUserRating: "Show User Rating", showHltb: "Show HowLongToBeat",
        showLeisure: "Show HLTB Leisure Times", showSteamReviews: "Show Steam Reviews", showDeveloper: "Show Developer",
        showEsrb: "Show ESRB Rating & Descriptors", showAward: "Show IGN Award / Leaderboard"
    };
    const CONFIG_DEFAULTS = {
        showIgnScore: true, showUserRating: true, showHltb: true, showLeisure: true,
        showSteamReviews: true, showDeveloper: true, showEsrb: true, showAward: true
    };
    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
    NS.getConfig = key => NS.storage.getSync(key, CONFIG_DEFAULTS[key]);
    const SECTION_LABELS = {
        scores: "IGN Score / User Rating", steamReviews: "Steam Reviews", award: "Leaderboard Rank",
        esrb: "ESRB Rating", developer: "Developer", hltb: "HowLongToBeat", leisure: "HLTB Leisure Time"
    };
    const DEFAULT_SECTION_ORDER = [ "scores", "steamReviews", "award", "esrb", "developer", "hltb", "leisure" ];
    NS.SECTION_LABELS = SECTION_LABELS;
    NS.DEFAULT_SECTION_ORDER = DEFAULT_SECTION_ORDER;
    NS.getSectionOrder = function getSectionOrder() {
        const stored = NS.storage.getSync("sectionOrder", null);
        if (!Array.isArray(stored) || stored.length === 0) return [ ...DEFAULT_SECTION_ORDER ];
        const known = stored.filter(key => DEFAULT_SECTION_ORDER.includes(key));
        return [ ...known, ...DEFAULT_SECTION_ORDER.filter(key => !known.includes(key)) ];
    };
    NS.setSectionOrder = order => NS.storage.set("sectionOrder", order);
    NS.BADGE_POSITION_OPTIONS = [
        { value: "default", label: "Default" }, { value: "aboveTitle", label: "Above Game Title" },
        { value: "belowGameMedia", label: "Below Game Media" },
        { value: "abovePrice", label: "Steam: Above Game Price | Epic: Above Game Description" },
        { value: "belowLeftSidebar", label: "Below Left Sidebar" },
        { value: "aboveRightSidebarMetadata", label: "Above Right Side Metadata" },
        { value: "belowRightSidebarMetadata", label: "Below Right Side Metadata" },
        { value: "sidebarBottom", label: "Bottom of Right Sidebar" }
    ];
    // Position/location settings are per-platform (Steam vs Epic); getBadgePosition/getSectionLocation
    // resolve to the current page's platform, the ...For() variants take an explicit platform name so
    // the settings UI can edit both regardless of which site is currently open.
    NS.PLATFORMS = ["Steam", "Epic"];
    function currentPlatform() { return NS.IS_STEAM ? "Steam" : NS.IS_EPIC ? "Epic" : ""; }
    NS.getBadgePositionFor = platform => NS.storage.getSync("badgePosition" + platform, "default");
    NS.setBadgePositionFor = (platform, value) => NS.storage.set("badgePosition" + platform, value);
    NS.getBadgePosition = () => NS.getBadgePositionFor(currentPlatform());
    NS.setBadgePosition = value => NS.setBadgePositionFor(currentPlatform(), value);
    // Per-site enable/disable — checked once at the top of NS.init().
    NS.getSiteEnabled = platform => NS.storage.getSync("enabled" + platform, true);
    NS.setSiteEnabled = (platform, value) => NS.storage.set("enabled" + platform, value);
    NS.isEnabledForCurrentSite = () => NS.getSiteEnabled(currentPlatform());
    // Placement sharing: on writes one set of placement controls to both platforms; off gives each
    // enabled site its own column. getVisiblePlatforms() is what the settings UI renders columns for.
    NS.getPlacementShared = () => NS.storage.getSync("placementShared", false);
    NS.setPlacementShared = value => NS.storage.set("placementShared", value);
    NS.getEnabledPlatforms = () => NS.PLATFORMS.filter(p => NS.getSiteEnabled(p));
    NS.getVisiblePlatforms = () => { const enabled = NS.getEnabledPlatforms(); return NS.getPlacementShared() ? enabled.slice(0, 1) : enabled; };
    // Independent placement for HLTB / Leisure: 'inline' (default, inside the main badge) or any of
    // the positions above, rendered as their own element.
    NS.LOCATION_OPTIONS = [{ value: "inline", label: "Inline (Default)" }, ...NS.BADGE_POSITION_OPTIONS];
    NS.getSectionLocationFor = (key, platform) => NS.storage.getSync(key + "Location" + platform, "inline");
    NS.setSectionLocationFor = (key, platform, value) => NS.storage.set(key + "Location" + platform, value);
    NS.getSectionLocation = key => NS.getSectionLocationFor(key, currentPlatform());
    NS.setSectionLocation = (key, value) => NS.setSectionLocationFor(key, currentPlatform(), value);
    NS.getUserOverrides = () => NS.storage.getSync("userTitleOverrides", {});
    NS.setUserOverrides = overridesObj => NS.storage.set("userTitleOverrides", overridesObj);
    NS.setUserOverride = function setUserOverride(title, ignUrl, hltbUrl) {
        const key = title.trim().toLowerCase();
        if (!key) return;
        const all = NS.getUserOverrides();
        all[key] = { displayTitle: title.trim(), ignUrl: ignUrl ? ignUrl.trim() : "", hltbUrl: hltbUrl ? hltbUrl.trim() : "" };
        NS.setUserOverrides(all);
    };
    NS.removeUserOverride = function removeUserOverride(key) { const all = NS.getUserOverrides(); delete all[key]; NS.setUserOverrides(all); };
    NS.getUserOverrideForTitle = title => NS.getUserOverrides()[title.trim().toLowerCase()] || null;
    const menuCommandIds = {};
    const menuLabel = key => `${NS.getConfig(key) ? "✅" : "⬜"} ${CONFIG_KEYS[key]}`;
    NS.registerMenuCommands = function registerMenuCommands() {
        if (typeof GM_registerMenuCommand === "undefined") return;
        const canUnregister = typeof GM_unregisterMenuCommand !== "undefined";
        for (const key of Object.keys(CONFIG_KEYS)) {
            if (canUnregister && menuCommandIds[key] !== undefined) GM_unregisterMenuCommand(menuCommandIds[key]);
            menuCommandIds[key] = GM_registerMenuCommand(menuLabel(key), () => NS.toggleConfig(key));
        }
    };
    NS.toggleConfig = function toggleConfig(key) { NS.storage.set(key, !NS.getConfig(key)); NS.registerMenuCommands(); };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
