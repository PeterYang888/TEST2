// ─── Floating UI Panel ───

var PANEL_CSS = '\
#sr-panel {\
  position: fixed;\
  bottom: 20px;\
  right: 20px;\
  width: 360px;\
  max-height: 520px;\
  background: #1a1a2e;\
  color: #e0e0e0;\
  border: 1px solid #16213e;\
  border-radius: 10px;\
  font-family: "Segoe UI", Arial, sans-serif;\
  font-size: 13px;\
  z-index: 2147483647;\
  box-shadow: 0 4px 24px rgba(0,0,0,0.5);\
  display: flex;\
  flex-direction: column;\
  overflow: hidden;\
  user-select: none;\
}\
#sr-header {\
  display: flex;\
  align-items: center;\
  justify-content: space-between;\
  padding: 8px 12px;\
  background: #16213e;\
  cursor: move;\
  border-radius: 10px 10px 0 0;\
}\
#sr-header .sr-title {\
  font-weight: bold;\
  font-size: 14px;\
  color: #e94560;\
}\
#sr-header .sr-btns button {\
  background: none;\
  border: none;\
  color: #aaa;\
  font-size: 16px;\
  cursor: pointer;\
  padding: 0 4px;\
}\
#sr-header .sr-btns button:hover { color: #fff; }\
#sr-body {\
  padding: 10px 12px;\
  overflow-y: auto;\
  flex: 1;\
  max-height: 440px;\
}\
#sr-body.sr-minimized { display: none; }\
.sr-status {\
  display: flex;\
  align-items: center;\
  gap: 8px;\
  margin-bottom: 8px;\
}\
.sr-dot {\
  width: 10px;\
  height: 10px;\
  border-radius: 50%;\
  background: #666;\
}\
.sr-dot.active { background: #4ecca3; animation: sr-pulse 1.5s infinite; }\
@keyframes sr-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }\
.sr-stat { color: #aaa; }\
.sr-stat strong { color: #e0e0e0; }\
.sr-btn-row {\
  display: flex;\
  gap: 6px;\
  margin: 8px 0;\
  flex-wrap: wrap;\
}\
.sr-btn {\
  padding: 5px 10px;\
  border: 1px solid #333;\
  border-radius: 5px;\
  background: #0f3460;\
  color: #e0e0e0;\
  cursor: pointer;\
  font-size: 12px;\
  flex: 1;\
  text-align: center;\
}\
.sr-btn:hover { background: #1a5276; }\
.sr-btn.sr-rec { background: #c0392b; }\
.sr-btn.sr-rec:hover { background: #e74c3c; }\
.sr-btn.sr-stop { background: #27ae60; }\
.sr-last {\
  background: #0f3460;\
  border-radius: 5px;\
  padding: 6px 8px;\
  margin-top: 6px;\
  font-size: 11px;\
  line-height: 1.5;\
  word-break: break-all;\
}\
.sr-last-title {\
  font-weight: bold;\
  color: #e94560;\
  margin-bottom: 2px;\
}\
\
.sr-debug-log {\
  background: #111;\
  border-radius: 5px;\
  padding: 6px;\
  margin-top: 8px;\
  max-height: 180px;\
  overflow-y: auto;\
  font-size: 11px;\
  font-family: monospace;\
}\
.sr-debug-entry {\
  padding: 3px 0;\
  border-bottom: 1px solid #222;\
  cursor: pointer;\
}\
.sr-debug-entry:hover { background: #1a1a3e; }\
.sr-debug-url { color: #4ecca3; word-break: break-all; }\
.sr-debug-time { color: #666; font-size: 10px; }\
\
.sr-config-overlay {\
  position: fixed;\
  top: 0; left: 0; right: 0; bottom: 0;\
  background: rgba(0,0,0,0.7);\
  z-index: 2147483647;\
  display: flex;\
  align-items: center;\
  justify-content: center;\
}\
.sr-config-modal {\
  background: #1a1a2e;\
  border: 1px solid #16213e;\
  border-radius: 10px;\
  width: 520px;\
  max-height: 80vh;\
  overflow-y: auto;\
  padding: 20px;\
  color: #e0e0e0;\
  font-family: "Segoe UI", Arial, sans-serif;\
  font-size: 13px;\
}\
.sr-config-modal h3 {\
  color: #e94560;\
  margin: 0 0 12px 0;\
}\
.sr-config-modal label {\
  display: block;\
  margin: 8px 0 4px;\
  color: #aaa;\
  font-size: 12px;\
}\
.sr-config-modal input[type="text"] {\
  width: 100%;\
  padding: 6px 8px;\
  background: #111;\
  border: 1px solid #333;\
  border-radius: 4px;\
  color: #e0e0e0;\
  font-size: 12px;\
  font-family: monospace;\
  box-sizing: border-box;\
}\
.sr-config-modal .sr-btn-row { margin-top: 16px; }\
\
.sr-json-tree {\
  background: #111;\
  border-radius: 5px;\
  padding: 8px;\
  margin-top: 8px;\
  max-height: 250px;\
  overflow-y: auto;\
  font-family: monospace;\
  font-size: 11px;\
}\
.sr-json-row {\
  padding: 2px 0;\
  cursor: pointer;\
  display: flex;\
  gap: 8px;\
}\
.sr-json-row:hover { background: #1a1a3e; }\
.sr-json-path { color: #4ecca3; min-width: 200px; }\
.sr-json-val { color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\
.sr-json-assign {\
  color: #e94560;\
  font-size: 10px;\
  cursor: pointer;\
  margin-left: auto;\
  white-space: nowrap;\
}\
\
.sr-field-select {\
  position: absolute;\
  background: #16213e;\
  border: 1px solid #333;\
  border-radius: 5px;\
  padding: 4px 0;\
  z-index: 2147483648;\
  min-width: 160px;\
}\
.sr-field-option {\
  padding: 4px 12px;\
  cursor: pointer;\
  font-size: 12px;\
}\
.sr-field-option:hover { background: #0f3460; }\
';

