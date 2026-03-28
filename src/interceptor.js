// ─── Network Interceptors (Fetch / XHR / WebSocket) ───
// Uses page-level script injection to bypass Tampermonkey sandbox.

var interceptedRequests = []; // debug log
var onRequestCaptured = null; // callback set by UI
var _interceptorConfig = null;

function initInterceptors(config) {
  _interceptorConfig = config;
  injectPageInterceptor();
  installPostMessageInterceptor();
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

// ── Page-level Script Injection ──
// Injects interceptor code directly into the page context via <script> tag.
// This bypasses Tampermonkey's sandbox so we can monkey-patch the real
// XMLHttpRequest, fetch, and WebSocket that the game code uses.
// Intercepted data is sent back via CustomEvent.

function injectPageInterceptor() {
  var EVENT_NAME = '__slotRecorderData__';

  // Listen for events from the injected page script
  document.addEventListener(EVENT_NAME, function(e) {
    try {
      var detail = e.detail;
      if (!detail || !detail.url) return;

      if (shouldCapture(detail.url)) {
        var parsed = parseResponseText(detail.body);
        if (parsed) {
          processResponse(detail.url, parsed);
        }
      }
    } catch (err) {
      console.warn('[SlotRecorder] Error processing intercepted data:', err);
    }
  });

  // Code to inject into the page context
  var injectedCode = '(' + function(eventName) {
    // ── Patch XMLHttpRequest ──
    var OrigXHR = XMLHttpRequest;
    var origOpen = OrigXHR.prototype.open;
    var origSend = OrigXHR.prototype.send;

    OrigXHR.prototype.open = function(method, url) {
      this.__sr_url = url;
      return origOpen.apply(this, arguments);
    };

    OrigXHR.prototype.send = function() {
      var self = this;
      self.addEventListener('load', function() {
        try {
          if (self.responseText && self.responseText.length > 2) {
            document.dispatchEvent(new CustomEvent(eventName, {
              detail: { url: self.__sr_url || '', body: self.responseText }
            }));
          }
        } catch (e) {}
      });
      return origSend.apply(this, arguments);
    };

    // ── Patch fetch ──
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function() {
        var args = arguments;
        var url = '';
        if (typeof args[0] === 'string') url = args[0];
        else if (args[0] && args[0].url) url = args[0].url;

        var result = origFetch.apply(this, args);
        result.then(function(response) {
          var clone = response.clone();
          clone.text().then(function(text) {
            if (text && text.length > 2) {
              document.dispatchEvent(new CustomEvent(eventName, {
                detail: { url: url, body: text }
              }));
            }
          }).catch(function() {});
        }).catch(function() {});
        return result;
      };
    }

    // ── Patch WebSocket ──
    var OrigWS = window.WebSocket;
    if (OrigWS) {
      window.WebSocket = function(url, protocols) {
        var ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
        ws.addEventListener('message', function(event) {
          if (typeof event.data === 'string' && event.data.length > 2) {
            document.dispatchEvent(new CustomEvent(eventName, {
              detail: { url: 'ws://' + url, body: event.data }
            }));
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

    console.log('[SlotRecorder] Page-level interceptors injected');
  } + ')(' + JSON.stringify(EVENT_NAME) + ');';

  // Inject as <script> tag — runs in page context, not Tampermonkey sandbox
  var script = document.createElement('script');
  script.textContent = injectedCode;
  (document.head || document.documentElement).appendChild(script);
  script.remove(); // clean up DOM, code already executed

  console.log('[SlotRecorder] Script injection complete');
}

// ── postMessage Interceptor (for iframe-parent communication) ──

function installPostMessageInterceptor() {
  var win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  win.addEventListener('message', function(event) {
    var data = event.data;
    if (!data) return;

    if (typeof data === 'string') {
      if (data.length < 5) return;
      var parsed = parseResponseText(data);
      if (parsed) {
        data = parsed;
      } else {
        return;
      }
    }

    if (typeof data !== 'object' || data === null) return;

    var source = 'postMessage://' + (event.origin || 'unknown');
    processResponse(source, data);
  });

  console.log('[SlotRecorder] postMessage interceptor installed');
}
