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
            .ign_order_list_header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; } .ign_order_list_header h3 { margin: 0; flex: 1; text-align: center; }
            .ign_separate_col_label { flex-shrink: 0; width: 58px; font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; letter-spacing: 0.2px; line-height: 1.15; }
            .ign_visible_col_label { flex-shrink: 0; width: 58px; text-align: right; font-size: 10px; color: #a1b0bd; text-transform: uppercase; font-weight: bold; letter-spacing: 0.2px; line-height: 1.15; }
            .ign_separate_checkbox_wrap { flex-shrink: 0; display: flex; align-items: center; }
            .ign_separate_checkbox { width: 15px; height: 15px; accent-color: #66c0f4; cursor: pointer; }
            .ign_order_item .ign_switch { margin-left: auto; }
            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; } #ign_settings_save { background: #ff3e3e; color: #ffffff; } #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }
            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; } .ign_settings_columns > div, .ign_locations_row > div { flex: 1; min-width: 200px; } .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 18px; } #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }
            .ign_key_location_block { margin-top: 10px; } .ign_key_location_block h3, #ign_overlay_position_heading { margin-top: 4px; font-weight: bold; color: #c6d4df; font-size: 12px; }
            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; } .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; } .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; } .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); } .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer; font-size: 13px; padding: 2px 6px; flex-shrink: 0; } .ign_override_remove:hover { color: #ff3e3e; }
            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; } .ign_override_form { display: flex; flex-direction: column; gap: 6px; } .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; background: rgba(102,192,244,0.15); color: #66c0f4; }
        </style>`;
    function wireDragReorder(listEl) {
        let draggedItem = null;
        listEl.querySelectorAll(".ign_order_item").forEach(item => {
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
    }
    // Any Location shared by 2+ currently-separate sections (on a given platform) gets combined into
    // one standalone element instead of independent ones — the same "combine when sharing a
    // location" behavior HLTB/Leisure Time originally had on their own, now generalized to every
    // section (see placeSimpleSections() in 05-badge-render.js). Their relative order within a
    // combined group is just their relative order in the Section Order list above, so this reads
    // live (unsaved) select values + the live Section Order to show an informational note rather
    // than offering a second, separate drag-to-reorder control.
    function computeSharedLocationGroups(overlay, platform) {
        const byLoc = {};
        overlay.querySelectorAll(`[data-key-location-block] select[data-platform="${platform}"]`).forEach(sel => {
            (byLoc[sel.value] = byLoc[sel.value] || []).push(sel.dataset.key);
        });
        return Object.keys(byLoc).filter(loc => loc !== "inline" && byLoc[loc].length > 1).map(loc => ({ loc, keys: byLoc[loc] }));
    }
    function buildSettingsPanelHtml() {
        const enableRows = NS.PLATFORMS.map(p =>
            `<label class="ign_settings_toggle_row"><span>Enable on ${p}</span><span class="ign_switch"><input type="checkbox" data-site-enable="${p}" ${NS.getSiteEnabled(p) ? "checked" : ""}><span class="ign_switch_slider"></span></span></label>`).join("");
        const shared = NS.getPlacementShared();
        const placementPlatforms = NS.getVisiblePlatforms();
        // "Separate" (i.e. rendered as its own standalone element instead of folded inline into the
        // main badge) is stored per-platform via the same Location value every section already has
        // (getSectionLocationFor(key, platform) !== "inline"). The checkbox reflects/drives that on
        // whichever platform(s) are currently visible for editing; a key counts as checked if it's
        // separate on any of them, since the row itself has no per-platform breakdown.
        const separatePlatforms = placementPlatforms.length ? placementPlatforms : NS.PLATFORMS;
        const isKeySeparate = key => separatePlatforms.some(p => NS.getSectionLocationFor(key, p) !== "inline");
        // "Visible" folds the old standalone "Visible Sections" toggle list into this same row — a
        // section's underlying "Show ..." config key(s) (see NS.SECTION_CONFIG_KEYS; almost always
        // one, except "scores" which is really two independently-toggleable configs sharing one row).
        // Checked if any of them are currently on; (un)checking it writes that same state to all of
        // them on Save.
        const isKeyVisible = key => (NS.SECTION_CONFIG_KEYS[key] || []).some(ck => NS.getConfig(ck));
        const orderRows = NS.getSectionOrder().map(key =>
            `<li class="ign_order_item" draggable="true" data-key="${key}">` +
            `<label class="ign_separate_checkbox_wrap"><input type="checkbox" class="ign_separate_checkbox" data-key="${key}" ${isKeySeparate(key) ? "checked" : ""}></label>` +
            `<span class="ign_order_handle">⠿</span><span style="flex:1;">${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>` +
            `<label class="ign_switch"><input type="checkbox" class="ign_visible_checkbox" data-key="${key}" ${isKeyVisible(key) ? "checked" : ""}><span class="ign_switch_slider"></span></label></li>`).join("");
        const combineAllChecked = separatePlatforms.some(p => NS.getCombineAllFor(p));
        // When placement is shared between Steam and Epic there's only one column to edit, so it's
        // omitted per-select rather than repeated under every single dropdown (each block's
        // heading already names the section, so nothing is lost).
        const platformLabelHtml = platform => shared ? "" : `<label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${platform}</label>`;
        const positionSelect = platform => {
            const current = NS.getBadgePositionFor(platform);
            const opts = NS.BADGE_POSITION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div>${platformLabelHtml(platform)}<select id="ign_badge_position_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        const locationSelect = (key, platform) => {
            const current = NS.getSectionLocationFor(key, platform);
            const opts = NS.LOCATION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div>${platformLabelHtml(platform)}<select id="ign_${key}_location_${platform}" class="ign_settings_select" data-key="${key}" data-platform="${platform}">${opts}</select></div>`;
        };
        const combineLocationSelect = platform => {
            const current = NS.getCombineLocationFor(platform);
            const opts = NS.LOCATION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === current ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
            return `<div>${platformLabelHtml(platform)}<select id="ign_combine_location_${platform}" class="ign_settings_select">${opts}</select></div>`;
        };
        // One block per section currently checked as "Separate Entry" — a Location select per
        // visible platform, keyed off the same generic getSectionLocationFor(key, platform) storage
        // HLTB/Leisure already used. Rebuilt whenever the checkbox column changes (see openSettingsPanel).
        const keyLocationBlockHtml = (key, platforms) => {
            const heading = NS.SECTION_LABELS[key] || key;
            return `<div class="ign_key_location_block" data-key-location-block="${key}"><h3>${NS.escapeHtml(heading)}</h3><div class="ign_locations_row">${platforms.map(p => locationSelect(key, p)).join("")}</div></div>`;
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
                        <div>
                            <div class="ign_order_list_header"><span class="ign_separate_col_label">Separate Entry</span><h3>Section Order (drag to reorder)</h3><span class="ign_visible_col_label">Visible</span></div>
                            <ul id="ign_order_list">${orderRows}</ul>
                            <div style="margin-top:4px;">
                                <label class="ign_settings_toggle_row" style="border-bottom:none;">
                                    <span>Combine all entries in one place</span>
                                    <span class="ign_switch"><input type="checkbox" id="ign_combine_all" ${combineAllChecked ? "checked" : ""}><span class="ign_switch_slider"></span></span>
                                </label>
                                <div id="ign_combine_all_locations" class="ign_locations_row" style="margin-top:8px;${combineAllChecked ? "" : "display:none;"}">${placementPlatforms.map(combineLocationSelect).join("")}</div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top:18px;"><h3>Enable / Disable Per Site</h3>${enableRows}</div>
                    <div style="margin-top:18px;">
                        <label class="ign_settings_toggle_row" style="border-bottom:none;">
                            <span>Share the same placement for Steam and Epic</span>
                            <span class="ign_switch"><input type="checkbox" id="ign_placement_shared" ${shared ? "checked" : ""}><span class="ign_switch_slider"></span></span>
                        </label>
                    </div>
                    ${placementPlatforms.length === 0 ? '<p class="ign_settings_sub">Enable at least one site above to configure placement.</p>' : `
                    <div style="margin-top:10px;"><h3 id="ign_overlay_position_heading">Overlay Position</h3><div class="ign_locations_row">${placementPlatforms.map(positionSelect).join("")}</div></div>
                    <div id="ign_key_locations_wrap" style="${combineAllChecked ? "display:none;" : ""}">${NS.getSectionOrder().filter(isKeySeparate).map(key => keyLocationBlockHtml(key, placementPlatforms)).join("")}</div>
                    <div id="ign_shared_location_notes" style="${combineAllChecked ? "display:none;" : ""}"></div>`}
                    <div style="margin-top:18px;">
                        <h3>Per-Title Overrides</h3>
                        <p class="ign_settings_sub" style="margin-bottom:8px;">Add/Override IGN/HowLongToBeat data. Useful when no data is found.</p>
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
    // Reopening the panel (placement-shared toggle, site-enable toggle, adding/removing an override)
    // used to always rebuild from storage, silently discarding any not-yet-Saved edits made elsewhere
    // in the panel first — e.g. unchecking Leisure Time's Visible switch, then flipping "Share the
    // same placement", would forget the Visible change. These two capture/reapply the panel's live,
    // unsaved state across such a reopen; a genuinely fresh open (no previous overlay) is unaffected
    // since there's nothing to snapshot.
    function snapshotPanelState(overlay, list) {
        if (!overlay || !list) return null;
        const mapChecked = sel => Array.from(overlay.querySelectorAll(sel)).reduce((m, el) => { m[el.dataset.key] = el.checked; return m; }, {});
        const mapValues = sel => Array.from(overlay.querySelectorAll(sel)).reduce((m, el) => { m[el.id] = el.value; return m; }, {});
        return {
            order: Array.from(list.querySelectorAll(".ign_order_item")).map(li => li.dataset.key),
            visible: mapChecked(".ign_visible_checkbox"),
            separate: mapChecked(".ign_separate_checkbox"),
            combineAll: overlay.querySelector("#ign_combine_all") ? overlay.querySelector("#ign_combine_all").checked : null,
            locationSelects: mapValues("[data-key-location-block] select"),
            combineLocationSelects: mapValues('[id^="ign_combine_location_"]'),
            positionSelects: mapValues('[id^="ign_badge_position_"]')
        };
    }
    function applyPanelSnapshot(overlay, list, snap) {
        if (!snap) return;
        snap.order.forEach(key => { const li = list.querySelector(`.ign_order_item[data-key="${key}"]`); if (li) list.appendChild(li); });
        Object.keys(snap.visible).forEach(key => { const cb = overlay.querySelector(`.ign_visible_checkbox[data-key="${key}"]`); if (cb) cb.checked = snap.visible[key]; });
        // Separate Entry checkboxes drive block creation/removal via their own change listener, so
        // only dispatch when the freshly-rebuilt (storage) value actually differs from the snapshot —
        // this both avoids redundant work and lets the listener build each block with the right
        // platform selects before location values are restored onto them below.
        Object.keys(snap.separate).forEach(key => {
            const cb = overlay.querySelector(`.ign_separate_checkbox[data-key="${key}"]`);
            if (cb && cb.checked !== snap.separate[key]) { cb.checked = snap.separate[key]; cb.dispatchEvent(new Event("change", { bubbles: true })); }
        });
        if (snap.combineAll !== null) {
            const cb = overlay.querySelector("#ign_combine_all");
            if (cb && cb.checked !== snap.combineAll) { cb.checked = snap.combineAll; cb.dispatchEvent(new Event("change", { bubbles: true })); }
        }
        [snap.locationSelects, snap.combineLocationSelects, snap.positionSelects].forEach(map => {
            Object.keys(map).forEach(id => { const sel = overlay.querySelector("#" + id); if (sel) sel.value = map[id]; });
        });
    }
    NS.openSettingsPanel = function openSettingsPanel() {
        const prevOverlay = document.getElementById("ign_settings_overlay");
        const snapshot = snapshotPanelState(prevOverlay, prevOverlay ? prevOverlay.querySelector("#ign_order_list") : null);
        prevOverlay?.remove();
        document.body.insertAdjacentHTML("beforeend", buildSettingsPanelHtml());
        const overlay = document.getElementById("ign_settings_overlay");
        const list = document.getElementById("ign_order_list");
        wireDragReorder(list);
        // Rebuilds the "shared location" info note from the live (unsaved) checkbox/select state
        // plus the live (unsaved) Section Order — called whenever any of those change. Formatted as
        // a single "Overlapping Locations:" heading with one line per Location that currently has
        // 2+ sections sharing it, e.g. "Below Game Media : HowLongToBeat ; HLTB Leisure Time".
        function syncSharedLocationNotes() {
            const container = overlay.querySelector("#ign_shared_location_notes");
            if (!container) return;
            const order = Array.from(list.querySelectorAll(".ign_order_item")).map(li => li.dataset.key);
            const shared = NS.getPlacementShared();
            const sections = [];
            NS.getVisiblePlatforms().forEach(platform => {
                const groups = computeSharedLocationGroups(overlay, platform);
                if (!groups.length) return;
                const lines = groups.map(g => {
                    const names = order.filter(k => g.keys.includes(k)).map(k => NS.escapeHtml(NS.SECTION_LABELS[k] || k)).join(" ; ");
                    const posLabel = NS.escapeHtml((NS.LOCATION_OPTIONS.find(o => o.value === g.loc) || {}).label || g.loc);
                    return `<strong style="color:#c6d4df;">${posLabel}</strong> : ${names}`;
                });
                const prefix = shared ? "" : `<strong style="color:#c6d4df;">${NS.escapeHtml(platform)}</strong><br>`;
                sections.push(`${prefix}${lines.join("<br>")}`);
            });
            container.innerHTML = sections.length
                ? `<p class="ign_settings_sub" style="margin-top:10px;margin-bottom:0;"><strong style="color:#c6d4df;">Overlapping Locations:</strong><br>${sections.join("<br>")}<br><br><span style="opacity:0.8;">Drag items in Section Order above to change their combined order.</span></p>`
                : "";
        }
        syncSharedLocationNotes();
        // "Separate Entry" checkbox column: adds/removes that section's per-platform Location
        // select block live (unsaved) as each box is (un)checked, defaulting a freshly-checked
        // section to DEFAULT_SEPARATE_LOCATION rather than storage (which would still read "inline"
        // until Save).
        const DEFAULT_SEPARATE_LOCATION = "belowGameMedia";
        overlay.querySelectorAll(".ign_separate_checkbox").forEach(checkbox => {
            checkbox.addEventListener("change", () => {
                const key = checkbox.dataset.key;
                const wrap = overlay.querySelector("#ign_key_locations_wrap");
                if (!wrap) return;
                const existing = wrap.querySelector(`[data-key-location-block="${key}"]`);
                if (checkbox.checked && !existing) {
                    const platforms = NS.getVisiblePlatforms();
                    const shared = NS.getPlacementShared();
                    const opts = NS.LOCATION_OPTIONS.map(opt => `<option value="${opt.value}" ${opt.value === DEFAULT_SEPARATE_LOCATION ? "selected" : ""}>${NS.escapeHtml(opt.label)}</option>`).join("");
                    const heading = NS.SECTION_LABELS[key] || key;
                    const selects = platforms.map(p => {
                        const labelHtml = shared ? "" : `<label style="display:block;font-size:10px;color:#a1b0bd;text-transform:uppercase;font-weight:bold;margin-bottom:5px;">${p}</label>`;
                        return `<div>${labelHtml}<select id="ign_${key}_location_${p}" class="ign_settings_select" data-key="${key}" data-platform="${p}">${opts}</select></div>`;
                    }).join("");
                    wrap.insertAdjacentHTML("beforeend", `<div class="ign_key_location_block" data-key-location-block="${key}"><h3>${NS.escapeHtml(heading)}</h3><div class="ign_locations_row">${selects}</div></div>`);
                    wrap.querySelectorAll(`[data-key-location-block="${key}"] select`).forEach(sel => sel.addEventListener("change", syncSharedLocationNotes));
                } else if (!checkbox.checked && existing) {
                    existing.remove();
                }
                syncSharedLocationNotes();
            });
        });
        overlay.querySelectorAll("[data-key-location-block] select").forEach(sel => sel.addEventListener("change", syncSharedLocationNotes));
        list.addEventListener("dragend", syncSharedLocationNotes);
        // "Combine all entries in one place": while on, every individual Separate Entry / Location
        // choice below is overridden (see NS.getSectionLocation() in 01-config-store.js) — so its own
        // per-platform Location select(s) are shown instead, and the (now-moot) individual location
        // UI is hidden rather than removed, so turning this back off instantly reveals each section's
        // untouched previous configuration.
        const combineAllCheckbox = overlay.querySelector("#ign_combine_all");
        const combineAllLocations = overlay.querySelector("#ign_combine_all_locations");
        const keyLocationsWrap = overlay.querySelector("#ign_key_locations_wrap");
        const sharedLocationNotes = overlay.querySelector("#ign_shared_location_notes");
        function syncCombineAllUi() {
            const on = combineAllCheckbox.checked;
            if (combineAllLocations) combineAllLocations.style.display = on ? "" : "none";
            if (keyLocationsWrap) keyLocationsWrap.style.display = on ? "none" : "";
            if (sharedLocationNotes) sharedLocationNotes.style.display = on ? "none" : "";
        }
        if (combineAllCheckbox) combineAllCheckbox.addEventListener("change", syncCombineAllUi);
        applyPanelSnapshot(overlay, list, snapshot);
        syncSharedLocationNotes();
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
            list.querySelectorAll(".ign_visible_checkbox").forEach(cb => {
                (NS.SECTION_CONFIG_KEYS[cb.dataset.key] || []).forEach(configKey => NS.storage.set(configKey, cb.checked));
            });
            NS.setSectionOrder(Array.from(list.querySelectorAll(".ign_order_item")).map(li => li.dataset.key));
            const shared = NS.getPlacementShared();
            const combineAllChecked = combineAllCheckbox ? combineAllCheckbox.checked : false;
            NS.getVisiblePlatforms().forEach(platform => {
                const targets = shared ? NS.PLATFORMS : [ platform ];
                targets.forEach(p => NS.setCombineAllFor(p, combineAllChecked));
                const combineSel = overlay.querySelector(`#ign_combine_location_${platform}`);
                if (combineSel) targets.forEach(p => NS.setCombineLocationFor(p, combineSel.value));
                const posSel = overlay.querySelector(`#ign_badge_position_${platform}`);
                if (posSel) targets.forEach(p => NS.setBadgePositionFor(p, posSel.value));
                NS.getSectionOrder().forEach(key => {
                    const sel = overlay.querySelector(`#ign_${key}_location_${platform}`);
                    // A key with no select present means its "Separate Entry" box is unchecked —
                    // explicitly write back "inline" so a previously-separate section reverts, rather
                    // than leaving its old (now-invisible) location value in storage.
                    targets.forEach(p => NS.setSectionLocationFor(key, p, sel ? sel.value : "inline"));
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
