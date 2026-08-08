(function(NS) {
    "use strict";
    NS.BUNDLE_TITLE_OVERRIDES = {
        "metal gear & metal gear 2: solid snake": [
            { name: "Metal Gear", slug: "metal-gear" },
            { name: "Metal Gear 2: Solid Snake", slug: "metal-gear-2-solid-snake" }
        ]
    };
    const TITLE_ALIASES = {
        "counter-strike 2": ["counter-strike: global offensive", "counter-strike"], cs2: ["counter-strike: global offensive"],
        "overwatch 2": ["overwatch"], "ea sports fc 24": ["fifa 24", "fifa 23"], "eafc 24": ["fifa 24"],
        "final fantasy vii remake intergrade": ["final fantasy vii remake"], "jurassic world evolution 3: rebirth expansion": ["jurassic world evolution 3"],
        "conan exiles enhanced: isle of siptah": ["conan exiles"], "ratchet & clank: rift apart": ["ratchet and clank rift apart"],
        "brütal legend": ["brutal legend", "brtal-legend"], "brutal legend": ["brtal-legend"],
        "guilty gear xrd rev 2": ["guilty gear xrd revelator 2"], "guilty gear": ["guilty-gear-1998"],
        "grand theft auto v": ["grand theft auto 5", "gta v", "gta 5"], "nioh 2": ["nioh 2"], "nioh 2 the complete edition": ["nioh 2"],
        "ninja gaiden 3": ["ninja gaiden iii"], "ninja gaiden 3: razor's edge": ["ninja gaiden iii razors edge"],
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": ["ninja gaiden iii razors edge"]
    };
    NS.TITLE_ALIASES = TITLE_ALIASES;
    const slugify = str => str.replace(/'/g, "").replace(/[^a-z0-9]/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    function createIgnSlugs(title) {
        const noPeriods = title.replace(/\./g, "");
        let cleaned = noPeriods.replace(/[™®©]/g, "").replace(/[’‘]/g, "'").replace(/[–—]/g, "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/ü/g, "u").replace(/Ü/g, "u").replace(/ä/g, "a").replace(/Ä/g, "a").replace(/ö/g, "o").replace(/Ö/g, "o").replace(/ß/g, "ss")
            .replace(/[Σσς](\d)/g, "Sigma $1").replace(/[Σσς]/g, "Sigma").replace(/Δ/g, "delta").replace(/Ω/g, "omega");
        cleaned = cleaned.replace(/\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, "")
            .replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi, "").replace(/[–—-]\s*$/g, "").trim();
        const slug = slugify(cleaned);
        const primarySlug = slug.replace(/&/g, "and");
        const secondarySlug = slug.replace(/&/g, "");
        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, "");
        const tertiarySlug = noPrefix !== cleaned && noPrefix.length > 0 ? slugify(noPrefix).replace(/&/g, "and") : null;
        const aggressiveDropSlug = slugify(noPeriods.replace(/[^\x00-\x7F]/g, ""));
        return { primarySlug, secondarySlug, tertiarySlug, aggressiveDropSlug: aggressiveDropSlug !== primarySlug ? aggressiveDropSlug : null };
    }
    const slugsToList = s => [ s.primarySlug, s.secondarySlug, s.tertiarySlug, s.aggressiveDropSlug ].filter(Boolean);
    function toRoman(num) {
        const table = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
        let n = num, result = "";
        for (const [value, numeral] of table) while (n >= value) { result += numeral; n -= value; }
        return result;
    }
    const ROMAN_LOOKUP = {};
    for (let n = 1; n <= 50; n++) ROMAN_LOOKUP[toRoman(n).toLowerCase()] = n;
    const arabicToRomanVariant = title => title.replace(/\b(\d{1,2})\.5\b|\b(\d{1,2})\b/g, (match, decimalPart, intPart) => {
        if (decimalPart !== undefined) return `${toRoman(parseInt(decimalPart, 10))}.5`;
        const num = parseInt(intPart, 10);
        return num >= 1 && num <= 50 ? toRoman(num) : match;
    });
    const romanToArabicVariant = title => title.replace(/\b[a-zA-Z]+\b/g, word => {
        const key = word.toLowerCase();
        return ROMAN_LOOKUP.hasOwnProperty(key) ? String(ROMAN_LOOKUP[key]) : word;
    });
    function generateTitleVariants(title) {
        const variants = new Set([title]);
        const dashUnwrapped = title.replace(/\s-([^-]+)-\s*$/i, " $1").trim();
        if (dashUnwrapped !== title) variants.add(dashUnwrapped);
        for (const base of [...variants]) { const noDlc = base.replace(/\(\s*dlc\s*\)/gi, "").replace(/\s+/g, " ").trim(); if (noDlc !== base) variants.add(noDlc); }
        for (const base of [...variants]) {
            if (!base.includes("+")) continue;
            variants.add(base.replace(/\s*\+\s*/g, " and ").replace(/\s+/g, " ").trim());
            variants.add(base.replace(/\s*\+\s*/g, " ").replace(/\s+/g, " ").trim());
        }
        for (const base of [...variants]) {
            const romanVariant = arabicToRomanVariant(base), arabicVariant = romanToArabicVariant(base);
            if (romanVariant !== base) variants.add(romanVariant);
            if (arabicVariant !== base) variants.add(arabicVariant);
        }
        return [...variants];
    }
    NS.stripCollectionBracket = function stripCollectionBracket(title) {
        const match = title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i);
        return match ? match[1].trim() : null;
    };
    NS.sigmaLetterFallbackTitle = function sigmaLetterFallbackTitle(title) {
        if (!/[Σσς]/.test(title)) return null;
        return title.replace(/[Σσς](\d)/g, "S$1").replace(/[Σσς]/g, "S");
    };
    NS.buildCandidateSlugs = function buildCandidateSlugs(gameTitle) {
        let slugs = [];
        for (const variant of generateTitleVariants(gameTitle)) slugs = slugs.concat(slugsToList(createIgnSlugs(variant)));
        const lowerTitle = gameTitle.toLowerCase().trim();
        for (const alias of TITLE_ALIASES[lowerTitle] || []) {
            if (!alias.includes(" ")) slugs.push(alias);
            for (const aliasVariant of generateTitleVariants(alias)) slugs = slugs.concat(slugsToList(createIgnSlugs(aliasVariant)));
        }
        return [ ...new Set(slugs) ];
    };
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
