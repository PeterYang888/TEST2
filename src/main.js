// ─── Main Entry Point ───

var _config = loadConfig();

// Detect context
var _isTopFrame = (window === window.top);
var _isGameIframe = !_isTopFrame && /ilomhzji|pragmatic|ppgames/.test(window.location.href);

// Only run in top frame or game iframe, skip other iframes (extensions, ads, etc.)
if (!_isTopFrame && !_isGameIframe) {
  // Skip — this is some unrelated iframe
} else {
  // Install interceptors immediately (runs at document-start)
  initInterceptors(_config);

  // Wait for document.body to exist, then inject UI
  function waitForBody(callback) {
    if (document.body) {
      callback();
      return;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) callback();
      });
    }
    var attempts = 0;
    var timer = setInterval(function() {
      attempts++;
      if (document.body) {
        clearInterval(timer);
        callback();
      } else if (attempts > 50) {
        clearInterval(timer);
      }
    }, 200);
  }

  var _panelCreated = false;
  waitForBody(function() {
    if (_panelCreated) return;
    _panelCreated = true;

    console.log('[SlotRecorder] v1.2.0 running on:', window.location.href);
    console.log('[SlotRecorder] topFrame:', _isTopFrame, '| gameIframe:', _isGameIframe);

    createPanel(_config);
    console.log('[SlotRecorder] Panel created successfully');
  });

  // Register Tampermonkey menu commands
  if (typeof GM_registerMenuCommand !== 'undefined') {
    GM_registerMenuCommand('匯出 CSV / Export CSV', function() {
      downloadCSV();
    });
  }
}
