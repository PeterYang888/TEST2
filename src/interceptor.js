// ─── Network Interceptors (Fetch / XHR / WebSocket) ───

var interceptedRequests = []; // debug log
var onRequestCaptured = null; // callback set by UI
var _interceptorConfig = null;

function initInterceptors(config) {
  _interceptorConfig = config;
  installFetchInterceptor();
  installXHRInterceptor();
  installWebSocketInterceptor();
  installPostMessageInterceptor();
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

// ── postMessage Interceptor (for iframe-based games like Pragmatic Play) ──
// Games in iframes communicate with the parent page via window.postMessage.
// This captures those messages without needing to inject into the iframe.

function installPostMessageInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  win.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    // Try to parse if it's a string
    if (typeof data === 'string') {
      // Skip very short messages or non-JSON
      if (data.length < 5) return;
      try {
        data = JSON.parse(data);
      } catch (e) {
        return; // not JSON, skip
      }
    }

    // Only process objects (not primitives)
    if (typeof data !== 'object' || data === null) return;

    // Build a source label from the event origin
    var source = 'postMessage://' + (event.origin || 'unknown');

    processResponse(source, data);
  });

  console.log('[SlotRecorder] postMessage interceptor installed');
}
