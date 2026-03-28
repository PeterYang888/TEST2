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
  var reelsVal = resolvePath(json, mappings.reels);
  var record = {
    timestamp:      new Date().toISOString(),
    balance:        resolvePath(json, mappings.balance),
    winAmount:      resolvePath(json, mappings.winAmount),
    betAmount:      resolvePath(json, mappings.betAmount),
    betLines:       resolvePath(json, mappings.betLines),
    reels:          (typeof reelsVal === 'object') ? JSON.stringify(reelsVal) : (reelsVal || ''),
    freeSpins:      resolvePath(json, mappings.freeSpins) || '',
    bonusTriggered: resolvePath(json, mappings.bonusTriggered) || '',
    multiplier:     resolvePath(json, mappings.multiplier) || '',
    gameId:         resolvePath(json, mappings.gameId) || '',
    spinId:         resolvePath(json, mappings.spinId) || '',
  };

  // Add extra fields if mapped
  if (mappings.extra1) record.extra1 = resolvePath(json, mappings.extra1) || '';
  if (mappings.extra2) record.extra2 = resolvePath(json, mappings.extra2) || '';
  if (mappings.extra3) record.extra3 = resolvePath(json, mappings.extra3) || '';

  var hasData = record.balance !== undefined
    || record.winAmount !== undefined
    || record.reels;

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
