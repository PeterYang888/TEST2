const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const distDir = path.join(__dirname, 'dist');

// Module order matters: dependencies must come before dependents
const modules = [
  'meta.js',
  'config.js',
  'parser.js',
  'recorder.js',
  'interceptor.js',
  'ocr-fallback.js',
  'ui.js',
  'main.js',
];

// Read meta.js separately (goes outside the IIFE)
const meta = fs.readFileSync(path.join(srcDir, modules[0]), 'utf-8');

// Read remaining modules
const body = modules.slice(1).map(file => {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  return `// ── ${file} ${'─'.repeat(60 - file.length)}\n${content}`;
}).join('\n\n');

// Wrap in IIFE
const output = `${meta.trim()}

(function() {
'use strict';

${body}

})();
`;

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const outPath = path.join(distDir, 'slot-recorder.user.js');
fs.writeFileSync(outPath, output, 'utf-8');
console.log(`Built: ${outPath} (${(output.length / 1024).toFixed(1)} KB)`);
