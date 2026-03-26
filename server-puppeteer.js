import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
const PORT = 3001; // Different from React dev server (3000)

let browser = null;

// Initialize browser on startup
async function initBrowser() {
  try {
    console.log('🚀 Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched successfully');
  } catch (err) {
    console.error('❌ Failed to launch browser:', err.message);
    process.exit(1);
  }
}

// Fetch deaths from Rubinot using real browser
async function fetchDeathsWithPuppeteer(worldId, minLevel, page = 1) {
  let page_obj = null;
  try {
    console.log(`📱 Opening page to fetch deaths for world=${worldId}, minLevel=${minLevel}...`);
    
    page_obj = await browser.newPage();
    
    // Set viewport and user agent
    await page_obj.setViewport({ width: 1280, height: 720 });
    await page_obj.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    );

    // Navigate to the deaths page
    console.log('🌐 Navigating to Rubinot deaths page...');
    await page_obj.goto('https://rubinot.com.br/deaths', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    console.log('💤 Waiting for page to load...');
    await page_obj.waitForSelector('[class*="death"]', { timeout: 5000 }).catch(() => {
      console.log('⚠️  Death selector not found, continuing anyway...');
    });

    // Make the API call through the page context
    console.log('📡 Fetching deaths data via page API...');
    const deaths = await page_obj.evaluate(async (world, minLevel) => {
      const url = `https://rubinot.com.br/api/deaths?world=${world}&page=1&min_level=${minLevel}`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return await response.json();
      } catch (err) {
        console.error('Error fetching from page context:', err);
        return [];
      }
    }, worldId, minLevel);

    console.log(`✅ Got ${deaths.length} deaths from Rubinot`);
    return deaths;

  } catch (err) {
    console.error(`❌ Puppeteer error: ${err.message}`);
    return [];
  } finally {
    if (page_obj) {
      await page_obj.close();
    }
  }
}

// API endpoint
app.get('/api/deaths', async (req, res) => {
  try {
    const worldId = req.query.world || '20';
    const minLevel = parseInt(req.query.min_level || '0');
    const page = parseInt(req.query.page || '1');

    console.log(`\n📨 Request: world=${worldId}, minLevel=${minLevel}, page=${page}`);

    // Fetch using Puppeteer (real browser, can bypass Cloudflare)
    const deaths = await fetchDeathsWithPuppeteer(worldId, minLevel, page);

    res.json(deaths);
  } catch (err) {
    console.error('Endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', browser: browser ? 'running' : 'not initialized' });
});

// Start server
async function start() {
  await initBrowser();

  app.listen(PORT, () => {
    console.log(`\n🎯 Puppeteer death tracker server running on http://localhost:${PORT}`);
    console.log(`📍 API endpoint: http://localhost:${PORT}/api/deaths?world=20&min_level=0`);
    console.log('\nTo use this with React:');
    console.log('1. Update App.jsx to call http://localhost:3001/api/deaths?...');
    console.log('2. Keep this server running while developing\n');
  });
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  if (browser) {
    await browser.close();
  }
  process.exit(0);
});

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
