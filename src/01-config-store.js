(function(NS) {
    "use strict";
    const CONFIG_KEYS = {
        showIgnScore: "Show IGN Score", showUserRating: "Show User Rating", showReviewGrading: "Show Review Grading",
        showReview: "Show Review Summary", showSteamReviews: "Show Steam Reviews",
        showAward: "Show IGN Award / Leaderboard", showEsrb: "Show ESRB Rating & Descriptors", showDeveloper: "Show Developer",
        showPublisher: "Show Publisher", showGenres: "Show Genres", showPlatforms: "Show Platforms", showFeatures: "Show Features",
        showDescription: "Show Game Description", showHltb: "Show HowLongToBeat", showLeisure: "Show HLTB Leisure Times",
        showHltbSearchFallback: "Search HowLongToBeat Link When No Data Found"
    };
    const CONFIG_DEFAULTS = {
        showIgnScore: true, showUserRating: true, showReviewGrading: true, showReview: true, showSteamReviews: true, showAward: true,
        showEsrb: true, showDeveloper: false, showPublisher: false, showGenres: true, showPlatforms: true, showFeatures: false,
        showDescription: true, showHltb: true, showLeisure: true, showHltbSearchFallback: true
    };
    NS.CONFIG_KEYS = CONFIG_KEYS;
    NS.CONFIG_DEFAULTS = CONFIG_DEFAULTS;
    NS.PLATFORMS = ["Steam", "Epic"];
    function currentPlatform() { return NS.IS_STEAM ? "Steam" : NS.IS_EPIC ? "Epic" : ""; }
    // "Show ..." toggles are stored per-platform (same pattern as badgePosition below) so Steam and
    // Epic can have entirely different visible sections when NOT using shared settings. Reading
    // always resolves through the current page's own platform; "shared" is enforced at write time
    // (see NS.getSettingsShared() below) by writing the same value to both platforms' keys, so
    // reading either one back gives the same answer regardless of which is currently open.
    NS.getConfigFor = (key, platform) => NS.storage.getSync(key + platform, CONFIG_DEFAULTS[key]);
    NS.setConfigFor = (key, platform, value) => NS.storage.set(key + platform, value);
    NS.getConfig = key => NS.getConfigFor(key, currentPlatform());
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
    NS.getSectionOrderFor = function getSectionOrderFor(platform) {
        const stored = NS.storage.getSync("sectionOrder" + platform, null);
        if (!Array.isArray(stored) || stored.length === 0) return [ ...DEFAULT_SECTION_ORDER ];
        const known = stored.filter(key => DEFAULT_SECTION_ORDER.includes(key));
        return [ ...known, ...DEFAULT_SECTION_ORDER.filter(key => !known.includes(key)) ];
    };
    NS.setSectionOrderFor = (platform, order) => NS.storage.set("sectionOrder" + platform, order);
    NS.getSectionOrder = () => NS.getSectionOrderFor(currentPlatform());
    NS.setSectionOrder = order => NS.setSectionOrderFor(currentPlatform(), order);
    // Position/location settings are per-platform (Steam vs Epic); getBadgePosition/getSectionLocation
    // resolve to the current page's platform, the ...For() variants take an explicit platform name so
    // the settings UI can edit both regardless of which site is currently open.
    NS.BADGE_POSITION_OPTIONS = [
        { value: "default", label: "Default" }, { value: "aboveTitle", label: "Above Game Title" },
        { value: "belowGameMedia", label: "Below Game Media" },
        { value: "abovePrice", label: "Steam: Above Game Price | Epic: Above Game Description" },
        { value: "belowLeftSidebar", label: "Bottom of Left Sidebar" },
        { value: "aboveRightSidebarMetadata", label: "Above Right Side Metadata" },
        { value: "belowRightSidebarMetadata", label: "Below Right Side Metadata" },
        { value: "sidebarBottom", label: "Bottom of Right Sidebar" }
    ];
    NS.getBadgePositionFor = platform => NS.storage.getSync("badgePosition" + platform, "default");
    NS.setBadgePositionFor = (platform, value) => NS.storage.set("badgePosition" + platform, value);
    NS.getBadgePosition = () => NS.getBadgePositionFor(currentPlatform());
    NS.setBadgePosition = value => NS.setBadgePositionFor(currentPlatform(), value);
    // Per-site enable/disable — checked once at the top of NS.init().
    NS.getSiteEnabled = platform => NS.storage.getSync("enabled" + platform, true);
    NS.setSiteEnabled = (platform, value) => NS.storage.set("enabled" + platform, value);
    NS.isEnabledForCurrentSite = () => NS.getSiteEnabled(currentPlatform());
    // Whether Steam and Epic use one shared configuration or each get their own: governs Visible
    // Sections, Section Order, Separate Entry/Location, Overlay Position, and Combine All. When on,
    // Save writes the same value to both platforms' storage keys; when off, each platform keeps its
    // own independent copy (edited via the settings panel's Steam/Epic pager). Per-title IGN/HLTB
    // overrides are NOT part of this — they're global by nature, not platform-specific, and are
    // unaffected either way. (Storage key kept as "placementShared" from before this setting's scope
    // broadened, to avoid resetting anyone's already-saved preference.)
    NS.getSettingsShared = () => NS.storage.getSync("placementShared", false);
    NS.setSettingsShared = value => NS.storage.set("placementShared", value);
    NS.getEnabledPlatforms = () => NS.PLATFORMS.filter(p => NS.getSiteEnabled(p));
    NS.getVisiblePlatforms = () => { const enabled = NS.getEnabledPlatforms(); return NS.getSettingsShared() ? enabled.slice(0, 1) : enabled; };
    // Independent placement for HLTB / Leisure: 'inline' (default, inside the main badge) or any of
    // the positions above, rendered as their own element.
    NS.LOCATION_OPTIONS = [{ value: "inline", label: "Inline (Default)" }, ...NS.BADGE_POSITION_OPTIONS];
    // HLTB/Leisure default to "Below Game Media" rather than inline like everything else, since
    // their stat-block layout reads better as its own element than folded into the main badge.
    const DEFAULT_SECTION_LOCATIONS = { hltb: "belowGameMedia", leisure: "belowGameMedia" };
    NS.getSectionLocationFor = (key, platform) => NS.storage.getSync(key + "Location" + platform, DEFAULT_SECTION_LOCATIONS[key] || "inline");
    NS.setSectionLocationFor = (key, platform, value) => NS.storage.set(key + "Location" + platform, value);
    // "Combine all entries in one place": a per-platform override that, when on, forces EVERY
    // section (regardless of its own individually-configured Location) to the same spot as the
    // main badge's own Overlay Position instead - the existing "combine sections that share a
    // Location" rendering behavior then naturally merges all of them together since they now all
    // resolve to the same spot. Turning it back off simply stops overriding, restoring whatever
    // each section's own Location was already set to (nothing is overwritten in storage). This
    // deliberately reuses Overlay Position rather than having its own separate location picker -
    // that used to exist, but sitting right next to Overlay Position with near-identical choices
    // made it look like an accidental duplicate control rather than a distinct setting.
    NS.getCombineAllFor = platform => NS.storage.getSync("combineAll" + platform, false);
    NS.setCombineAllFor = (platform, value) => NS.storage.set("combineAll" + platform, value);
    NS.getCombineAll = () => NS.getCombineAllFor(currentPlatform());
    NS.getSectionLocation = key => {
        const platform = currentPlatform();
        return NS.getCombineAllFor(platform) ? NS.getBadgePositionFor(platform) : NS.getSectionLocationFor(key, platform);
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
    NS.toggleConfig = function toggleConfig(key) {
        const platform = currentPlatform();
        const newValue = !NS.getConfigFor(key, platform);
        const targets = NS.getSettingsShared() ? NS.PLATFORMS : [platform];
        targets.forEach(p => NS.setConfigFor(key, p, newValue));
        NS.registerMenuCommands();
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
