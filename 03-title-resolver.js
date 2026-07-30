// ===================================================================
// IGN Rating Badge — 03: Title -> IGN slug resolution
// ===================================================================
// Everything about turning a store title into candidate IGN URL slugs
// lives here: unicode/edition cleanup, Roman numeral swaps, the bundle
// and alias override tables, and the final buildCandidateSlugs() that
// the fetch orchestrator calls. Nothing here touches the network or the
// DOM — add a new alias/override here without worrying about fetch or
// render code, and vice versa.
(function (NS) {
    'use strict';

    // Bundle titles: Steam lists these as one product, but they're two distinct games on
    // IGN with their own pages/scores. Detecting this generically from "&" is too risky (plenty
    // of single games legitimately have "&" in their own name, e.g. "Ratchet & Clank"), so this
    // is a curated, explicit list — add more entries here as you run into them.
    NS.BUNDLE_TITLE_OVERRIDES = {
        'metal gear & metal gear 2: solid snake': [
            { name: 'Metal Gear', slug: 'metal-gear' },
            { name: 'Metal Gear 2: Solid Snake', slug: 'metal-gear-2-solid-snake' }
        ]
    };

    // Title aliases: abbreviations / release-year variants / IGN slug mismatches that our
    // automatic slug-guessing can't derive on its own. Add more entries here as you run into
    // them — this is the fastest fix for "this one specific title doesn't resolve."
    const TITLE_ALIASES = {
        'counter-strike 2': ['counter-strike: global offensive', 'counter-strike'],
        'cs2': ['counter-strike: global offensive'],
        'overwatch 2': ['overwatch'],
        'ea sports fc 24': ['fifa 24', 'fifa 23'],
        'eafc 24': ['fifa 24'],
        'final fantasy vii remake intergrade': ['final fantasy vii remake'],
        'jurassic world evolution 3: rebirth expansion': ['jurassic world evolution 3'],
        'conan exiles enhanced: isle of siptah': ['conan exiles'],
        'ratchet & clank: rift apart': ['ratchet and clank rift apart'],
        'brütal legend': ['brutal legend', 'brtal-legend'],
        'brutal legend': ['brtal-legend'],
        'guilty gear xrd rev 2': ['guilty gear xrd revelator 2'],
        'guilty gear': ['guilty-gear-1998'],
        'grand theft auto v': ['grand theft auto 5', 'gta v', 'gta 5'],
        'nioh 2': ['nioh 2'],
        'nioh 2 the complete edition': ['nioh 2'],
        // IGN uses the roman-numeral form for these Ninja Gaiden titles; the auto Roman
        // conversion produces "ninja gaiden iii" but IGN's own slug drops the apostrophe in
        // "razor's edge" as "razors-edge" rather than "razor-s-edge" (handled generically now
        // by apostrophe stripping below, kept here too as a guaranteed fallback).
        'ninja gaiden 3': ['ninja gaiden iii'],
        "ninja gaiden 3: razor's edge": ['ninja gaiden iii razors edge'],
        "ninja gaiden 3: razor's edge [ninja gaiden: master collection]": ['ninja gaiden iii razors edge']
    };
    NS.TITLE_ALIASES = TITLE_ALIASES;

    // ---- Slug generation ----
    function slugify(str) {
        return str
            .replace(/'/g, '') // strip apostrophes instead of turning them into hyphens
            // ("Razor's Edge" -> "razors-edge", matching IGN's own slugs, not "razor-s-edge")
            .replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    }

    function createIgnSlugs(title) {
        const noPeriods = title.replace(/\./g, '');

        let cleaned = noPeriods
            .replace(/[™®©]/g, '')
            .replace(/[’‘]/g, "'").replace(/[–—]/g, '-')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ü/g, 'u').replace(/Ü/g, 'u')
            .replace(/ä/g, 'a').replace(/Ä/g, 'a')
            .replace(/ö/g, 'o').replace(/Ö/g, 'o')
            .replace(/ß/g, 'ss')
            .replace(/[Σσς](\d)/g, 'Sigma $1')
            .replace(/[Σσς]/g, 'Sigma')
            .replace(/Δ/g, 'delta')
            .replace(/Ω/g, 'omega');

        cleaned = cleaned
            // Optional leading "The" is swallowed along with the edition keyword so it doesn't
            // get left dangling (e.g. "Nioh 2 – The Complete Edition" -> "Nioh 2", not "Nioh 2 – The").
            .replace(/\b(the\s+)?(ultimate|deluxe|game of the year|goty|standard|digital deluxe|complete|definitive|enhanced|remastered|director's cut|anniversary)\s*(edition)?\b/gi, '')
            .replace(/\s*[:|]\s*(rebirth|expansion|dlc|season pass|enhanced|isle of .*)\s*\w*/gi, '')
            .replace(/[–—-]\s*$/g, '') // dangling dash left behind after an edition phrase is stripped
            .trim();

        const slug = slugify(cleaned);
        const primarySlug = slug.replace(/&/g, 'and');
        const secondarySlug = slug.replace(/&/g, '');

        const noPrefix = cleaned.replace(/^[a-z0-9]{2,4}\s+/i, '');
        const tertiarySlug = (noPrefix !== cleaned && noPrefix.length > 0)
            ? slugify(noPrefix).replace(/&/g, 'and')
            : null;

        const aggressiveDropSlug = slugify(noPeriods.replace(/[^\x00-\x7F]/g, ''));

        return {
            primarySlug,
            secondarySlug,
            tertiarySlug,
            aggressiveDropSlug: (aggressiveDropSlug !== primarySlug) ? aggressiveDropSlug : null
        };
    }

    function slugsToList(slugsObj) {
        return [slugsObj.primarySlug, slugsObj.secondarySlug, slugsObj.tertiarySlug, slugsObj.aggressiveDropSlug].filter(Boolean);
    }

    // ---- Roman numeral conversion (IGN's slugs aren't consistent about which form they use) ----
    function toRoman(num) {
        const table = [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
        let n = num, result = '';
        for (const [value, numeral] of table) {
            while (n >= value) { result += numeral; n -= value; }
        }
        return result;
    }

    const ROMAN_LOOKUP = {};
    for (let n = 1; n <= 50; n++) ROMAN_LOOKUP[toRoman(n).toLowerCase()] = n;

    // Converts Arabic numerals to Roman, including decimal "edition" numbers like "1.5" -> "I.5"
    // (done in a single pass so the ".5" isn't re-matched as its own standalone integer afterward).
    function arabicToRomanVariant(title) {
        return title.replace(/\b(\d{1,2})\.5\b|\b(\d{1,2})\b/g, (match, decimalPart, intPart) => {
            if (decimalPart !== undefined) return `${toRoman(parseInt(decimalPart, 10))}.5`;
            const num = parseInt(intPart, 10);
            return (num >= 1 && num <= 50) ? toRoman(num) : match;
        });
    }

    // Converts whole-word Roman numerals back to Arabic (e.g. "III" -> "3")
    function romanToArabicVariant(title) {
        return title.replace(/\b[a-zA-Z]+\b/g, (word) => {
            const key = word.toLowerCase();
            return ROMAN_LOOKUP.hasOwnProperty(key) ? String(ROMAN_LOOKUP[key]) : word;
        });
    }

    // Generates alternate spellings of a title to compensate for IGN's inconsistent formatting:
    // stylistic dash-wrapped subtitles, "(DLC)" tags, "+" meaning either "and" or nothing, and
    // Roman/Arabic numeral mismatches. Every variant is later run through createIgnSlugs().
    function generateTitleVariants(title) {
        const variants = new Set([title]);

        // "Title -Subtitle-" -> "Title Subtitle" (a stylistic wrap some publishers use)
        const dashUnwrapped = title.replace(/\s-([^-]+)-\s*$/i, ' $1').trim();
        if (dashUnwrapped !== title) variants.add(dashUnwrapped);

        // Drop "(DLC)" tags entirely
        for (const base of [...variants]) {
            const noDlc = base.replace(/\(\s*dlc\s*\)/gi, '').replace(/\s+/g, ' ').trim();
            if (noDlc !== base) variants.add(noDlc);
        }

        // "+" sometimes means "and" (bundles), sometimes means nothing (base + DLC name)
        for (const base of [...variants]) {
            if (base.includes('+')) {
                variants.add(base.replace(/\s*\+\s*/g, ' and ').replace(/\s+/g, ' ').trim());
                variants.add(base.replace(/\s*\+\s*/g, ' ').replace(/\s+/g, ' ').trim());
            }
        }

        // Roman <-> Arabic numeral swaps
        for (const base of [...variants]) {
            const romanVariant = arabicToRomanVariant(base);
            if (romanVariant !== base) variants.add(romanVariant);
            const arabicVariant = romanToArabicVariant(base);
            if (arabicVariant !== base) variants.add(arabicVariant);
        }

        return [...variants];
    }

    // "NINJA GAIDEN Σ2 [NINJA GAIDEN: Master Collection]" -> the real game name is what's
    // before the bracket; the bracket just tags which larger collection it ships as part of.
    NS.stripCollectionBracket = function stripCollectionBracket(title) {
        const match = title.match(/^(.*?)\s*\[[^\]]*collection[^\]]*\]\s*$/i);
        return match ? match[1].trim() : null;
    };

    // Some titles use a Greek letter (e.g. "Σ") that Steam/Epic's own URL slug transliterates
    // to a plain letter (e.g. "S"), while IGN instead spells it as a word ("Sigma"). We already
    // try the spelled-out word as the primary approach (see createIgnSlugs); this generates the
    // literal-letter variant as a last-resort fallback, matching how the store URL does it.
    NS.sigmaLetterFallbackTitle = function sigmaLetterFallbackTitle(title) {
        if (!/[Σσς]/.test(title)) return null;
        return title.replace(/[Σσς](\d)/g, 'S$1').replace(/[Σσς]/g, 'S');
    };

    NS.buildCandidateSlugs = function buildCandidateSlugs(gameTitle) {
        let slugs = [];
        for (const variant of generateTitleVariants(gameTitle)) {
            slugs = slugs.concat(slugsToList(createIgnSlugs(variant)));
        }

        const lowerTitle = gameTitle.toLowerCase().trim();
        if (TITLE_ALIASES.hasOwnProperty(lowerTitle)) {
            for (const alias of TITLE_ALIASES[lowerTitle]) {
                if (!alias.includes(' ')) slugs.push(alias);
                for (const aliasVariant of generateTitleVariants(alias)) {
                    slugs = slugs.concat(slugsToList(createIgnSlugs(aliasVariant)));
                }
            }
        }

        return [...new Set(slugs)];
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