function createPanel(config) {
  // Use shadow DOM to isolate styles
  var host = document.createElement('div');
  host.id = 'slot-recorder-host';
  var shadow = host.attachShadow({ mode: 'closed' });

  var style = document.createElement('style');
  style.textContent = PANEL_CSS;
  shadow.appendChild(style);

  var panel = document.createElement('div');
  panel.id = 'sr-panel';
  panel.innerHTML = buildPanelHTML(config);
  shadow.appendChild(panel);

  document.body.appendChild(host);

  bindPanelEvents(panel, shadow, config);
  makeDraggable(panel, shadow);
  setupCallbacks(panel, shadow, config);

  return { host: host, shadow: shadow, panel: panel };
}

function buildPanelHTML(config) {
  return '\
<div id="sr-header">\
  <span class="sr-title">Slot Recorder</span>\
  <span class="sr-btns">\
    <button id="sr-minimize" title="最小化">−</button>\
  </span>\
</div>\
<div id="sr-body">\
  <div class="sr-status">\
    <span class="sr-dot" id="sr-dot"></span>\
    <span class="sr-stat">狀態: <strong id="sr-state">停止</strong></span>\
    <span class="sr-stat" style="margin-left:auto">記錄: <strong id="sr-count">0</strong></span>\
  </div>\
  <div class="sr-btn-row">\
    <button class="sr-btn sr-rec" id="sr-toggle">開始錄製</button>\
    <button class="sr-btn" id="sr-export">匯出 CSV</button>\
  </div>\
  <div class="sr-btn-row">\
    <button class="sr-btn" id="sr-config-btn">設定</button>\
    <button class="sr-btn" id="sr-clear">清除記錄</button>\
    <button class="sr-btn" id="sr-debug-toggle">Debug Log</button>\
  </div>\
  <div id="sr-last-container"></div>\
  <div id="sr-debug-container" style="display:none">\
    <div class="sr-debug-log" id="sr-debug-log">等待攔截請求...</div>\
  </div>\
</div>';
}

