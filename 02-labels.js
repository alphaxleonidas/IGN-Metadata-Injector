// ===================================================================
// IGN Rating Badge — 02: Display label normalization
// ===================================================================
// Pure lookup-table + function pairs for turning raw scraped labels into
// nicer display text. No DOM, no network — safe to edit without any risk
// of breaking scraping or rendering logic elsewhere.
(function (NS) {
    'use strict';

    // ---- ESRB rating short-code -> full display name ----
    // IGN's img alt text is sometimes just the short code ("T", "M", "E10+") rather than the
    // full name, so we normalize it ourselves instead of trusting whatever IGN gives us.
    const ESRB_FULL_NAMES = {
        'e': 'Everyone',
        'everyone': 'Everyone',
        'e10+': 'Everyone 10+',
        'e 10+': 'Everyone 10+',
        'everyone 10+': 'Everyone 10+',
        't': 'Teen',
        'teen': 'Teen',
        'm': 'Mature 17+',
        'mature': 'Mature 17+',
        'mature 17+': 'Mature 17+',
        'ao': 'Adults Only',
        'adults only': 'Adults Only',
        'rp': 'Rating Pending',
        'rating pending': 'Rating Pending'
    };

    NS.normalizeEsrbLabel = function normalizeEsrbLabel(rawLabel) {
        if (!rawLabel) return rawLabel;
        const key = rawLabel.trim().toLowerCase().replace(/^esrb:?\s*/i, '');
        return ESRB_FULL_NAMES[key] || rawLabel.trim();
    };

    // Display-only label renames for HLTB categories
    const HLTB_LABEL_OVERRIDES = {
        'main story': 'Main',
        'story + sides': 'Main + Sides'
    };

    NS.relabelHltb = function relabelHltb(label) {
        return HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()] || label;
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
