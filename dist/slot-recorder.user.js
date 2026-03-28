// ==UserScript==
// @name         Slot Machine Data Recorder
// @name:zh-TW   老虎機數據記錄器
// @namespace    slot-recorder
// @version      1.1.0
// @description  Records slot machine spin data (balance, symbols, bets, special events) and exports to CSV
// @description:zh-TW  記錄老虎機旋轉數據（餘額、圖案、下注、特殊事件）並匯出 CSV
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function() {
'use strict';

// ── config.js ───────────────────────────────────────────────────
// ─── Configuration Management ───

const DEFAULT_CONFIG = {
  active: false,
  activeProfile: '',
  urlPattern: '',
  debugMode: true,
  ocrEnabled: false,
  fieldMappings: {
    balance:        '',
    winAmount:      '',
    betAmount:      '',
    betLines:       '',
    reels:          '',
    freeSpins:      '',
    bonusTriggered: '',
    multiplier:     '',
    gameId:         '',
    spinId:         '',
  },
  ocrRegions: [],
};

// ─── Preset Profiles for Known Platforms ───
// These are common JSON path patterns. Actual paths may vary by operator/casino.
// Users should verify with Debug Log and adjust if needed.

var PRESET_PROFILES = {
  'pragmatic-play': {
    name: 'Pragmatic Play (Gates of Olympus 等)',
    urlPattern: 'pragmaticplay|ppgames|pgsoft',
    note: '適用於大多數 Pragmatic Play 遊戲。請先用 Debug Log 確認實際路徑。',
    fieldMappings: {
      balance:        'b',
      winAmount:      'w',
      betAmount:      'bt',
      betLines:       '',
      reels:          'rs',
      freeSpins:      'fs',
      bonusTriggered: 'bonus',
      multiplier:     'tm',
      gameId:         'gi',
      spinId:         'sid',
    },
  },
  'netent': {
    name: 'NetEnt / Evolution',
    urlPattern: 'netent|casinomodule|evolution',
    note: '適用於 NetEnt 系列遊戲。部分遊戲可能使用 WebSocket。',
    fieldMappings: {
      balance:        'balance',
      winAmount:      'winAmount',
      betAmount:      'betAmount',
      betLines:       'lines',
      reels:          'reelSet',
      freeSpins:      'freeSpins',
      bonusTriggered: 'bonusGame',
      multiplier:     'multiplier',
      gameId:         'gameId',
      spinId:         'roundId',
    },
  },
  'pg-soft': {
    name: 'PG Soft',
    urlPattern: 'pgsoft|pocket-games',
    note: '適用於 PG Soft 系列遊戲。',
    fieldMappings: {
      balance:        'dt.bl',
      winAmount:      'dt.tw',
      betAmount:      'dt.bt',
      betLines:       '',
      reels:          'dt.sr',
      freeSpins:      'dt.fs',
      bonusTriggered: 'dt.bg',
      multiplier:     'dt.ml',
      gameId:         'dt.gi',
      spinId:         'dt.ri',
    },
  },
  'custom': {
    name: '自訂 Custom (手動設定)',
    urlPattern: '',
    note: '使用 Debug Log 觀察請求，手動設定所有欄位映射。',
    fieldMappings: {
      balance: '', winAmount: '', betAmount: '', betLines: '',
      reels: '', freeSpins: '', bonusTriggered: '', multiplier: '',
      gameId: '', spinId: '',
    },
  },
};

const FIELD_LABELS = {
  balance:        '餘額 Balance',
  winAmount:      '贏得金額 Win Amount',
  betAmount:      '下注金額 Bet Amount',
  betLines:       '下注線數 Bet Lines',
  reels:          '轉輪結果 Reels',
  freeSpins:      '免費旋轉 Free Spins',
  bonusTriggered: 'Bonus 觸發',
  multiplier:     '倍率 Multiplier',
  gameId:         '遊戲 ID',
  spinId:         '旋轉 ID',
};

function loadConfig() {
  try {
    const saved = GM_getValue('slotRecorderConfig', null);
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      return Object.assign({}, DEFAULT_CONFIG, parsed, {
        fieldMappings: Object.assign({}, DEFAULT_CONFIG.fieldMappings, parsed.fieldMappings || {}),
      });
    }
  } catch (e) {
    console.warn('[SlotRecorder] Failed to load config:', e);
  }
  return Object.assign({}, DEFAULT_CONFIG);
}

function saveConfig(config) {
  try {
    GM_setValue('slotRecorderConfig', JSON.stringify(config));
  } catch (e) {
    console.warn('[SlotRecorder] Failed to save config:', e);
  }
}


// ── parser.js ───────────────────────────────────────────────────
// ─── JSON Path Resolver & Data Extraction ───

function resolvePath(obj, path) {
  if (!path || obj == null) return undefined;
  const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current = obj;
  for (const key of keys) {
    if (current == null) return undefined;
    current = current[key];
  }
  return current;
}

