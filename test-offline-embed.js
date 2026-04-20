const fs = require('fs');
const { renderElement, escapeSrcdoc } = require('./shared/src/element-renderers.js');

// Mock window for element-renderers
global.window = {
  location: { origin: 'http://localhost:3002' }
};

const el = {
  type: 'html',
  content: '<h1>Test Embed HTML</h1>',
};

// 1. Generate regular HTML (for offline export)
const htmlNormal = renderElement(el, null, { forPrint: false });
console.log("Normal Output:");
console.log(htmlNormal);

// 2. Generate PDF HTML
const htmlPrint = renderElement(el, null, { forPrint: true });
console.log("\nPrint Output:");
console.log(htmlPrint);

// To test offlineExport, we need to load it. Since it uses ES modules, we can use an async IIFE
// But wait, offlineExport.js in client/src/utils/offlineExport.js is ES module, let's just inspect the Print Output.
