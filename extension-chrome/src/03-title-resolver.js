(function(NS) {
    "use strict";
    // Explicit multi-game bundle listings: a single Steam page that bundles two
    // (or more) separate IGN entries. Not slug-guessing - these slugs are
    // hand-verified, not derived from the title text.
    NS.BUNDLE_TITLE_OVERRIDES = {
        "metal gear & metal gear 2: solid snake": [
            { name: "Metal Gear", slug: "metal-gear" },
            { name: "Metal Gear 2: Solid Snake", slug: "metal-gear-2-solid-snake" }
        ]
    };
    // Alternate search terms for titles whose Steam/store name diverges enough
    // from IGN's own naming that a name-similarity search on the store title
    // alone won't confidently find it (sequel numbering resets, rebrands,
    // early-access-era names, etc). These are fed into the search API as
    // additional queries - never used to construct a URL directly.
    const TITLE_ALIASES = {
        "counter-strike 2": ["counter-strike: global offensive", "counter-strike"], cs2: ["counter-strike: global offensive"],
        "overwatch 2": ["overwatch"], "ea sports fc 24": ["fifa 24", "fifa 23"], "eafc 24": ["fifa 24"],
        "final fantasy vii remake intergrade": ["final fantasy vii remake"], "jurassic world evolution 3: rebirth expansion": ["jurassic world evolution 3"],
        "conan exiles enhanced: isle of siptah": ["conan exiles"], "ratchet & clank: rift apart": ["ratchet and clank rift apart"],
        "brütal legend": ["brutal legend"], "brutal legend": ["brütal legend"],
        "guilty gear xrd rev 2": ["guilty gear xrd revelator 2"], "guilty gear": ["guilty gear 1998"],
        "grand theft auto v": ["grand theft auto 5", "gta v", "gta 5"], "nioh 2 the complete edition": ["nioh 2"],
        "ninja gaiden 3": ["ninja gaiden iii"], "ninja gaiden 3: razor's edge": ["ninja gaiden iii razor's edge"],
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": ["ninja gaiden iii razor's edge"]
    };
    NS.TITLE_ALIASES = TITLE_ALIASES;
    // Additional search terms to try (in order) for a given store title, on
    // top of the title itself. Empty array if none defined.
    NS.getTitleAliases = function getTitleAliases(title) {
        return TITLE_ALIASES[title.toLowerCase().trim()] || [];
    };
    NS.stripCollectionBracket = function stripCollectionBracket(title) {
        const match = title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i);
        return match ? match[1].trim() : null;
    };
    NS.sigmaLetterFallbackTitle = function sigmaLetterFallbackTitle(title) {
        if (!/[Σσς]/.test(title)) return null;
        return title.replace(/[Σσς](\d)/g, "S$1").replace(/[Σσς]/g, "S");
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
