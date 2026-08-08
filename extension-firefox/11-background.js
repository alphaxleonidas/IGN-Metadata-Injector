// IGN Metadata Injector — 11: extension background (Chrome + Firefox)
// Clicking the toolbar icon opens the options page (no default_popup means
// a click does nothing without this listener).
// Registered at the top level, not inside an async callback — required for
// MV3 service workers, since an async listener can be missed on re-init.
// manifest.chrome.json loads this as background.service_worker; Firefox's
// MV3 uses background.scripts instead — both point at this same file.
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// Performs cross-origin fetches on behalf of the content script / options page (see
// 00-namespace.js's NS.http). Running the request here — an extension page, not
// attached to any tab — means it's never subject to a website's own CSP the way a
// content script's own fetch()/XHR can be, and it behaves identically regardless of
// which site (Steam vs Epic) asked for it. Also registered at the top level, same
// MV3-service-worker requirement as above.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "ignFetch" || typeof message.url !== "string") return false;
    fetch(message.url, { method: "GET", credentials: "omit" })
        .then(res => res.text().then(text => sendResponse({ ok: true, status: res.status, responseText: text })))
        .catch(() => sendResponse({ ok: false }));
    return true; // keep the message channel open for the async sendResponse above
});
