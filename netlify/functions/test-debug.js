// Debug endpoint to test what's available
export async function handler(event) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      NETLIFY: !!process.env.NETLIFY,
    },
    memory: process.memoryUsage(),
  };

  // Test if puppeteer can be imported
  try {
    const puppeteer = await import('puppeteer');
    diagnostics.puppeteerImport = 'SUCCESS';
    diagnostics.puppeteerVersion = puppeteer.default?.version || 'unknown';
  } catch (e) {
    diagnostics.puppeteerImport = 'FAILED: ' + e.message;
  }

  // Test if browser can launch
  try {
    const puppeteer = await import('puppeteer');
    console.log('Attempting browser launch...');
    const browser = await puppeteer.default.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
      headless: 'new',
      timeout: 10000,
    });
    diagnostics.browserLaunch = 'SUCCESS';
    await browser.close();
    diagnostics.browserClose = 'SUCCESS';
  } catch (e) {
    diagnostics.browserLaunch = 'FAILED: ' + e.message;
    diagnostics.browserError = e.toString();
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(diagnostics, null, 2),
  };
}
