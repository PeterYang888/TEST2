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

// Parse URL-encoded query string into object (for Pragmatic Play etc.)
function parseQueryString(text) {
  if (!text || text.indexOf('=') === -1) return null;
  var result = {};
  var pairs = text.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var eqIdx = pairs[i].indexOf('=');
    if (eqIdx === -1) continue;
    var key = decodeURIComponent(pairs[i].substring(0, eqIdx));
    var val = decodeURIComponent(pairs[i].substring(eqIdx + 1));
    // Try to convert numeric values
    if (/^-?\d+(\.\d+)?$/.test(val)) {
      result[key] = parseFloat(val);
    } else if (val === 'true') {
      result[key] = true;
    } else if (val === 'false') {
      result[key] = false;
    } else {
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// Try to parse response text as JSON first, then as URL-encoded query string
function parseResponseText(text) {
  if (!text || text.length < 3) return null;
  text = text.trim();

  // Try JSON first
  if (text.charAt(0) === '{' || text.charAt(0) === '[') {
    try {
      return JSON.parse(text);
    } catch (e) { /* not JSON */ }
  }

  // Try URL-encoded query string (key=value&key2=value2)
  if (text.indexOf('=') !== -1 && text.indexOf('<') === -1) {
    return parseQueryString(text);
  }

  return null;
}

function processResponse(url, data) {
  var entry = {
    timestamp: new Date().toISOString(),
    url: url,
    data: data,
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
      var record = parseSpinResult(data, _interceptorConfig.fieldMappings);
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
          var parsed = parseResponseText(text);
          if (parsed) processResponse(url, parsed);
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
        var parsed = parseResponseText(self.responseText);
        if (parsed) processResponse(url, parsed);
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
        var parsed = parseResponseText(data);
        if (parsed) processResponse(url, parsed);
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

function installPostMessageInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  win.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    // Try to parse if it's a string
    if (typeof data === 'string') {
      if (data.length < 5) return;
      var parsed = parseResponseText(data);
      if (parsed) {
        data = parsed;
      } else {
        return;
      }
    }

    // Only process objects (not primitives)
    if (typeof data !== 'object' || data === null) return;

    var source = 'postMessage://' + (event.origin || 'unknown');
    processResponse(source, data);
  });

  console.log('[SlotRecorder] postMessage interceptor installed');
}
