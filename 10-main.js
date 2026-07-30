// ===================================================================
// IGN Rating Badge — 10: Bootstrapping
// ===================================================================
// The only file that runs anything at load time. Wires up: which title
// variants to try and in what order (init), watching the page for SPA-style
// content changes (MutationObserver), and registering the Tampermonkey
// menu commands. Everything it calls (NS.fetchIGNData, NS.getGameTitle,
// NS.stripCollectionBracket, NS.sigmaLetterFallbackTitle, NS.openSettingsPanel)
// is defined in earlier files, so this file only ever changes when the
// bootstrapping *sequence* itself needs to change.
(function (NS) {
    'use strict';

    // Tries each title in order, only moving to the next once the previous one has completely
    // exhausted every resolution method (slug guesses, DLC fallback, search, package items).
    function fetchWithTitleChain(titles) {
        function attempt(index) {
            if (index >= titles.length) return;
            const isLast = index === titles.length - 1;
            NS.fetchIGNData(titles[index], { onExhausted: isLast ? null : () => attempt(index + 1) });
        }
        attempt(0);
    }

    NS.init = function init() {
        const title = NS.getGameTitle();
        if (!title) return;

        if (title !== NS.state.lastProcessedTitle) {
            NS.state.lastProcessedTitle = title;
            document.querySelector('.ign_rating_row')?.remove();
        }

        if (document.querySelector('.ign_rating_row') || NS.state.isFetching) return;

        // "Title [Some Collection]" -> the real game name is what precedes the bracket, so
        // prefer that; only fall back to the raw title (brackets included) if it fails outright.
        const titleAttempts = [];
        const strippedTitle = NS.stripCollectionBracket(title);
        if (strippedTitle) titleAttempts.push(strippedTitle);
        titleAttempts.push(title);

        // If a Sigma symbol is present, add one final fallback using a plain "S" in its place —
        // matching how the Steam/Epic URL itself transliterates it — in case the spelled-out
        // "Sigma" form (tried first, via createIgnSlugs) doesn't match anything.
        const sigmaFallback = NS.sigmaLetterFallbackTitle(strippedTitle || title);
        if (sigmaFallback) titleAttempts.push(sigmaFallback);

        fetchWithTitleChain(titleAttempts);
    };

    if (typeof GM_registerMenuCommand !== 'undefined') {
        NS.registerMenuCommands();
        GM_registerMenuCommand('⚙️ Open Settings Panel', NS.openSettingsPanel);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', NS.init);
    } else {
        NS.init();
    }

    const observer = new MutationObserver(() => {
        clearTimeout(NS.state.debounceTimer);
        NS.state.debounceTimer = setTimeout(NS.init, 250);
    });
    observer.observe(document.body, { childList: true, subtree: true });

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