function parseSpinResult(json, mappings) {
  const record = {
    timestamp:      new Date().toISOString(),
    balance:        resolvePath(json, mappings.balance),
    winAmount:      resolvePath(json, mappings.winAmount),
    betAmount:      resolvePath(json, mappings.betAmount),
    betLines:       resolvePath(json, mappings.betLines),
    reels:          JSON.stringify(resolvePath(json, mappings.reels) || []),
    freeSpins:      resolvePath(json, mappings.freeSpins) || false,
    bonusTriggered: resolvePath(json, mappings.bonusTriggered) || false,
    multiplier:     resolvePath(json, mappings.multiplier) || 1,
    gameId:         resolvePath(json, mappings.gameId) || '',
    spinId:         resolvePath(json, mappings.spinId) || '',
  };

  const hasData = record.balance !== undefined
    || record.winAmount !== undefined
    || record.reels !== '[]';

  return hasData ? record : null;
}

function flattenJSON(obj, prefix, result, depth) {
  if (depth > 6) return result;
  prefix = prefix || '';
  result = result || {};
  depth = depth || 0;

  if (obj === null || obj === undefined) {
    result[prefix] = obj;
    return result;
  }

  if (Array.isArray(obj)) {
    if (obj.length <= 20) {
      obj.forEach(function(item, i) {
        flattenJSON(item, prefix ? prefix + '[' + i + ']' : '[' + i + ']', result, depth + 1);
      });
    } else {
      result[prefix] = JSON.stringify(obj).substring(0, 100) + '...';
    }
    return result;
  }

  if (typeof obj === 'object') {
    var keys = Object.keys(obj);
    keys.forEach(function(key) {
      flattenJSON(obj[key], prefix ? prefix + '.' + key : key, result, depth + 1);
    });
    return result;
  }

  result[prefix] = obj;
  return result;
}


// ── recorder.js ─────────────────────────────────────────────────
// ─── In-Memory Store & CSV Export ───

var spinRecords = [];
var onRecordAdded = null; // callback set by UI

function addRecord(record) {
  spinRecords.push(record);
  if (onRecordAdded) onRecordAdded(record, spinRecords.length);
}

function getRecordCount() {
  return spinRecords.length;
}

function getLastRecord() {
  return spinRecords.length > 0 ? spinRecords[spinRecords.length - 1] : null;
}

function clearRecords() {
  spinRecords = [];
}

function escapeCSVField(val) {
  var str = String(val === null || val === undefined ? '' : val);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV() {
  if (spinRecords.length === 0) return '';
  var headers = Object.keys(spinRecords[0]);
  var rows = spinRecords.map(function(r) {
    return headers.map(function(h) { return escapeCSVField(r[h]); }).join(',');
  });
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}

function downloadCSV() {
  var csv = toCSV();
  if (!csv) {
    alert('沒有記錄可匯出 / No records to export');
    return;
  }
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'slot-data-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// ── interceptor.js ──────────────────────────────────────────────
// ─── Network Interceptors (Fetch / XHR / WebSocket) ───

var interceptedRequests = []; // debug log
var onRequestCaptured = null; // callback set by UI
var _interceptorConfig = null;

function initInterceptors(config) {
  _interceptorConfig = config;
  installFetchInterceptor();
  installXHRInterceptor();
  installWebSocketInterceptor();
}

function shouldCapture(url) {
  if (!_interceptorConfig) return false;
  // In debug mode with no pattern, capture everything
  if (_interceptorConfig.debugMode && !_interceptorConfig.urlPattern) return true;
  if (!_interceptorConfig.urlPattern) return false;
  try {
    return new RegExp(_interceptorConfig.urlPattern, 'i').test(url);
  } catch (e) {
    return url.indexOf(_interceptorConfig.urlPattern) !== -1;
  }
}

function processResponse(url, json) {
  var entry = {
    timestamp: new Date().toISOString(),
    url: url,
    data: json,
  };

  interceptedRequests.push(entry);
  // Keep debug log bounded
  if (interceptedRequests.length > 200) {
    interceptedRequests.splice(0, interceptedRequests.length - 200);
  }

  if (onRequestCaptured) onRequestCaptured(entry);

  // If recording is active and mappings are configured, parse and record
  if (_interceptorConfig && _interceptorConfig.active && _interceptorConfig.fieldMappings) {
    var hasMappings = Object.keys(_interceptorConfig.fieldMappings).some(function(k) {
      return _interceptorConfig.fieldMappings[k];
    });
    if (hasMappings) {
      var record = parseSpinResult(json, _interceptorConfig.fieldMappings);
      if (record) addRecord(record);
    }
  }
}

// ── Fetch Interceptor ──

function installFetchInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var originalFetch = win.fetch;
  if (!originalFetch) return;

  win.fetch = function() {
    var args = arguments;
    var url = '';
    if (typeof args[0] === 'string') {
      url = args[0];
    } else if (args[0] && args[0].url) {
      url = args[0].url;
    }

    var result = originalFetch.apply(this, args);

    if (shouldCapture(url)) {
      result.then(function(response) {
        var clone = response.clone();
        clone.text().then(function(text) {
          try {
            var json = JSON.parse(text);
            processResponse(url, json);
          } catch (e) { /* not JSON */ }
        }).catch(function() {});
      }).catch(function() {});
    }

    return result;
  };
}

// ── XMLHttpRequest Interceptor ──

function installXHRInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var OrigXHR = win.XMLHttpRequest;
  if (!OrigXHR) return;

  var origOpen = OrigXHR.prototype.open;
  var origSend = OrigXHR.prototype.send;

  OrigXHR.prototype.open = function(method, url) {
    this._slotRecUrl = url;
    return origOpen.apply(this, arguments);
  };

  OrigXHR.prototype.send = function() {
    var self = this;
    var url = self._slotRecUrl || '';

    if (shouldCapture(url)) {
      self.addEventListener('load', function() {
        try {
          var json = JSON.parse(self.responseText);
          processResponse(url, json);
        } catch (e) { /* not JSON */ }
      });
    }

    return origSend.apply(this, arguments);
  };
}

