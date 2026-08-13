(function(NS) {
    "use strict";
    const CONFIG_KEYS = {
        showIgnScore: "Show IGN Score", showUserRating: "Show User Rating", showReviewGrading: "Show Review Grading",
        showReview: "Show Review Summary", showSteamReviews: "Show Steam Reviews",
        showAward: "Show IGN Award / Leaderboard", showEsrb: "Show ESRB Rating & Descriptors", showDeveloper: "Show Developer",
        showPublisher: "Show Publisher", showGenres: "Show Genres", showPlatforms: "Show Platforms", showFeatures: "Show Features",
        showDescription: "Show Game Description", showHltb: "Show HowLongToBeat", showLeisure: "Show HLTB Leisure Times"
    };
    const CONFIG_DEFAULTS = {
        showIgnScore: true, showUserRating: true, showReviewGrading: true, showReview: true, showSteamReviews: true, showAward: true,
        showEsrb: true, showDeveloper: false, showPublisher: false, showGenres: true, showPlatforms: true, showFeatures: false,
        showDescription: true, showHltb: true, showLeisure: true
    };
    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
    NS.getConfig = key => NS.storage.getSync(key, CONFIG_DEFAULTS[key]);
    const SECTION_LABELS = {
        scores: "IGN Score / User Rating", reviewGrading: "Review Grading", review: "Review Summary", steamReviews: "Steam Reviews", award: "Leaderboard Rank",
        esrb: "ESRB Rating", developer: "Developer", publisher: "Publisher", genres: "Genres", platforms: "Platforms", features: "Features", description: "Game Description",
        hltb: "HowLongToBeat", leisure: "HLTB Leisure Time"
    };
    // Which "Show ..." config toggle(s) a given section corresponds to — almost always one, except
    // "scores" which folds two independently-toggleable rows (IGN Score, User Rating) into a single
    // order-list row. Drives the merged Visible/Separate/Section-Order list in the settings UI: a
    // row's "Visible" checkbox reads as checked if any of its keys are on, and toggling it writes
    // that same state to all of them.
    const SECTION_CONFIG_KEYS = {
        scores: ["showIgnScore", "showUserRating"], reviewGrading: ["showReviewGrading"], review: ["showReview"],
        steamReviews: ["showSteamReviews"], award: ["showAward"], esrb: ["showEsrb"], developer: ["showDeveloper"],
        publisher: ["showPublisher"], genres: ["showGenres"], platforms: ["showPlatforms"], features: ["showFeatures"],
        description: ["showDescription"], hltb: ["showHltb"], leisure: ["showLeisure"]
    };
    const DEFAULT_SECTION_ORDER = [ "scores", "reviewGrading", "award", "review", "steamReviews", "esrb", "developer", "publisher", "genres", "platforms", "features", "description", "hltb", "leisure" ];
    NS.SECTION_LABELS = SECTION_LABELS;
    NS.SECTION_CONFIG_KEYS = SECTION_CONFIG_KEYS;
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
        { value: "belowLeftSidebar", label: "Bottom of Left Sidebar" },
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
    // HLTB/Leisure default to "Below Game Media" rather than inline like everything else, since
    // their stat-block layout reads better as its own element than folded into the main badge.
    const DEFAULT_SECTION_LOCATIONS = { hltb: "belowGameMedia", leisure: "belowGameMedia" };
    NS.getSectionLocationFor = (key, platform) => NS.storage.getSync(key + "Location" + platform, DEFAULT_SECTION_LOCATIONS[key] || "inline");
    NS.setSectionLocationFor = (key, platform, value) => NS.storage.set(key + "Location" + platform, value);
    // "Combine all entries in one place": a per-platform override that, when on, forces EVERY
    // section (regardless of its own individually-configured Location) to the single chosen
    // combineLocation instead — the existing "combine sections that share a Location" rendering
    // behavior then naturally merges all of them together since they now all resolve to the same
    // spot. Turning it back off simply stops overriding, restoring whatever each section's own
    // Location was already set to (nothing is overwritten in storage).
    NS.getCombineAllFor = platform => NS.storage.getSync("combineAll" + platform, false);
    NS.setCombineAllFor = (platform, value) => NS.storage.set("combineAll" + platform, value);
    NS.getCombineAll = () => NS.getCombineAllFor(currentPlatform());
    NS.getCombineLocationFor = platform => NS.storage.getSync("combineLocation" + platform, "belowGameMedia");
    NS.setCombineLocationFor = (platform, value) => NS.storage.set("combineLocation" + platform, value);
    NS.getCombineLocation = () => NS.getCombineLocationFor(currentPlatform());
    NS.getSectionLocation = key => {
        const platform = currentPlatform();
        return NS.getCombineAllFor(platform) ? NS.getCombineLocationFor(platform) : NS.getSectionLocationFor(key, platform);
    };
    NS.setSectionLocation = (key, value) => NS.setSectionLocationFor(key, currentPlatform(), value);
    // Relative order between two or more sections that end up sharing the exact same non-inline
    // Location (e.g. HLTB + Leisure Time, or any other pair/group) is no longer tracked by its own
    // separate storage — it's simply their relative order in NS.getSectionOrder(), the same list
    // that already controls everything else. See placeSimpleSections()/placeLeisureAndFinalize() in
    // 05-badge-render.js.
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
