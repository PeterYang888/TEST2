// ─── Network Interceptors (Fetch / XHR / WebSocket) ───
// With @grant none, the script runs directly in the page context.
// No sandbox, no unsafeWindow needed — we patch the real objects directly.

var interceptedRequests = [];
var onRequestCaptured = null;
var _interceptorConfig = null;

function initInterceptors(config) {
  _interceptorConfig = config;
  installXHRInterceptor();
  installFetchInterceptor();
  installWebSocketInterceptor();
  console.log('[SlotRecorder] All interceptors installed (grant none mode)');
}

function shouldCapture(url) {
  if (!_interceptorConfig) return false;
  if (_interceptorConfig.debugMode && !_interceptorConfig.urlPattern) return true;
  if (!_interceptorConfig.urlPattern) return false;
  try {
    return new RegExp(_interceptorConfig.urlPattern, 'i').test(url);
  } catch (e) {
    return url.indexOf(_interceptorConfig.urlPattern) !== -1;
  }
}

function parseQueryString(text) {
  if (!text || text.indexOf('=') === -1) return null;
  var result = {};
  var pairs = text.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var eqIdx = pairs[i].indexOf('=');
    if (eqIdx === -1) continue;
    var key = decodeURIComponent(pairs[i].substring(0, eqIdx));
    var val = decodeURIComponent(pairs[i].substring(eqIdx + 1));
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

function parseResponseText(text) {
  if (!text || text.length < 3) return null;
  text = text.trim();

  if (text.charAt(0) === '{' || text.charAt(0) === '[') {
    try { return JSON.parse(text); } catch (e) {}
  }

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
  if (interceptedRequests.length > 200) {
    interceptedRequests.splice(0, interceptedRequests.length - 200);
  }

  if (onRequestCaptured) onRequestCaptured(entry);

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

// ── XMLHttpRequest Interceptor (直接 patch，無沙盒) ──

function installXHRInterceptor() {
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url) {
    this.__sr_url = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function() {
    var self = this;
    self.addEventListener('load', function() {
      try {
        var url = self.__sr_url || '';
        if (shouldCapture(url) && self.responseText) {
          var parsed = parseResponseText(self.responseText);
          if (parsed) processResponse(url, parsed);
        }
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };
}

// ── Fetch Interceptor ──

function installFetchInterceptor() {
  var origFetch = window.fetch;
  if (!origFetch) return;

  window.fetch = function() {
    var args = arguments;
    var url = '';
    if (typeof args[0] === 'string') url = args[0];
    else if (args[0] && args[0].url) url = args[0].url;

    var result = origFetch.apply(this, args);

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

// ── WebSocket Interceptor ──

function installWebSocketInterceptor() {
  var OrigWS = window.WebSocket;
  if (!OrigWS) return;

  window.WebSocket = function(url, protocols) {
    var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
    ws.addEventListener('message', function(event) {
      if (typeof event.data === 'string' && shouldCapture(url)) {
        var parsed = parseResponseText(event.data);
        if (parsed) processResponse('ws://' + url, parsed);
      }
    });
    return ws;
  };
  window.WebSocket.prototype = OrigWS.prototype;
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;
}
