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

    function renderToggles(container) {
        container.innerHTML = Object.keys(NS.CONFIG_KEYS).map(key => `
            <label class="toggle_row">
                <span>${NS.escapeHtml(NS.CONFIG_KEYS[key])}</span>
                <span class="switch">
                    <input type="checkbox" data-toggle-key="${key}" ${NS.getConfig(key) ? "checked" : ""}>
                    <span class="switch_slider"></span>
                </span>
            </label>`).join("");
    }

    function renderOrderList(list) {
        list.innerHTML = NS.getSectionOrder().map(key => `
            <li class="order_item" draggable="true" data-key="${key}">
                <span class="order_handle">⠿</span>
                <span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>
            </li>`).join("");
        let draggedItem = null;
        list.querySelectorAll(".order_item").forEach(item => {
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
    function renderPlatformSelects(container, idPrefix, options, getCurrent, platforms, shared) {
        container.innerHTML = platforms.map(platform => {
            const current = getCurrent(platform);
            const opts = options.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            const label = shared ? "Steam + Epic" : platform;
            return `<div><label class="platform_select_label">${label}</label><select id="sel_${idPrefix}${platform}" class="select">${opts}</select></div>`;
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
        const toggleList = document.getElementById("toggle_list");
        const orderList = document.getElementById("order_list");
        const enableList = document.getElementById("enable_list");
        const sharedToggle = document.getElementById("placement_shared");
        const positionSelects = document.getElementById("position_selects");
        const hltbLocationSelects = document.getElementById("hltb_location_selects");
        const leisureLocationSelects = document.getElementById("leisure_location_selects");
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

        function renderPlacementSelects() {
            const shared = sharedToggle.checked;
            const platforms = shared ? NS.PLATFORMS.filter(p => currentEnabledMap()[p]).slice(0, 1) : NS.PLATFORMS.filter(p => currentEnabledMap()[p]);
            renderPlatformSelects(positionSelects, "badgePosition", NS.BADGE_POSITION_OPTIONS, p => NS.getBadgePositionFor(p), platforms, shared);
            renderPlatformSelects(hltbLocationSelects, "hltbLocation", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor("hltb", p), platforms, shared);
            renderPlatformSelects(leisureLocationSelects, "leisureLocation", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor("leisure", p), platforms, shared);
        }

        renderToggles(toggleList);
        renderOrderList(orderList);
        renderEnableToggles(enableList);
        sharedToggle.checked = NS.getPlacementShared();
        renderPlacementSelects();
        refreshOverrides();
        sharedToggle.addEventListener("change", renderPlacementSelects);
        enableList.querySelectorAll("input[data-site-enable]").forEach(input => input.addEventListener("change", renderPlacementSelects));

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
            toggleList.querySelectorAll("input[data-toggle-key]").forEach(input => NS.storage.set(input.dataset.toggleKey, input.checked));
            NS.setSectionOrder(Array.from(orderList.querySelectorAll(".order_item")).map(li => li.dataset.key));
            enableList.querySelectorAll("input[data-site-enable]").forEach(input => NS.setSiteEnabled(input.dataset.siteEnable, input.checked));
            NS.setPlacementShared(sharedToggle.checked);
            const shared = sharedToggle.checked;
            const platforms = shared ? NS.PLATFORMS.filter(p => currentEnabledMap()[p]).slice(0, 1) : NS.PLATFORMS.filter(p => currentEnabledMap()[p]);
            platforms.forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [platform];
                const posSel = document.getElementById("sel_badgePosition" + platform);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                ["hltb", "leisure"].forEach(k => {
                    const sel = document.getElementById("sel_" + k + "Location" + platform);
                    if (sel) targets.forEach(p => NS.setSectionLocationFor(k, p, sel.value));
                });
            });
            saveStatus.textContent = "Saved ✓";
            saveStatus.classList.add("visible");
            setTimeout(() => saveStatus.classList.remove("visible"), 2000);
        });
    }

    document.addEventListener("DOMContentLoaded", () => { NS.storage.ready.then(init); });
})();
