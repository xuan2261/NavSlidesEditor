const { chromium } = require('playwright');
const path = require('path');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  const url = 'file://' + path.resolve('test-offline-output.html');
  console.log('Navigating to', url);
  await page.goto(url);
  
  await page.waitForTimeout(2000);
  
  // check what's rendered
  const content = await page.content();
  console.log('Body length:', content.length);
  
  await browser.close();
}
run();
