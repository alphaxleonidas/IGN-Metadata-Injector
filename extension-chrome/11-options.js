// IGN Metadata Injector — extension options page
// Used only when the settings page opens as a dedicated extension tab (via
// manifest.*.json's "options_ui"). Loads 00-namespace.js + 01-config-store.js
// first (see 11-options.html) and talks to window.IGN_METADATA_INJECTOR (NS)
// exactly like the content script's 06-settings-panel.js does, instead of
// hand-duplicating CONFIG_KEYS/defaults/option lists here.
(function () {
    "use strict";
    const NS = window.IGN_METADATA_INJECTOR;

    // Which platform's settings are currently being edited when NOT using
    // shared settings. Persists only for this page's lifetime (not saved) -
    // reopening the options page always starts back on the first enabled
    // platform.
    let pagerPlatform = null;
    // Live, unsaved edits per platform - kept only in memory for this page's lifetime (never
    // written to storage), so switching platforms via the pager doesn't lose whatever you were
    // mid-editing on the platform you're leaving. Only Save actually persists anything; this cache
    // is cleared after a successful Save so the next editing session starts fresh.
    let platformDrafts = {};

    function currentEnabledMap(enableList) {
        const map = {};
        enableList.querySelectorAll("input[data-site-enable]").forEach(input => { map[input.dataset.siteEnable] = input.checked; });
        return map;
    }

    function init() {
        const orderList = document.getElementById("order_list");
        const enableList = document.getElementById("enable_list");
        const sharedToggle = document.getElementById("placement_shared");
        const pager = document.getElementById("platform_pager");
        const pagerLabel = document.getElementById("pager_label");
        const pagerPrev = document.getElementById("pager_prev");
        const pagerNext = document.getElementById("pager_next");
        const positionSelects = document.getElementById("position_selects");
        const positionHeading = document.getElementById("position_heading");
        const keyLocationsWrap = document.getElementById("key_locations_wrap");
        const orderCombineHint = document.getElementById("order_combine_hint");
        const separateEntryLocationsHeading = document.getElementById("separate_entry_locations_heading");
        const sharedLocationNotes = document.getElementById("shared_location_notes");
        const combineAllToggle = document.getElementById("combine_all");
        const hltbSearchFallbackToggle = document.getElementById("hltb_search_fallback");
        const overrideList = document.getElementById("override_list");
        const overrideEmpty = document.getElementById("override_empty");
        const saveBtn = document.getElementById("save");
        const saveStatus = document.getElementById("save_status");

        function enabledPlatforms() {
            return NS.PLATFORMS.filter(p => currentEnabledMap(enableList)[p]);
        }

        // The single platform whose settings are actually shown/edited right
        // now: the only enabled one, the shared "virtual" platform, or
        // whichever the pager currently points at.
        function effectivePlatform() {
            const enabled = enabledPlatforms();
            if (enabled.length === 0) return NS.PLATFORMS[0];
            if (sharedToggle.checked || enabled.length === 1) return enabled[0];
            if (!pagerPlatform || !enabled.includes(pagerPlatform)) pagerPlatform = enabled[0];
            return pagerPlatform;
        }

        function isKeySeparate(key) { return NS.getSectionLocationFor(key, effectivePlatform()) !== "inline"; }
        function isKeyVisible(key) { return (NS.SECTION_CONFIG_KEYS[key] || []).some(ck => NS.getConfigFor(ck, effectivePlatform())); }

        function renderOrderList() {
            const platform = effectivePlatform();
            orderList.innerHTML = NS.getSectionOrderFor(platform).map(key => `
                <li class="order_item" draggable="true" data-key="${key}">
                    <label class="separate_checkbox_wrap">
                        <input type="checkbox" class="separate_checkbox" data-key="${key}" ${isKeySeparate(key) ? "checked" : ""}>
                    </label>
                    <span class="order_handle">⠿</span>
                    <span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>
                    <label class="switch">
                        <input type="checkbox" class="visible_checkbox" data-key="${key}" ${isKeyVisible(key) ? "checked" : ""}>
                        <span class="switch_slider"></span>
                    </label>
                </li>`).join("");
            wireDragReorder(orderList);
        }

        function wireDragReorder(listEl) {
            let draggedItem = null;
            listEl.querySelectorAll(".order_item").forEach(item => {
                item.addEventListener("dragstart", () => { draggedItem = item; item.style.opacity = "0.4"; });
                item.addEventListener("dragend", () => { item.style.opacity = "1"; });
                item.addEventListener("dragover", e => {
                    e.preventDefault();
                    if (!draggedItem || draggedItem === item) return;
                    const bounds = item.getBoundingClientRect();
                    const isAfter = e.clientY - bounds.top > bounds.height / 2;
                    item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
                });
            });
        }

        function renderEnableToggles() {
            enableList.innerHTML = NS.PLATFORMS.map(p => `
                <label class="toggle_row">
                    <span>Enable on ${p}</span>
                    <span class="switch">
                        <input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p) ? "checked" : ""}>
                        <span class="switch_slider"></span>
                    </span>
                </label>`).join("");
        }

        // Renders a single <select> for the current effective platform into `container`
        // (id `sel_${idPrefix}${platform}`). `dataKey`, when given, is stamped onto the
        // select so syncSharedLocationNotes() can read it back.
        function renderPlatformSelect(container, idPrefix, options, getCurrent, dataKey) {
            const platform = effectivePlatform();
            const current = getCurrent(platform);
            const opts = options.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            const dataAttrs = dataKey ? ` data-key="${dataKey}" data-platform="${platform}"` : "";
            container.innerHTML = `<div><select id="sel_${idPrefix}${platform}" class="select"${dataAttrs}>${opts}</select></div>`;
        }

        function renderOverrides(onRemove) {
            const overrides = NS.getUserOverrides();
            const keys = Object.keys(overrides);
            overrideEmpty.hidden = keys.length > 0;
            overrideList.innerHTML = keys.map(key => {
                const entry = overrides[key];
                const pills = [
                    entry.ignUrl ? `<span class="override_pill">IGN</span>` : "",
                    entry.hltbUrl ? `<span class="override_pill hltb">HLTB</span>` : ""
                ].join("");
                return `
                    <li class="override_item">
                        <span class="override_item_main">
                            <strong title="${NS.escapeHtml(entry.displayTitle || key)}">${NS.escapeHtml(entry.displayTitle || key)}</strong>
                            ${pills}
                        </span>
                        <button class="override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button>
                    </li>`;
            }).join("");
            overrideList.querySelectorAll(".override_remove").forEach(btn => btn.addEventListener("click", () => onRemove(btn.dataset.key)));
        }
        function refreshOverrides() {
            renderOverrides(key => { NS.removeUserOverride(key); refreshOverrides(); });
        }

        // A Location shared by 2+ currently-separate sections gets combined into one
        // standalone element instead of independent ones (see placeSections() in
        // 05-badge-render.js). Reads live (unsaved) select values + live Section Order
        // to show an informational note rather than a second reorder control.
        function computeSharedLocationGroups() {
            const byLoc = {};
            keyLocationsWrap.querySelectorAll("select[data-key]").forEach(sel => {
                (byLoc[sel.value] = byLoc[sel.value] || []).push(sel.dataset.key);
            });
            return Object.keys(byLoc).filter(loc => loc !== "inline" && byLoc[loc].length > 1).map(loc => ({ loc, keys: byLoc[loc] }));
        }

        // Rebuilds the "shared location" info from the live (unsaved) checkbox/select state plus
        // the live (unsaved) Section Order — called whenever any of those change. Two pieces,
        // placed near what each is actually about: a "drag to reorder" hint right under the
        // Section Order list itself, and the "Overlapping Locations:" heading + one line per
        // Location that currently has 2+ sections sharing it, down by the individual Location
        // selects. Neither is relevant while Combine All is on (it overrides all of this with one
        // single location), so both are cleared in that case rather than showing stale info.
        function syncSharedLocationNotes() {
            if (combineAllToggle.checked) { orderCombineHint.innerHTML = ""; sharedLocationNotes.innerHTML = ""; return; }
            const order = Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key);
            const groups = computeSharedLocationGroups();
            if (!groups.length) { orderCombineHint.innerHTML = ""; sharedLocationNotes.innerHTML = ""; return; }
            orderCombineHint.innerHTML = `<p class="sub" style="margin-top:6px;margin-bottom:0;">Drag items above to change their combined order.</p>`;
            const lines = groups.map(g => {
                const names = order.filter(k => g.keys.includes(k)).map(k => NS.escapeHtml(NS.SECTION_LABELS[k] || k)).join(" ; ");
                const posLabel = NS.escapeHtml((NS.LOCATION_OPTIONS.find(o => o.value === g.loc) || {}).label || g.loc);
                return `<strong>${posLabel}</strong> : ${names}`;
            });
            sharedLocationNotes.innerHTML = `<p class="sub" style="margin-top:10px;margin-bottom:0;"><strong>Overlapping Locations:</strong><br><br>${lines.join("<br>")}</p>`;
        }

        // Rebuilds key_locations_wrap from scratch: one titled block per section
        // currently checked "Separate Entry" for the effective platform, each with a
        // single Location <select>.
        function renderKeyLocationBlocks() {
            const checkedKeys = Array.from(orderList.querySelectorAll(".separate_checkbox:checked")).map(cb => cb.dataset.key);
            keyLocationsWrap.innerHTML = checkedKeys.map(key => `
                <div class="key_location_block" data-key-location-block="${key}">
                    <h2>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</h2>
                    <div class="locations_row" id="key_location_selects_${key}"></div>
                </div>`).join("");
            checkedKeys.forEach(key => {
                const container = document.getElementById("key_location_selects_" + key);
                renderPlatformSelect(container, key + "Location", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor(key, p), key);
                container.querySelectorAll("select").forEach(sel => sel.addEventListener("change", syncSharedLocationNotes));
            });
        }

        function syncCombineAllUi() {
            const on = combineAllToggle.checked;
            keyLocationsWrap.style.display = on ? "none" : "";
            separateEntryLocationsHeading.style.display = on ? "none" : "";
            sharedLocationNotes.style.display = on ? "none" : "";
            syncSharedLocationNotes();
        }

        function renderPlacementSelects() {
            positionHeading.textContent = "Overlay Position";
            renderPlatformSelect(positionSelects, "badgePosition", NS.BADGE_POSITION_OPTIONS, p => NS.getBadgePositionFor(p));
            renderKeyLocationBlocks();
            syncSharedLocationNotes();
            syncCombineAllUi();
        }

        // Captures the live (possibly unsaved) DOM state for `platform` into platformDrafts, called
        // right before any transition that would re-render for a different platform - so whatever
        // was being edited isn't lost.
        function captureDraft(platform) {
            const mapChecked = sel => Array.from(orderList.querySelectorAll(sel)).reduce((m, el) => { m[el.dataset.key] = el.checked; return m; }, {});
            const mapValues = sel => Array.from(document.querySelectorAll(sel)).reduce((m, el) => { m[el.id] = el.value; return m; }, {});
            const posSel = document.getElementById("sel_badgePosition" + platform);
            platformDrafts[platform] = {
                order: Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key),
                visible: mapChecked(".visible_checkbox"),
                separate: mapChecked(".separate_checkbox"),
                combineAll: combineAllToggle.checked,
                hltbSearchFallback: hltbSearchFallbackToggle.checked,
                locationSelects: mapValues("[data-key-location-block] select"),
                positionSelect: posSel ? posSel.value : null
            };
        }
        // Re-applies a previously captured draft for `platform` on top of the just-rendered (fresh
        // from storage) DOM, if one exists. No-op the first time a platform is ever shown.
        function applyDraft(platform) {
            const draft = platformDrafts[platform];
            if (!draft) return;
            draft.order.forEach(key => { const li = orderList.querySelector(`.order_item[data-key="${key}"]`); if (li) orderList.appendChild(li); });
            Object.keys(draft.visible).forEach(key => { const cb = orderList.querySelector(`.visible_checkbox[data-key="${key}"]`); if (cb) cb.checked = draft.visible[key]; });
            // Separate Entry checkboxes drive block creation/removal via their own change listener,
            // so only dispatch when the freshly-rendered (storage) value actually differs from the
            // draft - this both avoids redundant work and lets the listener build each block with
            // the right select before location values are restored onto it below.
            Object.keys(draft.separate).forEach(key => {
                const cb = orderList.querySelector(`.separate_checkbox[data-key="${key}"]`);
                if (cb && cb.checked !== draft.separate[key]) { cb.checked = draft.separate[key]; cb.dispatchEvent(new Event("change", { bubbles: true })); }
            });
            if (draft.combineAll !== combineAllToggle.checked) { combineAllToggle.checked = draft.combineAll; combineAllToggle.dispatchEvent(new Event("change", { bubbles: true })); }
            hltbSearchFallbackToggle.checked = draft.hltbSearchFallback;
            Object.keys(draft.locationSelects).forEach(id => { const sel = document.getElementById(id); if (sel) sel.value = draft.locationSelects[id]; });
            const posSel = document.getElementById("sel_badgePosition" + platform);
            if (posSel && draft.positionSelect != null) posSel.value = draft.positionSelect;
        }
        // Tracks whichever platform renderForCurrentPlatform() last actually rendered, so a
        // transition handler can capture that platform's live state before switching away from it -
        // reading effectivePlatform() again inside the handler wouldn't work for the shared-toggle
        // case, since by the time its "change" event fires, the checkbox's new value already
        // changes what effectivePlatform() resolves to.
        let lastRenderedPlatform = null;

        function syncPagerUi() {
            const shared = sharedToggle.checked;
            const enabled = enabledPlatforms();
            const showPager = !shared && enabled.length > 1;
            pager.hidden = !showPager;
            if (showPager) pagerLabel.textContent = effectivePlatform() + " Settings";
        }

        // Full re-render of everything that depends on which platform is currently
        // being edited (effectivePlatform()) - called on initial load, and whenever
        // the shared toggle, enable toggles, or pager arrows change which platform
        // that is. Nothing here touches document.body/#app itself, only the innerHTML
        // of specific containers, so the page's scroll position is never disturbed.
        function renderForCurrentPlatform() {
            syncPagerUi();
            const platform = effectivePlatform();
            combineAllToggle.checked = NS.getCombineAllFor(platform);
            hltbSearchFallbackToggle.checked = NS.getConfigFor("showHltbSearchFallback", platform);
            renderOrderList();
            renderPlacementSelects();
            applyDraft(platform);
            lastRenderedPlatform = platform;
        }

        renderEnableToggles();
        sharedToggle.checked = NS.getSettingsShared();
        renderForCurrentPlatform();
        refreshOverrides();

        function captureThenRender() {
            if (lastRenderedPlatform) captureDraft(lastRenderedPlatform);
            renderForCurrentPlatform();
        }
        sharedToggle.addEventListener("change", captureThenRender);
        enableList.querySelectorAll("input[data-site-enable]").forEach(input => input.addEventListener("change", captureThenRender));
        pagerPrev.addEventListener("click", () => {
            if (lastRenderedPlatform) captureDraft(lastRenderedPlatform);
            const enabled = enabledPlatforms();
            const idx = enabled.indexOf(effectivePlatform());
            pagerPlatform = enabled[(idx - 1 + enabled.length) % enabled.length];
            renderForCurrentPlatform();
        });
        pagerNext.addEventListener("click", () => {
            if (lastRenderedPlatform) captureDraft(lastRenderedPlatform);
            const enabled = enabledPlatforms();
            const idx = enabled.indexOf(effectivePlatform());
            pagerPlatform = enabled[(idx + 1) % enabled.length];
            renderForCurrentPlatform();
        });
        orderList.addEventListener("dragend", syncSharedLocationNotes);
        combineAllToggle.addEventListener("change", syncCombineAllUi);
        // Live (unsaved): (un)checking a section's "Separate Entry" box immediately shows/hides its
        // Location select block, defaulting a freshly-checked section to DEFAULT_SEPARATE_LOCATION
        // rather than storage (which would still read "inline" until Save).
        const DEFAULT_SEPARATE_LOCATION = "belowGameMedia";
        orderList.addEventListener("change", e => {
            if (!e.target.classList.contains("separate_checkbox")) return;
            const key = e.target.dataset.key;
            const existing = keyLocationsWrap.querySelector(`[data-key-location-block="${key}"]`);
            if (e.target.checked && !existing) {
                keyLocationsWrap.insertAdjacentHTML("beforeend", `
                    <div class="key_location_block" data-key-location-block="${key}">
                        <h2>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</h2>
                        <div class="locations_row" id="key_location_selects_${key}"></div>
                    </div>`);
                const container = document.getElementById("key_location_selects_" + key);
                renderPlatformSelect(container, key + "Location", NS.LOCATION_OPTIONS, () => DEFAULT_SEPARATE_LOCATION, key);
                container.querySelectorAll("select").forEach(sel => sel.addEventListener("change", syncSharedLocationNotes));
            } else if (!e.target.checked && existing) {
                existing.remove();
            }
            syncSharedLocationNotes();
        });

        document.getElementById("override_add").addEventListener("click", () => {
            const titleInput = document.getElementById("override_title");
            const ignInput = document.getElementById("override_ign_url");
            const hltbInput = document.getElementById("override_hltb_url");
            const title = titleInput.value.trim(), ignUrl = ignInput.value.trim(), hltbUrl = hltbInput.value.trim();
            if (!title || (!ignUrl && !hltbUrl)) return;
            NS.setUserOverride(title, ignUrl, hltbUrl);
            titleInput.value = ""; ignInput.value = ""; hltbInput.value = "";
            refreshOverrides();
        });

        saveBtn.addEventListener("click", () => {
            const shared = sharedToggle.checked;
            NS.setSettingsShared(shared);
            enableList.querySelectorAll("input[data-site-enable]").forEach(input => NS.setSiteEnabled(input.dataset.siteEnable, input.checked));
            const platform = effectivePlatform();
            const targets = shared ? NS.PLATFORMS : [platform];

            orderList.querySelectorAll(".visible_checkbox").forEach(cb => {
                (NS.SECTION_CONFIG_KEYS[cb.dataset.key] || []).forEach(configKey => targets.forEach(p => NS.setConfigFor(configKey, p, cb.checked)));
            });
            const order = Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key);
            targets.forEach(p => NS.setSectionOrderFor(p, order));

            targets.forEach(p => NS.setCombineAllFor(p, combineAllToggle.checked));
            targets.forEach(p => NS.setConfigFor("showHltbSearchFallback", p, hltbSearchFallbackToggle.checked));
            const posSel = document.getElementById("sel_badgePosition" + platform);
            if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
            order.forEach(key => {
                const sel = document.getElementById("sel_" + key + "Location" + platform);
                // A key with no select present means its "Separate Entry" box is unchecked —
                // explicitly write back "inline" so a previously-separate section reverts, rather
                // than leaving its old (now-invisible) location value in storage.
                targets.forEach(p => NS.setSectionLocationFor(key, p, sel ? sel.value : "inline"));
            });

            platformDrafts = {};
            saveStatus.textContent = "Saved ✓";
            saveStatus.classList.add("visible");
            setTimeout(() => saveStatus.classList.remove("visible"), 2000);
        });
    }

    document.addEventListener("DOMContentLoaded", () => { NS.storage.ready.then(init); });
})();
