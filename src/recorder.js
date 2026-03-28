// ─── In-Memory Store & CSV Export ───

var spinRecords = [];
var onRecordAdded = null; // callback set by UI

function addRecord(record) {
  spinRecords.push(record);
  if (onRecordAdded) onRecordAdded(record, spinRecords.length);
}

function getRecordCount() {
  return spinRecords.length;
}

function getLastRecord() {
  return spinRecords.length > 0 ? spinRecords[spinRecords.length - 1] : null;
}

function clearRecords() {
  spinRecords = [];
}

function escapeCSVField(val) {
  var str = String(val === null || val === undefined ? '' : val);
  if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCSV() {
  if (spinRecords.length === 0) return '';
  var headers = Object.keys(spinRecords[0]);
  var rows = spinRecords.map(function(r) {
    return headers.map(function(h) { return escapeCSVField(r[h]); }).join(',');
  });
  return '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
}

function downloadCSV() {
  var csv = toCSV();
  if (!csv) {
    alert('沒有記錄可匯出 / No records to export');
    return;
  }
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'slot-data-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
