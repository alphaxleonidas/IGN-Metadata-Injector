(function(NS) {
    "use strict";
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
        NS.renderSettingsGearStandalone();
        if (!NS.isEnabledForCurrentSite()) return;
        if (title !== NS.state.lastProcessedTitle) {
            NS.state.lastProcessedTitle = title;
            document.querySelector(".ign_rating_row")?.remove();
        }
        if (document.querySelector(".ign_rating_row") || NS.state.isFetching) return;
        const titleAttempts = [];
        const strippedTitle = NS.stripCollectionBracket(title);
        if (strippedTitle) titleAttempts.push(strippedTitle);
        titleAttempts.push(title);
        const sigmaFallback = NS.sigmaLetterFallbackTitle(strippedTitle || title);
        if (sigmaFallback) titleAttempts.push(sigmaFallback);
        fetchWithTitleChain(titleAttempts);
    };
    NS.storage.ready.then(() => {
        NS.registerMenuCommands();
        if (typeof GM_registerMenuCommand !== "undefined") GM_registerMenuCommand("⚙️ Open Settings Panel", NS.openSettings);
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", NS.init);
        else NS.init();
        const observer = new MutationObserver(mutations => {
            const isOwnElement = node => node.nodeType === 1 && node.className && String(node.className).startsWith("ign_") || node.id && String(node.id).startsWith("ign_");
            const relevant = mutations.some(m => Array.from(m.addedNodes).some(n => !isOwnElement(n)) || Array.from(m.removedNodes).some(n => !isOwnElement(n)));
            if (!relevant) return;
            clearTimeout(NS.state.debounceTimer);
            NS.state.debounceTimer = setTimeout(NS.init, 250);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
