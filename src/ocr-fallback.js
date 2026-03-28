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