// ── WebSocket Interceptor ──

function installWebSocketInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
  var OrigWS = win.WebSocket;
  if (!OrigWS) return;

  win.WebSocket = function(url, protocols) {
    var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);

    ws.addEventListener('message', function(event) {
      if (!shouldCapture(url)) return;
      var data = event.data;
      if (typeof data === 'string') {
        try {
          var json = JSON.parse(data);
          processResponse(url, json);
        } catch (e) { /* not JSON */ }
      }
    });

    return ws;
  };

  win.WebSocket.prototype = OrigWS.prototype;
  win.WebSocket.CONNECTING = OrigWS.CONNECTING;
  win.WebSocket.OPEN = OrigWS.OPEN;
  win.WebSocket.CLOSING = OrigWS.CLOSING;
  win.WebSocket.CLOSED = OrigWS.CLOSED;
}


// ── ocr-fallback.js ─────────────────────────────────────────────
// ─── OCR Fallback (Optional) ───
// Uses canvas screenshot when API doesn't contain needed data.
// Requires Tesseract.js to be loaded externally.

var ocrAvailable = (typeof Tesseract !== 'undefined');

function captureCanvasRegion(canvas, region) {
  var offscreen = document.createElement('canvas');
  offscreen.width = region.w;
  offscreen.height = region.h;
  var ctx = offscreen.getContext('2d');
  ctx.drawImage(canvas, region.x, region.y, region.w, region.h, 0, 0, region.w, region.h);
  return offscreen;
}

function ocrRegion(canvas, region) {
  if (!ocrAvailable) {
    return Promise.resolve('');
  }
  var regionCanvas = captureCanvasRegion(canvas, region);
  return Tesseract.recognize(regionCanvas, 'eng', {
    tessedit_char_whitelist: '0123456789.,$ ',
  }).then(function(result) {
    return result.data.text.trim();
  }).catch(function() {
    return '';
  });
}

function runOCRCapture(config) {
  if (!config.ocrEnabled || !config.ocrRegions || config.ocrRegions.length === 0) {
    return Promise.resolve(null);
  }

  var canvas = document.querySelector('canvas');
  if (!canvas) return Promise.resolve(null);

  var promises = config.ocrRegions.map(function(region) {
    return ocrRegion(canvas, region).then(function(text) {
      return { name: region.name, value: text };
    });
  });

  return Promise.all(promises).then(function(results) {
    var ocrData = {};
    results.forEach(function(r) {
      ocrData[r.name] = r.value;
    });
    return ocrData;
  });
}


// ── ui.js ───────────────────────────────────────────────────────
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


// ── main.js ─────────────────────────────────────────────────────
// ─── Main Entry Point ───

var _config = loadConfig();

// Install interceptors immediately (runs at document-start)
initInterceptors(_config);

// Wait for document.body to exist, then inject UI
// At document-start, body doesn't exist yet, so we need to poll or wait
function waitForBody(callback) {
  if (document.body) {
    callback();
    return;
  }
  // Try again when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      if (document.body) {
        callback();
      }
    });
  }
  // Fallback: poll every 200ms (for edge cases in iframes)
  var attempts = 0;
  var timer = setInterval(function() {
    attempts++;
    if (document.body) {
      clearInterval(timer);
      callback();
    } else if (attempts > 50) { // give up after 10 seconds
      clearInterval(timer);
      console.warn('[SlotRecorder] Could not find document.body after 10s');
    }
  }, 200);
}

var _panelCreated = false;
waitForBody(function() {
  if (_panelCreated) return;
  _panelCreated = true;

  // Detect if this is the game iframe or the outer wrapper page
  var isIframe = (window !== window.top);
  var hasCanvas = document.querySelector('canvas');
  var url = window.location.href;

  // Log where the script is running for debugging
  console.log('[SlotRecorder] v1.1.0 running on:', url);
  console.log('[SlotRecorder] iframe:', isIframe, '| canvas:', !!hasCanvas);

  // Always create panel — but if we're in the outer page with no canvas,
  // still show it so user can see debug log and configure
  createPanel(_config);
  console.log('[SlotRecorder] Panel injected successfully');
});

// Register Tampermonkey menu commands
if (typeof GM_registerMenuCommand !== 'undefined') {
  GM_registerMenuCommand('匯出 CSV / Export CSV', function() {
    downloadCSV();
  });
}


})();
