const { generateRevealHTML } = require('./shared/src/htmlGenerator.js');
const { generateOfflineHTML } = require('./client/src/utils/offlineExport.js');
const fs = require('fs');

const presentation = {
  title: 'Test',
  slides: [
    {
      id: 'slide1',
      elements: [
        {
          id: 'el1',
          type: 'html',
          content: '<div style="background: red; width: 100px; height: 100px;">Embed</div><script>console.log("Embed running");</script>',
          width: 300,
          height: 300
        }
      ],
      background: { type: 'solid', color: '#ffffff' }
    }
  ]
};

async function run() {
  try {
    const html = generateRevealHTML(presentation);
    const offlineHtml = await generateOfflineHTML(html);
    fs.writeFileSync('test-offline-embed.html', offlineHtml);
    console.log('Offline HTML generated:', offlineHtml.length, 'bytes');
  } catch (err) {
    console.error('Error generating:', err);
  }
}
run();
