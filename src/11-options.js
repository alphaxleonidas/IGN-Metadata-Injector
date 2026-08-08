// IGN Metadata Injector — extension options page
// Used only when the settings page opens as a dedicated extension tab (via
// manifest.*.json's "options_ui"). Self-contained — doesn't touch
// window.IGN_METADATA_INJECTOR (an options page can't reach a content
// script's namespace) — talks to chrome.storage.local directly using the
// same key names 01-config-store.js reads/writes under an extension.
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
        { value: 'default', label: 'Default' },
        { value: 'aboveTitle', label: 'Above Game Title' },
        { value: 'belowGameMedia', label: 'Below Game Media' },
        { value: 'abovePrice', label: 'Steam: Above Game Price | Epic: Above Game Description' },
        { value: 'belowLeftSidebar', label: 'Below Left Sidebar' },
        { value: 'aboveRightSidebarMetadata', label: 'Above Right Side Metadata' },
        { value: 'belowRightSidebarMetadata', label: 'Below Right Side Metadata' },
        { value: 'sidebarBottom', label: 'Bottom of Right Sidebar' }
    ];
    const LOCATION_OPTIONS = [{ value: 'inline', label: 'Inline (Default)' }, ...BADGE_POSITION_OPTIONS];

    // Position/location settings are stored per-platform (badgePositionSteam,
    // badgePositionEpic, hltbLocationSteam, ...) so Steam and Epic can be
    // configured independently from this one page.
    const PLATFORMS = ['Steam', 'Epic'];
    const ENABLE_KEYS = PLATFORMS.map(p => 'enabled' + p);
    const POSITION_KEYS = PLATFORMS.map(p => 'badgePosition' + p);
    const LOCATION_KEYS = ['hltb', 'leisure'].flatMap(k => PLATFORMS.map(p => k + 'Location' + p));
    // Which platforms get a placement column: disabled sites drop out; when sharing,
    // only the first enabled site's column is shown (its value is mirrored to both).
    const visiblePlatforms = (enabledMap, shared) => {
        const enabled = PLATFORMS.filter(p => enabledMap[p]);
        return shared ? enabled.slice(0, 1) : enabled;
    };

    const STORAGE_KEYS = [...Object.keys(CONFIG_KEYS), 'sectionOrder', ...ENABLE_KEYS, 'placementShared', ...POSITION_KEYS, ...LOCATION_KEYS, 'userTitleOverrides'];

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
            ENABLE_KEYS.forEach(k => result[k] = stored[k] !== undefined ? stored[k] : true);
            result.placementShared = stored.placementShared || false;
            POSITION_KEYS.forEach(k => result[k] = stored[k] || 'default');
            LOCATION_KEYS.forEach(k => result[k] = stored[k] || 'inline');
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

    function renderEnableToggles(container, state) {
        container.innerHTML = PLATFORMS.map(p => `
            <label class="toggle_row">
                <span>Enable on ${p}</span>
                <span class="switch">
                    <input type="checkbox" data-site-enable="${p}" ${state['enabled' + p] ? 'checked' : ''}>
                    <span class="switch_slider"></span>
                </span>
            </label>`).join('');
    }

    // Renders one <select> per visible platform into `container`, each with id `${idPrefix}${platform}`.
    function renderPlatformSelects(container, idPrefix, options, state, platforms, shared) {
        container.innerHTML = platforms.map(platform => {
            const key = idPrefix + platform;
            const current = state[key];
            const opts = options.map(opt =>
                `<option value="${opt.value}" ${opt.value === current ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
            ).join('');
            const label = shared ? 'Steam + Epic' : platform;
            return `<div><label class="platform_select_label">${label}</label><select id="sel_${key}" class="select">${opts}</select></div>`;
        }).join('');
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
        const enableList = document.getElementById('enable_list');
        const sharedToggle = document.getElementById('placement_shared');
        const positionSelects = document.getElementById('position_selects');
        const hltbLocationSelects = document.getElementById('hltb_location_selects');
        const leisureLocationSelects = document.getElementById('leisure_location_selects');
        const overrideList = document.getElementById('override_list');
        const overrideEmpty = document.getElementById('override_empty');
        const saveBtn = document.getElementById('save');
        const saveStatus = document.getElementById('save_status');

        function refreshOverrides(overrides) {
            renderOverrides(overrideList, overrideEmpty, overrides, (key) => {
                chrome.storage.local.get(['userTitleOverrides'], (stored) => {
                    const all = stored.userTitleOverrides || {};
                    delete all[key];
                    chrome.storage.local.set({ userTitleOverrides: all }, () => refreshOverrides(all));
                });
            });
        }

        function currentEnabledMap() {
            const map = {};
            enableList.querySelectorAll('input[data-site-enable]').forEach(input => {
                map[input.dataset.siteEnable] = input.checked;
            });
            return map;
        }

        function renderPlacementSelects(state) {
            const shared = sharedToggle.checked;
            const platforms = visiblePlatforms(currentEnabledMap(), shared);
            renderPlatformSelects(positionSelects, 'badgePosition', BADGE_POSITION_OPTIONS, state, platforms, shared);
            renderPlatformSelects(hltbLocationSelects, 'hltbLocation', LOCATION_OPTIONS, state, platforms, shared);
            renderPlatformSelects(leisureLocationSelects, 'leisureLocation', LOCATION_OPTIONS, state, platforms, shared);
        }

        loadAll((state) => {
            renderToggles(toggleList, state);
            renderOrderList(orderList, state.sectionOrder);
            renderEnableToggles(enableList, state);
            sharedToggle.checked = state.placementShared;
            renderPlacementSelects(state);
            refreshOverrides(state.userTitleOverrides);
            sharedToggle.addEventListener('change', () => renderPlacementSelects(state));
            enableList.querySelectorAll('input[data-site-enable]').forEach(input => {
                input.addEventListener('change', () => renderPlacementSelects(state));
            });
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
            enableList.querySelectorAll('input[data-site-enable]').forEach(input => {
                toSave['enabled' + input.dataset.siteEnable] = input.checked;
            });
            toSave.placementShared = sharedToggle.checked;
            const shared = sharedToggle.checked;
            visiblePlatforms(currentEnabledMap(), shared).forEach(platform => {
                const targets = shared ? PLATFORMS : [platform];
                const posSel = document.getElementById('sel_badgePosition' + platform);
                if (posSel) targets.forEach(p => toSave['badgePosition' + p] = posSel.value);
                ['hltb', 'leisure'].forEach(k => {
                    const sel = document.getElementById('sel_' + k + 'Location' + platform);
                    if (sel) targets.forEach(p => toSave[k + 'Location' + p] = sel.value);
                });
            });

            chrome.storage.local.set(toSave, () => {
                saveStatus.textContent = 'Saved ✓';
                saveStatus.classList.add('visible');
                setTimeout(() => saveStatus.classList.remove('visible'), 2000);
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
