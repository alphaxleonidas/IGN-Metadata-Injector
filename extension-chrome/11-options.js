// IGN Metadata Injector — extension options page
// Used only when the settings page opens as a dedicated extension tab (via
// manifest.*.json's "options_ui"). Loads 00-namespace.js + 01-config-store.js
// first (see 11-options.html) and talks to window.IGN_METADATA_INJECTOR (NS)
// exactly like the content script's 06-settings-panel.js does, instead of
// hand-duplicating CONFIG_KEYS/defaults/option lists here — that duplication
// used to be a real source of bugs (e.g. this file used to key per-title
// overrides by `title.toLowerCase()` while 01-config-store.js's own
// NS.setUserOverride/getUserOverrideForTitle used `title.trim().toLowerCase()`,
// so an override added here with incidental whitespace would silently never
// match the page's scraped title). Sharing the same functions makes that
// class of mismatch impossible.
(function () {
    "use strict";
    const NS = window.IGN_METADATA_INJECTOR;

    // "Separate" (rendered as its own standalone element instead of folded inline into the main
    // badge) is stored per-platform via the same generic Location value every section already has
    // (getSectionLocationFor(key, platform) !== "inline"). A key counts as checked if it's separate
    // on any currently-visible platform, since this row has no per-platform breakdown of its own.
    function isKeySeparate(key, platforms) { return platforms.some(p => NS.getSectionLocationFor(key, p) !== "inline"); }

    // "Visible" folds the old standalone "Visible Sections" toggle list into this same row — a
    // section's underlying "Show ..." config key(s) (see NS.SECTION_CONFIG_KEYS; almost always one,
    // except "scores" which is really two independently-toggleable configs sharing one row). Checked
    // if any of them are currently on; (un)checking it writes that same state to all of them on Save.
    function isKeyVisible(key) { return (NS.SECTION_CONFIG_KEYS[key] || []).some(ck => NS.getConfig(ck)); }

    function renderOrderList(list, separatePlatforms) {
        list.innerHTML = NS.getSectionOrder().map(key => `
            <li class="order_item" draggable="true" data-key="${key}">
                <label class="separate_checkbox_wrap">
                    <input type="checkbox" class="separate_checkbox" data-key="${key}" ${isKeySeparate(key, separatePlatforms) ? "checked" : ""}>
                </label>
                <span class="order_handle">⠿</span>
                <span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>
                <label class="switch">
                    <input type="checkbox" class="visible_checkbox" data-key="${key}" ${isKeyVisible(key) ? "checked" : ""}>
                    <span class="switch_slider"></span>
                </label>
            </li>`).join("");
        wireDragReorder(list);
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

    function renderEnableToggles(container) {
        container.innerHTML = NS.PLATFORMS.map(p => `
            <label class="toggle_row">
                <span>Enable on ${p}</span>
                <span class="switch">
                    <input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p) ? "checked" : ""}>
                    <span class="switch_slider"></span>
                </span>
            </label>`).join("");
    }

    // Renders one <select> per visible platform into `container`, each with id `sel_${idPrefix}${platform}`.
    // When placement is shared there's only one column, so the per-select "Steam + Epic" label is
    // dropped (the caller states it once in a heading instead of repeating it under every dropdown).
    // `dataKey`, when given, is stamped onto each select so syncSharedLocationNotes() can read it back.
    function renderPlatformSelects(container, idPrefix, options, getCurrent, platforms, shared, dataKey) {
        container.innerHTML = platforms.map(platform => {
            const current = getCurrent(platform);
            const opts = options.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            const labelHtml = shared ? "" : `<label class="platform_select_label">${platform}</label>`;
            const dataAttrs = dataKey ? ` data-key="${dataKey}" data-platform="${platform}"` : "";
            return `<div>${labelHtml}<select id="sel_${idPrefix}${platform}" class="select"${dataAttrs}>${opts}</select></div>`;
        }).join("");
    }

    function renderOverrides(listEl, emptyEl, onRemove) {
        const overrides = NS.getUserOverrides();
        const keys = Object.keys(overrides);
        emptyEl.hidden = keys.length > 0;
        listEl.innerHTML = keys.map(key => {
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
        listEl.querySelectorAll(".override_remove").forEach(btn => btn.addEventListener("click", () => { onRemove(btn.dataset.key); }));
    }

    function init() {
        const orderList = document.getElementById("order_list");
        const enableList = document.getElementById("enable_list");
        const sharedToggle = document.getElementById("placement_shared");
        const positionSelects = document.getElementById("position_selects");
        const positionHeading = document.getElementById("position_heading");
        const keyLocationsWrap = document.getElementById("key_locations_wrap");
        const sharedLocationNotes = document.getElementById("shared_location_notes");
        const combineAllToggle = document.getElementById("combine_all");
        const combineAllLocations = document.getElementById("combine_all_locations");
        const overrideList = document.getElementById("override_list");
        const overrideEmpty = document.getElementById("override_empty");
        const saveBtn = document.getElementById("save");
        const saveStatus = document.getElementById("save_status");

        function refreshOverrides() {
            renderOverrides(overrideList, overrideEmpty, key => { NS.removeUserOverride(key); refreshOverrides(); });
        }

        function currentEnabledMap() {
            const map = {};
            enableList.querySelectorAll("input[data-site-enable]").forEach(input => { map[input.dataset.siteEnable] = input.checked; });
            return map;
        }

        function visiblePlatforms() {
            const shared = sharedToggle.checked;
            const enabled = NS.PLATFORMS.filter(p => currentEnabledMap()[p]);
            return shared ? enabled.slice(0, 1) : enabled;
        }

        // Any Location shared by 2+ currently-separate sections (on a given platform) gets combined
        // into one standalone element instead of independent ones — the same "combine when sharing a
        // location" behavior HLTB/Leisure Time originally had on their own, now generalized to every
        // section (see placeSimpleSections() in 05-badge-render.js). Their relative order within a
        // combined group is just their relative order in the Section Order list above, so this reads
        // live (unsaved) select values + the live Section Order to show an informational note rather
        // than offering a second, separate drag-to-reorder control.
        function computeSharedLocationGroups(platform) {
            const byLoc = {};
            keyLocationsWrap.querySelectorAll(`select[data-platform="${platform}"]`).forEach(sel => {
                (byLoc[sel.value] = byLoc[sel.value] || []).push(sel.dataset.key);
            });
            return Object.keys(byLoc).filter(loc => loc !== "inline" && byLoc[loc].length > 1).map(loc => ({ loc, keys: byLoc[loc] }));
        }

        function syncSharedLocationNotes() {
            const order = Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key);
            const shared = sharedToggle.checked;
            const sections = [];
            visiblePlatforms().forEach(platform => {
                const groups = computeSharedLocationGroups(platform);
                if (!groups.length) return;
                const lines = groups.map(g => {
                    const names = order.filter(k => g.keys.includes(k)).map(k => NS.escapeHtml(NS.SECTION_LABELS[k] || k)).join(" ; ");
                    const posLabel = NS.escapeHtml((NS.LOCATION_OPTIONS.find(o => o.value === g.loc) || {}).label || g.loc);
                    return `<strong>${posLabel}</strong> : ${names}`;
                });
                const prefix = shared ? "" : `<strong>${NS.escapeHtml(platform)}</strong><br>`;
                sections.push(`${prefix}${lines.join("<br>")}`);
            });
            sharedLocationNotes.innerHTML = sections.length
                ? `<p class="sub" style="margin-top:10px;margin-bottom:0;"><strong>Overlapping Locations:</strong><br>${sections.join("<br>")}<br><br><span style="opacity:0.8;">Drag items in Section Order above to change their combined order.</span></p>`
                : "";
        }

        // Builds/replaces the whole key_locations_wrap from scratch: one titled block per section
        // currently checked "Separate Entry" (read from the live, unsaved checkboxes in orderList),
        // each with a Location <select> per visible platform — the same generic
        // getSectionLocationFor(key, platform) storage HLTB/Leisure already used, now available to
        // every section instead of just those two.
        function renderKeyLocationBlocks() {
            const shared = sharedToggle.checked;
            const platforms = visiblePlatforms();
            const checkedKeys = Array.from(orderList.querySelectorAll(".separate_checkbox:checked")).map(cb => cb.dataset.key);
            keyLocationsWrap.innerHTML = checkedKeys.map(key => {
                const heading = NS.SECTION_LABELS[key] || key;
                return `
                <div class="key_location_block" data-key-location-block="${key}">
                    <h2>${NS.escapeHtml(heading)}</h2>
                    <div class="locations_row" id="key_location_selects_${key}"></div>
                </div>`;
            }).join("");
            checkedKeys.forEach(key => {
                const container = document.getElementById("key_location_selects_" + key);
                renderPlatformSelects(container, key + "Location", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor(key, p), platforms, shared, key);
                container.querySelectorAll("select").forEach(sel => sel.addEventListener("change", syncSharedLocationNotes));
            });
        }

        // "Combine all entries in one place": while on, every individual Separate Entry / Location
        // choice below is overridden (see NS.getSectionLocation() in 01-config-store.js) — so its own
        // per-platform Location select(s) are shown instead, and the (now-moot) individual location
        // UI is hidden rather than removed, so turning this back off instantly reveals each section's
        // untouched previous configuration.
        function syncCombineAllUi() {
            const on = combineAllToggle.checked;
            combineAllLocations.style.display = on ? "" : "none";
            keyLocationsWrap.style.display = on ? "none" : "";
            sharedLocationNotes.style.display = on ? "none" : "";
        }

        function renderPlacementSelects() {
            const shared = sharedToggle.checked;
            const platforms = visiblePlatforms();
            positionHeading.textContent = "Overlay Position";
            renderPlatformSelects(positionSelects, "badgePosition", NS.BADGE_POSITION_OPTIONS, p => NS.getBadgePositionFor(p), platforms, shared);
            renderPlatformSelects(combineAllLocations, "combineLocation", NS.LOCATION_OPTIONS, p => NS.getCombineLocationFor(p), platforms, shared);
            renderKeyLocationBlocks();
            syncSharedLocationNotes();
            syncCombineAllUi();
        }

        renderEnableToggles(enableList);
        sharedToggle.checked = NS.getPlacementShared();
        renderOrderList(orderList, visiblePlatforms().length ? visiblePlatforms() : NS.PLATFORMS);
        combineAllToggle.checked = (visiblePlatforms().length ? visiblePlatforms() : NS.PLATFORMS).some(p => NS.getCombineAllFor(p));
        renderPlacementSelects();
        refreshOverrides();
        sharedToggle.addEventListener("change", renderPlacementSelects);
        enableList.querySelectorAll("input[data-site-enable]").forEach(input => input.addEventListener("change", renderPlacementSelects));
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
                const shared = sharedToggle.checked;
                const platforms = visiblePlatforms();
                const heading = NS.SECTION_LABELS[key] || key;
                keyLocationsWrap.insertAdjacentHTML("beforeend", `
                    <div class="key_location_block" data-key-location-block="${key}">
                        <h2>${NS.escapeHtml(heading)}</h2>
                        <div class="locations_row" id="key_location_selects_${key}"></div>
                    </div>`);
                const container = document.getElementById("key_location_selects_" + key);
                renderPlatformSelects(container, key + "Location", NS.LOCATION_OPTIONS, () => DEFAULT_SEPARATE_LOCATION, platforms, shared, key);
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
            orderList.querySelectorAll(".visible_checkbox").forEach(cb => {
                (NS.SECTION_CONFIG_KEYS[cb.dataset.key] || []).forEach(configKey => NS.storage.set(configKey, cb.checked));
            });
            NS.setSectionOrder(Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key));
            enableList.querySelectorAll("input[data-site-enable]").forEach(input => NS.setSiteEnabled(input.dataset.siteEnable, input.checked));
            NS.setPlacementShared(sharedToggle.checked);
            const shared = sharedToggle.checked;
            const combineAllChecked = combineAllToggle.checked;
            const platforms = visiblePlatforms();
            platforms.forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [platform];
                targets.forEach(p => NS.setCombineAllFor(p, combineAllChecked));
                const combineSel = document.getElementById("sel_combineLocation" + platform);
                if (combineSel) targets.forEach(p => NS.setCombineLocationFor(p, combineSel.value));
                const posSel = document.getElementById("sel_badgePosition" + platform);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                NS.getSectionOrder().forEach(k => {
                    const sel = document.getElementById("sel_" + k + "Location" + platform);
                    // A key with no select present means its "Separate Entry" box is unchecked —
                    // explicitly write back "inline" so a previously-separate section reverts, rather
                    // than leaving its old (now-invisible) location value in storage.
                    targets.forEach(p => NS.setSectionLocationFor(k, p, sel ? sel.value : "inline"));
                });
            });
            saveStatus.textContent = "Saved ✓";
            saveStatus.classList.add("visible");
            setTimeout(() => saveStatus.classList.remove("visible"), 2000);
        });
    }

    document.addEventListener("DOMContentLoaded", () => { NS.storage.ready.then(init); });
})();
