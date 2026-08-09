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

    const HLTB_LEISURE_ORDER_LABELS = { hltb: "HowLongToBeat", leisure: "HLTB Leisure Time" };
    // Only relevant when HLTB and Leisure Time are placed at the exact same non-inline location —
    // otherwise they render as independent elements with no shared order to pick.
    function hltbLeisureOrderNeeded(hltbLoc, leisureLoc) { return hltbLoc !== "inline" && hltbLoc === leisureLoc; }
    function hltbLeisureOrderBlockHtml(platform, label, order) {
        const rows = order.map(key => `<li class="order_item" draggable="true" data-key="${key}"><span class="order_handle">⠿</span><span>${HLTB_LEISURE_ORDER_LABELS[key]}</span></li>`).join("");
        return `<div class="hltb_leisure_order_block" data-platform="${platform}"><label class="platform_select_label">${label}: HLTB / Leisure Order (both share one location)</label><ul>${rows}</ul></div>`;
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
        const hltbLeisureOrderWrap = document.getElementById("hltb_leisure_order_wrap");
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

        // Adds/removes each platform's HLTB/Leisure order picker as the two Location <select>s are
        // changed — reading their live (unsaved) values, not storage — without disturbing a block
        // that's already present and still relevant (so an in-progress drag isn't reset every time
        // an unrelated select fires a change event).
        function syncHltbLeisureOrderWrap() {
            const shared = sharedToggle.checked;
            visiblePlatforms().forEach(platform => {
                const hltbSel = document.getElementById("sel_hltbLocation" + platform);
                const leisureSel = document.getElementById("sel_leisureLocation" + platform);
                const needed = hltbSel && leisureSel && hltbLeisureOrderNeeded(hltbSel.value, leisureSel.value);
                const existing = hltbLeisureOrderWrap.querySelector(`.hltb_leisure_order_block[data-platform="${platform}"]`);
                if (needed && !existing) {
                    const label = shared ? "Steam + Epic" : platform;
                    hltbLeisureOrderWrap.insertAdjacentHTML("beforeend", hltbLeisureOrderBlockHtml(platform, label, NS.getHltbLeisureOrderFor(platform)));
                    wireDragReorder(hltbLeisureOrderWrap.querySelector(`.hltb_leisure_order_block[data-platform="${platform}"] ul`));
                } else if (!needed && existing) {
                    existing.remove();
                }
            });
            // drop blocks for platforms that are no longer visible at all (e.g. site just disabled)
            hltbLeisureOrderWrap.querySelectorAll(".hltb_leisure_order_block").forEach(block => {
                if (!visiblePlatforms().includes(block.dataset.platform)) block.remove();
            });
        }

        function renderPlacementSelects() {
            const shared = sharedToggle.checked;
            const platforms = visiblePlatforms();
            renderPlatformSelects(positionSelects, "badgePosition", NS.BADGE_POSITION_OPTIONS, p => NS.getBadgePositionFor(p), platforms, shared);
            renderPlatformSelects(hltbLocationSelects, "hltbLocation", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor("hltb", p), platforms, shared);
            renderPlatformSelects(leisureLocationSelects, "leisureLocation", NS.LOCATION_OPTIONS, p => NS.getSectionLocationFor("leisure", p), platforms, shared);
            hltbLeisureOrderWrap.innerHTML = platforms.map(p => {
                const hltbCur = NS.getSectionLocationFor("hltb", p), leisureCur = NS.getSectionLocationFor("leisure", p);
                if (!hltbLeisureOrderNeeded(hltbCur, leisureCur)) return "";
                return hltbLeisureOrderBlockHtml(p, shared ? "Steam + Epic" : p, NS.getHltbLeisureOrderFor(p));
            }).join("");
            hltbLeisureOrderWrap.querySelectorAll(".hltb_leisure_order_block ul").forEach(wireDragReorder);
            hltbLocationSelects.querySelectorAll("select").forEach(sel => sel.addEventListener("change", syncHltbLeisureOrderWrap));
            leisureLocationSelects.querySelectorAll("select").forEach(sel => sel.addEventListener("change", syncHltbLeisureOrderWrap));
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
            const platforms = visiblePlatforms();
            platforms.forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [platform];
                const posSel = document.getElementById("sel_badgePosition" + platform);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                ["hltb", "leisure"].forEach(k => {
                    const sel = document.getElementById("sel_" + k + "Location" + platform);
                    if (sel) targets.forEach(p => NS.setSectionLocationFor(k, p, sel.value));
                });
                const orderBlock = hltbLeisureOrderWrap.querySelector(`.hltb_leisure_order_block[data-platform="${platform}"]`);
                if (orderBlock) {
                    const order = Array.from(orderBlock.querySelectorAll(".order_item")).map(li => li.dataset.key);
                    targets.forEach(p => NS.setHltbLeisureOrderFor(p, order));
                }
            });
            saveStatus.textContent = "Saved ✓";
            saveStatus.classList.add("visible");
            setTimeout(() => saveStatus.classList.remove("visible"), 2000);
        });
    }

    document.addEventListener("DOMContentLoaded", () => { NS.storage.ready.then(init); });
})();
