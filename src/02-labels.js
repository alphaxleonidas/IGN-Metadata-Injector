(function(NS) {
    "use strict";
    const ESRB_FULL_NAMES = {
        e: "Everyone", everyone: "Everyone", "e10+": "Everyone 10+", "e 10+": "Everyone 10+", "everyone 10+": "Everyone 10+",
        t: "Teen", teen: "Teen", m: "Mature 17+", mature: "Mature 17+", "mature 17+": "Mature 17+",
        ao: "Adults Only", "adults only": "Adults Only", rp: "Rating Pending", "rating pending": "Rating Pending"
    };
    NS.normalizeEsrbLabel = function normalizeEsrbLabel(rawLabel) {
        if (!rawLabel) return rawLabel;
        const key = rawLabel.trim().toLowerCase().replace(/^esrb:?\s*/i, "");
        return ESRB_FULL_NAMES[key] || rawLabel.trim();
    };
    const HLTB_LABEL_OVERRIDES = { "main story": "Main", "story + sides": "Main + Sides" };
    NS.relabelHltb = label => HLTB_LABEL_OVERRIDES[label.toLowerCase().trim()] || label;
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
