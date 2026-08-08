(function(NS) {
    "use strict";
    const SETTINGS_PANEL_STYLE = `
        <style>
            #ign_settings_overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            #ign_settings_panel { background: linear-gradient(135deg, rgba(20,20,20,0.98), rgba(35,35,35,0.98)); border-radius: 10px; border-left: 5px solid #ff3e3e; box-shadow: 0 8px 30px rgba(0,0,0,0.6); width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; padding: 20px 22px; color: #ffffff; } #ign_settings_panel h2 { margin: 0 0 4px; font-size: 16px; color: #ff3e3e; text-transform: uppercase; letter-spacing: 0.5px; }
            #ign_settings_panel h3 { margin: 0 0 10px; font-size: 11px; color: #a1b0bd; text-transform: uppercase; letter-spacing: 0.5px; } .ign_settings_sub { font-size: 11px; color: #8f98a0; margin: 0 0 18px; } .ign_settings_columns { display: flex; gap: 22px; flex-wrap: wrap; } .ign_settings_columns > div { flex: 1; min-width: 210px; }
            .ign_settings_toggle_row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; font-size: 12px; color: #c6d4df; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; } .ign_switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 10px; } .ign_switch input { opacity: 0; width: 0; height: 0; }
            .ign_switch_slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; transition: 0.2s; } .ign_switch_slider::before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; top: 3px; background: #ffffff; border-radius: 50%; transition: 0.2s; } .ign_switch input:checked + .ign_switch_slider { background: #66c0f4; } .ign_switch input:checked + .ign_switch_slider::before { transform: translateX(16px); }
            #ign_order_list { list-style: none; margin: 0; padding: 0; } .ign_order_item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; cursor: grab; } .ign_order_item.ign_drag_over { border: 1px dashed #66c0f4; } .ign_order_handle { color: #8f98a0; font-size: 14px; } .ign_settings_actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; } #ign_settings_save { background: #ff3e3e; color: #ffffff; } #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }
            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; } .ign_settings_columns > div, .ign_locations_row > div { flex: 1; min-width: 200px; } .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 18px; } #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }
            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; } .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; } .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; } .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); } .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 13px; padding: 2px 6px; flex-shrink: 0; } .ign_override_remove:hover { color: #ff3e3e; }
            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; } .ign_override_form { display: flex; flex-direction: column; gap: 6px; } .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; background: rgba(102,192,244,0.15); color: #66c0f4; }
        </style>`;
    function buildSettingsPanelHtml() {
        const toggleRows = Object.keys(NS.CONFIG_KEYS).map(key =>
            `<label class="ign_settings_toggle_row"><span>${NS.escapeHtml(NS.CONFIG_KEYS[key])}</span><span class="ign_switch"><input type="checkbox" data-toggle-key="${key}" ${NS.getConfig(key) ? "checked" : ""}><span class="ign_switch_slider"></span></span></label>`).join("");
        const orderRows = NS.getSectionOrder().map(key =>
            `<li class="ign_order_item" draggable="true" data-key="${key}"><span class="ign_order_handle">⠿</span><span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span></li>`).join("");
        const enableRows = NS.PLATFORMS.map(p =>
            `<label class="ign_settings_toggle_row"><span>Enable on ${p}</span><span class="ign_switch"><input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p) ? "checked" : ""}><span class="ign_switch_slider"></span></span></label>`).join("");
        const shared = NS.getPlacementShared();
        const placementPlatforms = NS.getVisiblePlatforms();
        const platformLabel = p => shared ? "Steam + Epic" : p;
        const positionSelect = platform => {
            const current = NS.getBadgePositionFor(platform);
            const opts = NS.BADGE_POSITION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div><label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platformLabel(platform)}</label><select id="ign_badge_position_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        const locationSelect = (key, label, platform) => {
            const current = NS.getSectionLocationFor(key, platform);
            const opts = NS.LOCATION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div><label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platformLabel(platform)}: ${label}</label><select id="ign_${key}_location_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        const userOverrides = NS.getUserOverrides();
        const overrideKeys = Object.keys(userOverrides);
        const overrideRowsHtml = overrideKeys.length === 0 ? "" : overrideKeys.map(key => {
            const entry = userOverrides[key];
            const pills = [ entry.ignUrl ? `<span class="ign_override_pill">IGN</span>` : "", entry.hltbUrl ? `<span class="ign_override_pill ign_override_pill_hltb">HLTB</span>` : "" ].join("");
            return `<li class="ign_override_item"><span class="ign_override_item_main"><strong title="${NS.escapeHtml(entry.displayTitle || key)}">${NS.escapeHtml(entry.displayTitle || key)}</strong>${pills}</span><button class="ign_override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button></li>`;
        }).join("");
        return `
            ${SETTINGS_PANEL_STYLE}
            <div id="ign_settings_overlay">
                <div id="ign_settings_panel">
                    <h2>IGN Script Settings</h2>
                    <p class="ign_settings_sub">Changes apply immediately on save — no page refresh needed.</p>
                    <div class="ign_settings_columns">
                        <div><h3>Visible Sections</h3>${toggleRows}<h3 style="margin-top:14px;">Enable / Disable Per Site</h3>${enableRows}</div>
                        <div>
                            <h3>Section Order (drag to reorder)</h3>
                            <p class="ign_settings_sub">HowLongToBeat / HLTB Leisure Time order only applies when their Location below is set to "Inline".</p>
                            <ul id="ign_order_list">${orderRows}</ul>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <label class="ign_settings_toggle_row" style="border-bottom:none;">
                            <span>Share the same placement for Steam and Epic</span>
                            <span class="ign_switch"><input type="checkbox" id="ign_placement_shared" ${shared ? "checked" : ""}><span class="ign_switch_slider"></span></span>
                        </label>
                    </div>
                    ${placementPlatforms.length === 0 ? '<p class="ign_settings_sub">Enable at least one site above to configure placement.</p>' : `
                    <div style="margin-top:10px;"><h3>Overlay Position</h3><div class="ign_locations_row">${placementPlatforms.map(positionSelect).join("")}</div></div>
                    <div class="ign_locations_row">${placementPlatforms.map(p => locationSelect("hltb", "HowLongToBeat Location", p)).join("")}</div>
                    <div class="ign_locations_row">${placementPlatforms.map(p => locationSelect("leisure", "HLTB Leisure Time Location", p)).join("")}</div>`}
                    <div style="margin-top:18px;">
                        <h3>Per-Title Overrides</h3>
                        <p class="ign_settings_sub" style="margin-bottom:8px;">For games that won't auto-resolve: force an exact IGN page and/or an exact HowLongToBeat page for one title. Matched by exact title (case-insensitive). Added/removed immediately — no need to hit Save below.</p>
                        ${overrideKeys.length === 0 ? '<p class="ign_override_empty">No overrides added yet.</p>' : `<ul id="ign_override_list">${overrideRowsHtml}</ul>`}
                        <div class="ign_override_form">
                            <input type="text" id="ign_override_title" placeholder="Game title, exactly as shown on the store page">
                            <input type="text" id="ign_override_ign_url" placeholder="IGN URL (optional) — e.g. https://www.ign.com/games/some-slug">
                            <input type="text" id="ign_override_hltb_url" placeholder="HowLongToBeat URL (optional) — e.g. https://howlongtobeat.com/game/1234">
                            <button id="ign_override_add">Add / Update</button>
                        </div>
                    </div>
                    <div class="ign_settings_actions"><button id="ign_settings_cancel">Cancel</button><button id="ign_settings_save">Save</button></div>
                </div>
            </div>`;
    }
    function refreshBadgeNow() {
        NS.state.lastProcessedTitle = "";
        document.querySelector(".ign_rating_row")?.remove();
        NS.init();
    }
    NS.openSettingsPanel = function openSettingsPanel() {
        document.getElementById("ign_settings_overlay")?.remove();
        document.body.insertAdjacentHTML("beforeend", buildSettingsPanelHtml());
        const overlay = document.getElementById("ign_settings_overlay");
        const list = document.getElementById("ign_order_list");
        let draggedItem = null;
        list.querySelectorAll(".ign_order_item").forEach(item => {
            item.addEventListener("dragstart", () => { draggedItem = item; item.style.opacity = "0.4"; });
            item.addEventListener("dragend", () => { item.style.opacity = "1"; item.classList.remove("ign_drag_over"); });
            item.addEventListener("dragover", e => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const bounds = item.getBoundingClientRect();
                const isAfter = e.clientY - bounds.top > bounds.height / 2;
                item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
            });
        });
        overlay.querySelectorAll(".ign_override_remove").forEach(btn => btn.addEventListener("click", () => { NS.removeUserOverride(btn.dataset.key); refreshBadgeNow(); NS.openSettingsPanel(); }));
        overlay.querySelector("#ign_override_add").addEventListener("click", () => {
            const title = overlay.querySelector("#ign_override_title").value.trim();
            const ignUrl = overlay.querySelector("#ign_override_ign_url").value.trim();
            const hltbUrl = overlay.querySelector("#ign_override_hltb_url").value.trim();
            if (!title || !ignUrl && !hltbUrl) return;
            NS.setUserOverride(title, ignUrl, hltbUrl);
            refreshBadgeNow();
            NS.openSettingsPanel();
        });
        overlay.querySelector("#ign_placement_shared").addEventListener("change", e => { NS.setPlacementShared(e.target.checked); NS.openSettingsPanel(); });
        overlay.querySelectorAll("input[data-site-enable]").forEach(input => input.addEventListener("change", () => { NS.setSiteEnabled(input.dataset.siteEnable, input.checked); refreshBadgeNow(); NS.openSettingsPanel(); }));
        overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector("#ign_settings_cancel").addEventListener("click", () => overlay.remove());
        overlay.querySelector("#ign_settings_save").addEventListener("click", () => {
            overlay.querySelectorAll("input[data-toggle-key]").forEach(input => NS.storage.set(input.dataset.toggleKey, input.checked));
            NS.setSectionOrder(Array.from(list.querySelectorAll(".ign_order_item")).map(li => li.dataset.key));
            const shared = NS.getPlacementShared();
            NS.getVisiblePlatforms().forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [ platform ];
                const posSel = overlay.querySelector(`#ign_badge_position_${platform}`);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                ["hltb", "leisure"].forEach(key => {
                    const sel = overlay.querySelector(`#ign_${key}_location_${platform}`);
                    if (sel) targets.forEach(p => NS.setSectionLocationFor(key, p, sel.value));
                });
            });
            overlay.remove();
            NS.registerMenuCommands();
            refreshBadgeNow();
        });
    };
    NS.openSettings = function openSettings() {
        if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.openOptionsPage === "function") chrome.runtime.openOptionsPage();
        else NS.openSettingsPanel();
    };
    document.addEventListener("click", e => { const gear = e.target.closest ? e.target.closest(".ign_open_settings_gear") : null; if (gear) NS.openSettings(); });
})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
