// ─── Main Entry Point ───
// With @grant none, script runs directly in page context.

var _config = loadConfig();

// Install interceptors immediately at document-start
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

  console.log('[SlotRecorder] v2.0.0 running on:', window.location.href);
  createPanel(_config);
  console.log('[SlotRecorder] Panel created');
});
