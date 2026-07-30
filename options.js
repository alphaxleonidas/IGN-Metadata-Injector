// ===================================================================
// IGN Metadata Injector — extension options page
// ===================================================================
// This is the ONLY file used when the settings page is opened as a
// dedicated extension tab (via manifest.*.json's "options_ui"). It's
// intentionally self-contained and does NOT touch window.IGN_METADATA_INJECTOR
// or any GM_* call — those only exist inside a content script/userscript
// context, and this page runs as its own separate document. It talks to
// the same underlying keys via chrome.storage.local instead, so the
// values line up with src/01-config-store.js once that file's GM_getValue
// /GM_setValue calls are swapped for chrome.storage.local (the one bit of
// real porting work noted in README.md / MANIFESTS.md).
(function () {
    'use strict';

    const CONFIG_KEYS = {
        showIgnScore: 'Show IGN Score',
        showUserRating: 'Show User Rating',
        showHltb: 'Show HowLongToBeat',
        showLeisure: 'Show HLTB Leisure Times',
        showSteamReviews: 'Show Steam Reviews',
        showDeveloper: 'Show Developer',
        showEsrb: 'Show ESRB Rating & Descriptors',
        showAward: 'Show IGN Award / Leaderboard'
    };

    const CONFIG_DEFAULTS = {
        showIgnScore: true,
        showUserRating: true,
        showHltb: true,
        showLeisure: true,
        showSteamReviews: true,
        showDeveloper: true,
        showEsrb: true,
        showAward: true
    };

    const SECTION_LABELS = {
        scores: 'IGN Score / User Rating',
        steamReviews: 'Steam Reviews',
        award: 'Leaderboard Rank',
        esrb: 'ESRB Rating',
        developer: 'Developer',
        hltb: 'HowLongToBeat',
        leisure: 'HLTB Leisure Time'
    };
    const DEFAULT_SECTION_ORDER = ['scores', 'steamReviews', 'award', 'esrb', 'developer', 'hltb', 'leisure'];

    const BADGE_POSITION_OPTIONS = [
        { value: 'default', label: 'Default (near header / reviews)' },
        { value: 'aboveTitle', label: "Above the game's title" },
        { value: 'sidebarBottom', label: 'Bottom of right sidebar metadata' },
        { value: 'abovePrice', label: 'Above price / buy box (Steam only)' },
        { value: 'aboveExternalLinks', label: 'Above external links row (SteamDB, ProtonDB, etc.)' },
        { value: 'belowExternalLinks', label: 'Below external links row (SteamDB, ProtonDB, etc.)' }
    ];

    const HLTB_LOCATION_OPTIONS = [
        { value: 'inline', label: 'Inline within main badge (default)' },
        ...BADGE_POSITION_OPTIONS
    ];

    const STORAGE_KEYS = [
        ...Object.keys(CONFIG_KEYS),
        'sectionOrder', 'badgePosition', 'hltbLocation', 'leisureLocation', 'userTitleOverrides'
    ];

    function escapeHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function loadAll(callback) {
        chrome.storage.local.get(STORAGE_KEYS, (stored) => {
            const result = {};
            Object.keys(CONFIG_KEYS).forEach(key => {
                result[key] = stored[key] !== undefined ? stored[key] : CONFIG_DEFAULTS[key];
            });

            const storedOrder = stored.sectionOrder;
            let order;
            if (Array.isArray(storedOrder) && storedOrder.length > 0) {
                const known = storedOrder.filter(k => DEFAULT_SECTION_ORDER.includes(k));
                const missing = DEFAULT_SECTION_ORDER.filter(k => !known.includes(k));
                order = [...known, ...missing];
            } else {
                order = [...DEFAULT_SECTION_ORDER];
            }
            result.sectionOrder = order;

            result.badgePosition = stored.badgePosition || 'default';
            result.hltbLocation = stored.hltbLocation || 'inline';
            result.leisureLocation = stored.leisureLocation || 'inline';
            result.userTitleOverrides = stored.userTitleOverrides || {};

            callback(result);
        });
    }

    function renderToggles(container, state) {
        container.innerHTML = Object.keys(CONFIG_KEYS).map(key => `
            <label class="toggle_row">
                <span>${escapeHtml(CONFIG_KEYS[key])}</span>
                <span class="switch">
                    <input type="checkbox" data-toggle-key="${key}" ${state[key] ? 'checked' : ''}>
                    <span class="switch_slider"></span>
                </span>
            </label>`).join('');
    }

    function renderOrderList(list, order) {
        list.innerHTML = order.map(key => `
            <li class="order_item" draggable="true" data-key="${key}">
                <span class="order_handle">⠿</span>
                <span>${escapeHtml(SECTION_LABELS[key] || key)}</span>
            </li>`).join('');

        let draggedItem = null;
        list.querySelectorAll('.order_item').forEach(item => {
            item.addEventListener('dragstart', () => { draggedItem = item; item.style.opacity = '0.4'; });
            item.addEventListener('dragend', () => { item.style.opacity = '1'; });
            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedItem || draggedItem === item) return;
                const bounds = item.getBoundingClientRect();
                const isAfter = (e.clientY - bounds.top) > bounds.height / 2;
                item.parentNode.insertBefore(draggedItem, isAfter ? item.nextSibling : item);
            });
        });
    }

    function renderSelect(select, options, currentValue) {
        select.innerHTML = options.map(opt =>
            `<option value="${opt.value}" ${opt.value === currentValue ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
        ).join('');
    }

    function renderOverrides(listEl, emptyEl, overrides, onRemove) {
        const keys = Object.keys(overrides);
        emptyEl.hidden = keys.length > 0;
        listEl.innerHTML = keys.map(key => {
            const entry = overrides[key];
            const pills = [
                entry.ignUrl ? `<span class="override_pill">IGN</span>` : '',
                entry.hltbUrl ? `<span class="override_pill hltb">HLTB</span>` : ''
            ].join('');
            return `
                <li class="override_item">
                    <span class="override_item_main">
                        <strong title="${escapeHtml(entry.displayTitle || key)}">${escapeHtml(entry.displayTitle || key)}</strong>
                        ${pills}
                    </span>
                    <button class="override_remove" data-key="${escapeHtml(key)}" title="Remove override">✕</button>
                </li>`;
        }).join('');

        listEl.querySelectorAll('.override_remove').forEach(btn => {
            btn.addEventListener('click', () => onRemove(btn.dataset.key));
        });
    }

    function init() {
        const toggleList = document.getElementById('toggle_list');
        const orderList = document.getElementById('order_list');
        const badgePositionSelect = document.getElementById('badge_position');
        const hltbLocationSelect = document.getElementById('hltb_location');
        const leisureLocationSelect = document.getElementById('leisure_location');
        const overrideList = document.getElementById('override_list');
        const overrideEmpty = document.getElementById('override_empty');
        const saveBtn = document.getElementById('save');
        const saveStatus = document.getElementById('save_status');

        renderSelect(badgePositionSelect, BADGE_POSITION_OPTIONS, 'default');
        renderSelect(hltbLocationSelect, HLTB_LOCATION_OPTIONS, 'inline');
        renderSelect(leisureLocationSelect, HLTB_LOCATION_OPTIONS, 'inline');

        function refreshOverrides(overrides) {
            renderOverrides(overrideList, overrideEmpty, overrides, (key) => {
                chrome.storage.local.get(['userTitleOverrides'], (stored) => {
                    const all = stored.userTitleOverrides || {};
                    delete all[key];
                    chrome.storage.local.set({ userTitleOverrides: all }, () => refreshOverrides(all));
                });
            });
        }

        loadAll((state) => {
            renderToggles(toggleList, state);
            renderOrderList(orderList, state.sectionOrder);
            badgePositionSelect.value = state.badgePosition;
            hltbLocationSelect.value = state.hltbLocation;
            leisureLocationSelect.value = state.leisureLocation;
            refreshOverrides(state.userTitleOverrides);
        });

        document.getElementById('override_add').addEventListener('click', () => {
            const titleInput = document.getElementById('override_title');
            const ignInput = document.getElementById('override_ign_url');
            const hltbInput = document.getElementById('override_hltb_url');
            const title = titleInput.value.trim();
            const ignUrl = ignInput.value.trim();
            const hltbUrl = hltbInput.value.trim();
            if (!title || (!ignUrl && !hltbUrl)) return;

            const key = title.toLowerCase();
            chrome.storage.local.get(['userTitleOverrides'], (stored) => {
                const all = stored.userTitleOverrides || {};
                all[key] = { displayTitle: title, ignUrl, hltbUrl };
                chrome.storage.local.set({ userTitleOverrides: all }, () => {
                    titleInput.value = '';
                    ignInput.value = '';
                    hltbInput.value = '';
                    refreshOverrides(all);
                });
            });
        });

        saveBtn.addEventListener('click', () => {
            const toSave = {};
            toggleList.querySelectorAll('input[data-toggle-key]').forEach(input => {
                toSave[input.dataset.toggleKey] = input.checked;
            });
            toSave.sectionOrder = Array.from(orderList.querySelectorAll('.order_item')).map(li => li.dataset.key);
            toSave.badgePosition = badgePositionSelect.value;
            toSave.hltbLocation = hltbLocationSelect.value;
            toSave.leisureLocation = leisureLocationSelect.value;

            chrome.storage.local.set(toSave, () => {
                saveStatus.textContent = 'Saved ✓';
                saveStatus.classList.add('visible');
                setTimeout(() => saveStatus.classList.remove('visible'), 2000);
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
