// ─── Main Entry Point ───

var _config = loadConfig();

// Install interceptors immediately (runs at document-start)
initInterceptors(_config);

// Wait for DOM ready to inject UI
function onDOMReady() {
  createPanel(_config);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
  onDOMReady();
}

// Register Tampermonkey menu commands
if (typeof GM_registerMenuCommand !== 'undefined') {
  GM_registerMenuCommand('匯出 CSV / Export CSV', function() {
    downloadCSV();
  });
}

console.log('[SlotRecorder] v1.0.0 initialized');
