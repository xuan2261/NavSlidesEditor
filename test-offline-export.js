const fs = require('fs');

async function testOfflineExport() {
  const { generateOfflineHTML } = await import('./client/src/utils/offlineExport.js');
  
  // Mock window and getVendorBase
  global.window = {
    location: { origin: 'http://localhost:3002', protocol: 'http:' },
    addEventListener: () => {}
  };
  global.fetch = async (url) => ({
    ok: true,
    text: async () => 'console.log("mock js");',
    blob: async () => new Blob()
  });
  global.FileReader = class {
    readAsDataURL() { this.onloadend(); }
    get result() { return 'data:image/png;base64,mock'; }
  };

  const html = `
    <html>
      <head>
        <script>Reveal.initialize();</script>
      </head>
      <body>
        <iframe srcdoc="&lt;!doctype html&gt;&lt;html&gt;&lt;head&gt;&lt;meta charset=&quot;utf-8&quot;&gt;&lt;style&gt;html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden}&lt;/style&gt;&lt;/head&gt;&lt;body&gt;&lt;script&gt;console.log('hi');&lt;/script&gt;&lt;h1&gt;Test Embed HTML&lt;/h1&gt;&lt;/body&gt;&lt;/html&gt;"></iframe>
      </body>
    </html>
  `;
  
  try {
    const result = await generateOfflineHTML(html);
    fs.writeFileSync('test-offline-output.html', result);
    console.log('Done! Output written to test-offline-output.html');
  } catch (err) {
    console.error('Error:', err);
  }
}

testOfflineExport();
