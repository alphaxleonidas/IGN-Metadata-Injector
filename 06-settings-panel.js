// ===================================================================
// IGN Rating Badge — 06: Settings panel (in-page overlay)
// ===================================================================
// The overlay UI for editing settings. Reads/writes through NS.getConfig
// /NS.setSectionOrder/etc (01-config-store.js) and re-renders the badge
// via NS.init() (10-main.js) on save. Restyling the panel or changing its
// layout only ever touches this file.
(function (NS) {
    'use strict';

    const SETTINGS_PANEL_STYLE = `
        <style>
            #ign_settings_overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 999999;
                display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            #ign_settings_panel { background: linear-gradient(135deg, rgba(20,20,20,0.98), rgba(35,35,35,0.98));
                border-radius: 10px; border-left: 5px solid #ff3e3e; box-shadow: 0 8px 30px rgba(0,0,0,0.6);
                width: 520px; max-width: 92vw; max-height: 85vh; overflow-y: auto; padding: 20px 22px; color: #ffffff; }
            #ign_settings_panel h2 { margin: 0 0 4px; font-size: 16px; color: #ff3e3e; text-transform: uppercase; letter-spacing: 0.5px; }
            #ign_settings_panel h3 { margin: 0 0 10px; font-size: 11px; color: #a1b0bd; text-transform: uppercase; letter-spacing: 0.5px; }
            .ign_settings_sub { font-size: 11px; color: #8f98a0; margin: 0 0 18px; }
            .ign_settings_columns { display: flex; gap: 22px; flex-wrap: wrap; }
            .ign_settings_columns > div { flex: 1; min-width: 210px; }
            .ign_settings_toggle_row { display: flex; align-items: center; justify-content: space-between;
                padding: 7px 0; font-size: 12px; color: #c6d4df; border-bottom: 1px solid rgba(255,255,255,0.08); cursor: pointer; }
            .ign_switch { position: relative; display: inline-block; width: 36px; height: 20px; flex-shrink: 0; margin-left: 10px; }
            .ign_switch input { opacity: 0; width: 0; height: 0; }
            .ign_switch_slider { position: absolute; inset: 0; background: rgba(255,255,255,0.15); border-radius: 20px; transition: 0.2s; }
            .ign_switch_slider::before { content: ""; position: absolute; height: 14px; width: 14px; left: 3px; top: 3px;
                background: #ffffff; border-radius: 50%; transition: 0.2s; }
            .ign_switch input:checked + .ign_switch_slider { background: #66c0f4; }
            .ign_switch input:checked + .ign_switch_slider::before { transform: translateX(16px); }
            #ign_order_list { list-style: none; margin: 0; padding: 0; }
            .ign_order_item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; margin-bottom: 6px;
                background: rgba(255,255,255,0.04); border-radius: 6px; font-size: 12px; color: #c6d4df; cursor: grab; }
            .ign_order_item.ign_drag_over { border: 1px dashed #66c0f4; }
            .ign_order_handle { color: #8f98a0; font-size: 14px; }
            .ign_settings_actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
            .ign_settings_actions button { border: none; border-radius: 6px; padding: 8px 16px; font-size: 12px;
                font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer; }
            #ign_settings_save { background: #ff3e3e; color: #ffffff; }
            #ign_settings_cancel { background: rgba(255,255,255,0.1); color: #c6d4df; }
            .ign_settings_select { width: 100%; background: rgba(255,255,255,0.06); color: #c6d4df;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_locations_row { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 10px; }
            .ign_locations_row > div { flex: 1; min-width: 200px; }
            .ign_locations_row label { display: block; font-size: 10px; color: #a1b0bd; text-transform: uppercase;
                font-weight: bold; letter-spacing: 0.3px; margin-bottom: 5px; }
            #ign_override_list { list-style: none; margin: 0 0 10px; padding: 0; max-height: 160px; overflow-y: auto; }
            .ign_override_item { display: flex; align-items: center; justify-content: space-between; gap: 8px;
                padding: 7px 10px; margin-bottom: 6px; background: rgba(255,255,255,0.04); border-radius: 6px;
                font-size: 12px; color: #c6d4df; }
            .ign_override_item_main { display: flex; align-items: center; gap: 8px; overflow: hidden; }
            .ign_override_item_main strong { font-size: 12px; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .ign_override_pill { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px;
                color: #ff3e3e; border: 1px solid rgba(255,62,62,0.5); border-radius: 4px; padding: 1px 5px; flex-shrink: 0; }
            .ign_override_pill_hltb { color: #66c0f4; border-color: rgba(102,192,244,0.5); }
            .ign_override_remove { background: transparent; border: none; color: #8f98a0; cursor: pointer;
                font-size: 13px; padding: 2px 6px; flex-shrink: 0; }
            .ign_override_remove:hover { color: #ff3e3e; }
            .ign_override_empty { font-size: 11px; color: #8f98a0; margin: 0 0 10px; }
            .ign_override_form { display: flex; flex-direction: column; gap: 6px; }
            .ign_override_form input { background: rgba(255,255,255,0.06); color: #c6d4df;
                border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
            .ign_override_form button { align-self: flex-end; border: none; border-radius: 6px; padding: 7px 14px;
                font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; cursor: pointer;
                background: rgba(102,192,244,0.15); color: #66c0f4; }
        </style>`;

    function buildSettingsPanelHtml() {
        const toggleRows = Object.keys(NS.CONFIG_KEYS).map(key => `
            <label class="ign_settings_toggle_row">
                <span>${NS.escapeHtml(NS.CONFIG_KEYS[key])}</span>
                <span class="ign_switch">
                    <input type="checkbox" data-toggle-key="${key}" ${NS.getConfig(key) ? 'checked' : ''}>
                    <span class="ign_switch_slider"></span>
                </span>
            </label>`).join('');

        const orderRows = NS.getSectionOrder().map(key => `
            <li class="ign_order_item" draggable="true" data-key="${key}">
                <span class="ign_order_handle">⠿</span>
                <span>${NS.escapeHtml(NS.SECTION_LABELS[key] || key)}</span>
            </li>`).join('');

        const currentPosition = NS.getBadgePosition();
        const positionOptionsHtml = NS.BADGE_POSITION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentPosition ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        // HLTB and HLTB Leisure Time each get their own independent location — either can stay
        // 'inline' inside the main badge, or be moved to any of the same page locations the
        // main badge itself can use.
        const currentHltbLocation = NS.getHltbLocation();
        const hltbLocationOptionsHtml = NS.HLTB_LOCATION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentHltbLocation ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        const currentLeisureLocation = NS.getLeisureLocation();
        const leisureLocationOptionsHtml = NS.HLTB_LOCATION_OPTIONS.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentLeisureLocation ? 'selected' : ''}>${NS.escapeHtml(opt.label)}</option>`
        ).join('');

        // Manual per-title overrides — see NS.getUserOverrides in 01-config-store.js.
        const userOverrides = NS.getUserOverrides();
        const overrideKeys = Object.keys(userOverrides);
        const overrideRowsHtml = overrideKeys.length === 0
            ? ''
            : overrideKeys.map(key => {
                const entry = userOverrides[key];
                const pills = [
                    entry.ignUrl ? `<span class="ign_override_pill">IGN</span>` : '',
                    entry.hltbUrl ? `<span class="ign_override_pill ign_override_pill_hltb">HLTB</span>` : ''
                ].join('');
                return `
                    <li class="ign_override_item">
                        <span class="ign_override_item_main">
                            <strong title="${NS.escapeHtml(entry.displayTitle || key)}">${NS.escapeHtml(entry.displayTitle || key)}</strong>
                            ${pills}
                        </span>
                        <button class="ign_override_remove" data-key="${NS.escapeHtml(key)}" title="Remove override">✕</button>
                    </li>`;
            }).join('');

        return `
            ${SETTINGS_PANEL_STYLE}
            <div id="ign_settings_overlay">
                <div id="ign_settings_panel">
                    <h2>IGN Script Settings</h2>
                    <p class="ign_settings_sub">Changes apply immediately on save — no page refresh needed.</p>
                    <div class="ign_settings_columns">
                        <div>
                            <h3>Visible Sections</h3>
                            ${toggleRows}
                        </div>
                        <div>
                            <h3>Section Order (drag to reorder)</h3>
                            <ul id="ign_order_list">${orderRows}</ul>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <h3>Overlay Position</h3>
                        <select id="ign_badge_position" class="ign_settings_select">
                            ${positionOptionsHtml}
                        </select>
                    </div>
                    <div class="ign_locations_row">
                        <div>
                            <label>HowLongToBeat Location</label>
                            <select id="ign_hltb_location" class="ign_settings_select">
                                ${hltbLocationOptionsHtml}
                            </select>
                        </div>
                        <div>
                            <label>HLTB Leisure Time Location</label>
                            <select id="ign_leisure_location" class="ign_settings_select">
                                ${leisureLocationOptionsHtml}
                            </select>
                        </div>
                    </div>
                    <div style="margin-top:18px;">
                        <h3>Per-Title Overrides</h3>
                        <p class="ign_settings_sub" style="margin-bottom:8px;">
                            For games that won't auto-resolve: force an exact IGN page and/or an exact
                            HowLongToBeat page for one title. Matched by exact title (case-insensitive).
                            Added/removed immediately — no need to hit Save below.
                        </p>
                        ${overrideKeys.length === 0 ? '<p class="ign_override_empty">No overrides added yet.</p>' : `<ul id="ign_override_list">${overrideRowsHtml}</ul>`}
                        <div class="ign_override_form">
                            <input type="text" id="ign_override_title" placeholder="Game title, exactly as shown on the store page">
                            <input type="text" id="ign_override_ign_url" placeholder="IGN URL (optional) — e.g. https://www.ign.com/games/some-slug">
                            <input type="text" id="ign_override_hltb_url" placeholder="HowLongToBeat URL (optional) — e.g. https://howlongtobeat.com/game/1234">
                            <button id="ign_override_add">Add / Update</button>
                        </div>
                    </div>
                    <div class="ign_settings_actions">
                        <button id="ign_settings_cancel">Cancel</button>
                        <button id="ign_settings_save">Save</button>
                    </div>
                </div>
            </div>`;
    }

    function refreshBadgeNow() {
        NS.state.lastProcessedTitle = '';
        const existingBadge = document.querySelector('.ign_rating_row');
        if (existingBadge) existingBadge.remove();
        NS.init();
    }

    NS.openSettingsPanel = function openSettingsPanel() {
        const existing = document.getElementById('ign_settings_overlay');
        if (existing) existing.remove();

        document.body.insertAdjacentHTML('beforeend', buildSettingsPanelHtml());
        const overlay = document.getElementById('ign_settings_overlay');
        const list = document.getElementById('ign_order_list');

        // Drag-and-drop reordering
        let draggedItem = null;
        list.querySelectorAll('.ign_order_item').forEach(item => {
            item.addEventListener('dragstart', () => { draggedItem = item; item.style.opacity = '0.4'; });
            item.addEventListener('dragend', () => { item.style.opacity = '1'; item.classList.remove('ign_drag_over'); });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const bounds = item.getBoundingClientRect();
                const isAfter = (e.clientY - bounds.top) > bounds.height / 2;
                item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
            });
        });

        // Per-title override add/remove — these apply immediately (not tied to Save/Cancel),
        // since they're closer to a small CRUD list than an on/off toggle. Simplest way to
        // reflect the change in the list is to just reopen the panel.
        overlay.querySelectorAll('.ign_override_remove').forEach(btn => {
            btn.addEventListener('click', () => {
                NS.removeUserOverride(btn.dataset.key);
                refreshBadgeNow();
                NS.openSettingsPanel();
            });
        });

        overlay.querySelector('#ign_override_add').addEventListener('click', () => {
            const titleInput = overlay.querySelector('#ign_override_title');
            const ignInput = overlay.querySelector('#ign_override_ign_url');
            const hltbInput = overlay.querySelector('#ign_override_hltb_url');
            const title = titleInput.value.trim();
            const ignUrl = ignInput.value.trim();
            const hltbUrl = hltbInput.value.trim();
            if (!title || (!ignUrl && !hltbUrl)) return;

            NS.setUserOverride(title, ignUrl, hltbUrl);
            refreshBadgeNow();
            NS.openSettingsPanel();
        });

        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#ign_settings_cancel').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#ign_settings_save').addEventListener('click', () => {
            overlay.querySelectorAll('input[data-toggle-key]').forEach(input => {
                GM_setValue(input.dataset.toggleKey, input.checked);
            });
            const newOrder = Array.from(list.querySelectorAll('.ign_order_item')).map(li => li.dataset.key);
            NS.setSectionOrder(newOrder);
            const positionSelect = overlay.querySelector('#ign_badge_position');
            if (positionSelect) NS.setBadgePosition(positionSelect.value);
            const hltbLocationSelect = overlay.querySelector('#ign_hltb_location');
            if (hltbLocationSelect) NS.setHltbLocation(hltbLocationSelect.value);
            const leisureLocationSelect = overlay.querySelector('#ign_leisure_location');
            if (leisureLocationSelect) NS.setLeisureLocation(leisureLocationSelect.value);
            overlay.remove();
            NS.registerMenuCommands();
            refreshBadgeNow();
        });
    };

})(window.IGN_METADATA_INJECTOR = window.IGN_METADATA_INJECTOR || {});