function bindPanelEvents(panel, shadow, config) {
  var body = shadow.getElementById('sr-body');
  var dot = shadow.getElementById('sr-dot');
  var stateEl = shadow.getElementById('sr-state');
  var countEl = shadow.getElementById('sr-count');
  var toggleBtn = shadow.getElementById('sr-toggle');

  // Minimize
  shadow.getElementById('sr-minimize').addEventListener('click', function() {
    body.classList.toggle('sr-minimized');
    this.textContent = body.classList.contains('sr-minimized') ? '+' : '−';
  });

  // Toggle recording
  toggleBtn.addEventListener('click', function() {
    config.active = !config.active;
    _interceptorConfig.active = config.active;
    if (config.active) {
      dot.classList.add('active');
      stateEl.textContent = '錄製中';
      toggleBtn.textContent = '停止錄製';
      toggleBtn.classList.remove('sr-rec');
      toggleBtn.classList.add('sr-stop');
    } else {
      dot.classList.remove('active');
      stateEl.textContent = '停止';
      toggleBtn.textContent = '開始錄製';
      toggleBtn.classList.remove('sr-stop');
      toggleBtn.classList.add('sr-rec');
    }
    saveConfig(config);
  });

  // Export CSV
  shadow.getElementById('sr-export').addEventListener('click', function() {
    downloadCSV();
  });

  // Clear records
  shadow.getElementById('sr-clear').addEventListener('click', function() {
    if (confirm('確定要清除所有記錄？')) {
      clearRecords();
      countEl.textContent = '0';
      shadow.getElementById('sr-last-container').innerHTML = '';
    }
  });

  // Debug toggle
  shadow.getElementById('sr-debug-toggle').addEventListener('click', function() {
    var container = shadow.getElementById('sr-debug-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
  });

  // Config button
  shadow.getElementById('sr-config-btn').addEventListener('click', function() {
    showConfigModal(shadow, config);
  });
}

function setupCallbacks(panel, shadow, config) {
  var countEl = shadow.getElementById('sr-count');
  var lastContainer = shadow.getElementById('sr-last-container');
  var debugLog = shadow.getElementById('sr-debug-log');

  // When a new spin record is added
  onRecordAdded = function(record, count) {
    countEl.textContent = String(count);
    var html = '<div class="sr-last"><div class="sr-last-title">最近一筆 #' + count + '</div>';
    if (record.balance !== undefined) html += '餘額: ' + record.balance + '<br>';
    if (record.winAmount !== undefined) html += '贏得: ' + record.winAmount + '<br>';
    if (record.betAmount !== undefined) html += '下注: ' + record.betAmount + '<br>';
    if (record.freeSpins) html += 'Free Spin!<br>';
    if (record.bonusTriggered) html += 'Bonus!<br>';
    html += '</div>';
    lastContainer.innerHTML = html;
  };

  // When a network request is captured (debug mode)
  onRequestCaptured = function(entry) {
    if (shadow.getElementById('sr-debug-container').style.display === 'none') return;

    var time = entry.timestamp.split('T')[1].split('.')[0];
    var shortUrl = entry.url.length > 60 ? entry.url.substring(0, 60) + '...' : entry.url;

    var div = document.createElement('div');
    div.className = 'sr-debug-entry';
    div.innerHTML = '<span class="sr-debug-time">' + time + '</span> <span class="sr-debug-url">' + escapeHTML(shortUrl) + '</span>';

    div.addEventListener('click', function() {
      showJSONInspector(shadow, config, entry);
    });

    debugLog.appendChild(div);
    // Auto-scroll
    debugLog.scrollTop = debugLog.scrollHeight;

    // Keep bounded
    while (debugLog.children.length > 50) {
      debugLog.removeChild(debugLog.firstChild);
    }
  };
}

// ── Config Modal ──

function showConfigModal(shadow, config) {
  // Remove existing
  var existing = shadow.querySelector('.sr-config-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'sr-config-overlay';

  var mappings = config.fieldMappings || {};
  var fieldKeys = Object.keys(FIELD_LABELS);

  // Build profile selector options
  var profileOptions = '';
  Object.keys(PRESET_PROFILES).forEach(function(key) {
    var selected = (config.activeProfile === key) ? ' selected' : '';
    profileOptions += '<option value="' + key + '"' + selected + '>' + escapeHTML(PRESET_PROFILES[key].name) + '</option>';
  });

  // Build field mapping inputs
  var fieldsHTML = '';
  fieldKeys.forEach(function(key) {
    fieldsHTML += '<label>' + FIELD_LABELS[key] + '</label>';
    fieldsHTML += '<input type="text" id="sr-map-' + key + '" value="' + escapeHTML(mappings[key] || '') + '" placeholder="例: data.result.' + key + '">';
  });

  overlay.innerHTML = '\
<div class="sr-config-modal">\
  <h3>設定 Configuration</h3>\
  <label>預設範本 Preset Profile</label>\
  <select id="sr-profile-select" style="width:100%;padding:6px 8px;background:#111;border:1px solid #333;border-radius:4px;color:#e0e0e0;font-size:12px">\
    <option value="">-- 選擇預設範本或手動設定 --</option>\
    ' + profileOptions + '\
  </select>\
  <div id="sr-profile-note" style="color:#e94560;font-size:11px;margin:4px 0 8px;min-height:16px"></div>\
  <label>URL 過濾模式 (正則表達式)</label>\
  <input type="text" id="sr-url-pattern" value="' + escapeHTML(config.urlPattern || '') + '" placeholder="例: pragmaticplay|api\\.example\\.com">\
  <h3 style="margin-top:16px">欄位映射 Field Mappings</h3>\
  <p style="color:#888;font-size:11px;margin:0 0 8px">填入 JSON 路徑，例如 data.result.winAmount。也可以在 Debug Log 中點擊請求，直接從 JSON 樹中選取。<br>選擇預設範本會自動填入常見路徑，但請用 Debug Log 確認實際路徑是否正確。</p>\
  ' + fieldsHTML + '\
  <div class="sr-btn-row">\
    <button class="sr-btn" id="sr-config-save">儲存</button>\
    <button class="sr-btn" id="sr-config-cancel">取消</button>\
  </div>\
</div>';

  shadow.appendChild(overlay);

  // Profile selector logic
  var profileSelect = shadow.getElementById('sr-profile-select');
  var profileNote = shadow.getElementById('sr-profile-note');

  profileSelect.addEventListener('change', function() {
    var key = profileSelect.value;
    if (!key || !PRESET_PROFILES[key]) {
      profileNote.textContent = '';
      return;
    }
    var profile = PRESET_PROFILES[key];
    profileNote.textContent = profile.note || '';

    // Fill URL pattern
    shadow.getElementById('sr-url-pattern').value = profile.urlPattern || '';

    // Fill field mappings
    fieldKeys.forEach(function(fk) {
      var input = shadow.getElementById('sr-map-' + fk);
      if (input) input.value = profile.fieldMappings[fk] || '';
    });
  });

  // Show note for currently selected profile
  if (config.activeProfile && PRESET_PROFILES[config.activeProfile]) {
    profileNote.textContent = PRESET_PROFILES[config.activeProfile].note || '';
  }

  shadow.getElementById('sr-config-save').addEventListener('click', function() {
    config.activeProfile = profileSelect.value || '';
    config.urlPattern = shadow.getElementById('sr-url-pattern').value.trim();
    fieldKeys.forEach(function(key) {
      config.fieldMappings[key] = shadow.getElementById('sr-map-' + key).value.trim();
    });
    _interceptorConfig.urlPattern = config.urlPattern;
    _interceptorConfig.fieldMappings = config.fieldMappings;
    saveConfig(config);
    overlay.remove();
  });

  shadow.getElementById('sr-config-cancel').addEventListener('click', function() {
    overlay.remove();
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

// ── JSON Inspector (click a debug entry to see full JSON tree) ──

function showJSONInspector(shadow, config, entry) {
  var existing = shadow.querySelector('.sr-config-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.className = 'sr-config-overlay';

  var flat = flattenJSON(entry.data);
  var rowsHTML = '';
  Object.keys(flat).forEach(function(path) {
    var val = flat[path];
    var display = String(val);
    if (display.length > 60) display = display.substring(0, 60) + '...';
    rowsHTML += '<div class="sr-json-row" data-path="' + escapeHTML(path) + '">';
    rowsHTML += '<span class="sr-json-path">' + escapeHTML(path) + '</span>';
    rowsHTML += '<span class="sr-json-val">' + escapeHTML(display) + '</span>';
    rowsHTML += '<span class="sr-json-assign">[指定欄位]</span>';
    rowsHTML += '</div>';
  });

  overlay.innerHTML = '\
<div class="sr-config-modal">\
  <h3>JSON 檢視器</h3>\
  <p style="color:#888;font-size:11px;margin:0 0 4px">' + escapeHTML(entry.url) + '</p>\
  <p style="color:#888;font-size:11px;margin:0 0 8px">點擊 [指定欄位] 將該路徑指定給對應的數據欄位</p>\
  <div class="sr-json-tree">' + rowsHTML + '</div>\
  <div class="sr-btn-row">\
    <button class="sr-btn" id="sr-json-close">關閉</button>\
  </div>\
</div>';

  shadow.appendChild(overlay);

  // Click on [指定欄位] to assign path
  overlay.querySelectorAll('.sr-json-assign').forEach(function(el) {
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      var row = el.closest('.sr-json-row');
      var path = row.getAttribute('data-path');
      showFieldSelector(shadow, config, path, el);
    });
  });

  shadow.getElementById('sr-json-close').addEventListener('click', function() {
    overlay.remove();
  });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
}

function showFieldSelector(shadow, config, jsonPath, anchorEl) {
  // Remove existing selector
  var existing = shadow.querySelector('.sr-field-select');
  if (existing) existing.remove();

  var menu = document.createElement('div');
  menu.className = 'sr-field-select';

  var fieldKeys = Object.keys(FIELD_LABELS);
  fieldKeys.forEach(function(key) {
    var opt = document.createElement('div');
    opt.className = 'sr-field-option';
    opt.textContent = FIELD_LABELS[key];
    if (config.fieldMappings[key] === jsonPath) {
      opt.style.color = '#4ecca3';
    }
    opt.addEventListener('click', function() {
      config.fieldMappings[key] = jsonPath;
      _interceptorConfig.fieldMappings[key] = jsonPath;
      saveConfig(config);
      menu.remove();
      // Visual feedback
      anchorEl.textContent = '[' + FIELD_LABELS[key] + ']';
      anchorEl.style.color = '#4ecca3';
    });
    menu.appendChild(opt);
  });

  // Position near anchor
  var rect = anchorEl.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = rect.bottom + 'px';
  menu.style.left = (rect.left - 100) + 'px';

  shadow.appendChild(menu);

  // Close on outside click
  setTimeout(function() {
    function closeMenu(e) {
      if (!menu.contains(e.target)) {
        menu.remove();
        shadow.removeEventListener('click', closeMenu);
      }
    }
    shadow.addEventListener('click', closeMenu);
  }, 0);
}

// ── Drag ──

function makeDraggable(panel, shadow) {
  var header = shadow.getElementById('sr-header');
  var isDragging = false;
  var startX, startY, origX, origY;

  header.addEventListener('mousedown', function(e) {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    var rect = panel.getBoundingClientRect();
    origX = rect.left;
    origY = rect.top;
    e.preventDefault();
  });

  document.addEventListener('mousemove', function(e) {
    if (!isDragging) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    panel.style.position = 'fixed';
    panel.style.left = (origX + dx) + 'px';
    panel.style.top = (origY + dy) + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', function() {
    isDragging = false;
  });
}

// ── Helpers ──

function escapeHTML(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}
