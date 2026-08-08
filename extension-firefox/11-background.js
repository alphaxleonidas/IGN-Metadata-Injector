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
