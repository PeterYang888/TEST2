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
