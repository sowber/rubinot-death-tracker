// Netlify function with Puppeteer for dynamic content - optimized for new Rubinot site
import puppeteer from 'puppeteer';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const cache = new Map();
const characterCache = new Map();
const CACHE_DURATION = 3000; // 3 seconds for deaths
const CHARACTER_CACHE_DURATION = 7200000; // 2 hours for character data

let sharedBrowser = null;
let browserLaunching = false;

// Cleanup interval
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_DURATION * 3) {
      cache.delete(key);
    }
  }
  if (characterCache.size > 200) {
    const entries = Array.from(characterCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    entries.slice(0, 50).forEach(([key]) => characterCache.delete(key));
  }
}, 30000);

// Get or create browser (Netlify compatible)
async function getBrowser() {
  if (sharedBrowser) {
    try {
      if (sharedBrowser.isConnected()) {
        console.log('♻️  Reusing browser');
        return sharedBrowser;
      }
    } catch (e) {
      console.log('🔄 Browser disconnected');
      sharedBrowser = null;
    }
  }
  
  if (browserLaunching) {
    console.log('⏳ Waiting for browser...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return getBrowser();
  }
  
  browserLaunching = true;
  try {
    console.log('🚀 Launching browser...');
    sharedBrowser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      headless: 'new',
      timeout: 20000,
    });
    browserLaunching = false;
    return sharedBrowser;
  } catch (error) {
    browserLaunching = false;
    throw error;
  }
}

// Parse deaths from DOM (new structure)
async function extractDeathsFromPage(page) {
  const deaths = await page.evaluate(() => {
    // DEBUG: Log available selectors
    const debug = {
      tablesFound: document.querySelectorAll("table").length,
      tbodyFound: document.querySelectorAll("tbody").length,
      allRows: document.querySelectorAll("tr").length,
      tableBodyRows: document.querySelectorAll("table tbody tr").length,
    };
    
    console.log("DEBUG selectors:", JSON.stringify(debug));
    
    // Try multiple selector strategies
    let rows = document.querySelectorAll("table tbody tr");
    
    // If no rows found with standard selector, try alternatives
    if (rows.length === 0) {
      console.log("Standard selector returned 0, trying alternatives...");
      rows = document.querySelectorAll("table tr:not(:first-child)");
    }
    if (rows.length === 0) {
      rows = document.querySelectorAll("tr");
    }
    
    console.log("Using rows count:", rows.length);
    
    const deathsList = [];
    let count = 0;
    const MAX_DEATHS = 10;
    
    for (let i = 0; i < rows.length && count < MAX_DEATHS; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll("td");
      
      if (cells.length < 3) continue;
      
      // Extract data - adjust selectors based on new table structure
      const time = cells[1]?.innerText?.trim() || '';
      const playerLink = cells[2]?.querySelector("a")?.href || '';
      const player = cells[2]?.querySelector("a")?.innerText?.trim() || '';
      
      const fullText = cells[2]?.innerText?.replace(/\s+/g, ' ') || '';
      const levelMatch = fullText.match(/level\s*(\d+)/i);
      
      if (!levelMatch || !player) continue;
      
      const level = parseInt(levelMatch[1]);
      let cause = fullText.replace(/^.*?died at level \d+ by\s+/i, '').replace(/\.$/, '');
      
      if (cause && player && playerLink) {
        deathsList.push({ player, playerLink, level, cause, time });
        count++;
      }
    }
    
    if (deathsList.length === 0) {
      // Log HTML for debugging
      console.log("First 2000 chars of body:", document.body.innerHTML.substring(0, 2000));
    }
    
    return deathsList;
  });
  
  return deaths;
}

// Extract character data from DOM (new structure)
async function extractCharacterFromPage(page) {
  const data = await page.evaluate(() => {
    const info = {
      vocation: 'Unknown',
      residence: 'Unknown',
      accountStatus: 'Free Account',
      guild: 'No Guild'
    };
    
    // Look for character info in various possible structures
    const rows = document.querySelectorAll("table td");
    const text = Array.from(rows).map(el => el.textContent).join(' ');
    
    const vocMatch = text.match(/Vocation:\s*([^\n]+)/i);
    if (vocMatch) info.vocation = vocMatch[1].trim();
    
    const resMatch = text.match(/Residence:\s*([^\n]+)/i);
    if (resMatch) info.residence = resMatch[1].trim();
    
    const accMatch = text.match(/Account\s+Status:\s*([^\n]+)/i);
    if (accMatch) info.accountStatus = accMatch[1].trim();
    
    const guildMatch = text.match(/Guild:\s*([^\n]+)/i);
    if (guildMatch) info.guild = guildMatch[1].trim();
    
    return info;
  });
  
  return data;
}

export async function handler(event) {
  // Handle CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Get server id from query param (note: typo in URL is "sever" not "server")
  const serverId = event.queryStringParameters?.sever || "20";
  const url = `https://rubinot.com.br/deaths?sever=${serverId}`;

  // Check cache
  const cacheKey = `deaths_${serverId}_v4`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`✅ Cache hit for server ${serverId}`);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(cached.data)
    };
  }

  let page = null;
  let browser = null;

  try {
    console.log(`🌐 Fetching deaths for server ${serverId}...`);
    
    browser = await getBrowser();
    page = await browser.newPage();
    
    // Set viewport to reduce memory
    await page.setViewport({ width: 1024, height: 768 });
    
    // Navigate to the deaths page
    await page.goto(url, { 
      waitUntil: "networkidle2",
      timeout: 25000 
    });
    
    // Wait for the deaths table to appear
    // Adjust selector based on actual table structure
    try {
      await page.waitForSelector("table tbody tr", { timeout: 10000 });
    } catch (e) {
      console.warn("⚠️  Table selector not found, extracting available content...");
    }
    
    // Extract deaths from the page
    const deaths = await extractDeathsFromPage(page);
    console.log(`✅ Parsed ${deaths.length} deaths from server ${serverId}`);
    
    if (deaths.length === 0) {
      throw new Error("No deaths found - page structure may have changed");
    }

    // Fetch character data for latest 5 deaths
    const latestDeaths = deaths.slice(0, 5);
    const deathsWithCharacterData = [];
    let cacheHits = 0;
    let cacheMisses = 0;

    for (let i = 0; i < latestDeaths.length; i++) {
      const death = latestDeaths[i];
      const charCacheKey = `char_${death.player.toLowerCase()}`;
      
      // Check character cache
      const cachedChar = characterCache.get(charCacheKey);
      if (cachedChar && Date.now() - cachedChar.timestamp < CHARACTER_CACHE_DURATION) {
        console.log(`✓ ${death.player} (cached)`);
        cacheHits++;
        deathsWithCharacterData.push({ ...death, ...cachedChar.data });
        continue;
      }
      
      try {
        console.log(`✗ ${death.player} (fetching)`);
        cacheMisses++;
        
        // Build character URL from player name
        const charUrl = `https://rubinot.com.br/characters?name=${encodeURIComponent(death.player)}`;
        
        await page.goto(charUrl, {
          waitUntil: "networkidle2",
          timeout: 15000
        });
        
        // Wait for character info to load
        try {
          await page.waitForSelector("table", { timeout: 5000 });
        } catch (e) {
          console.warn(`⚠️  Character table not found for ${death.player}`);
        }
        
        // Extract character data
        const charData = await extractCharacterFromPage(page);
        
        // Cache the character data
        characterCache.set(charCacheKey, {
          data: charData,
          timestamp: Date.now()
        });
        
        deathsWithCharacterData.push({ ...death, ...charData });
        
        // Small delay between character fetches
        if (i < latestDeaths.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ ${death.player}: ${error.message}`);
        deathsWithCharacterData.push({
          ...death,
          vocation: "Unknown",
          residence: "Unknown",
          accountStatus: "Free Account",
          guild: "No Guild"
        });
      }
    }

    console.log(`✅ Complete: ${deathsWithCharacterData.length} deaths (${cacheHits} cached, ${cacheMisses} fetched)`);

    // Close page but keep browser alive
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore
      }
    }

    // Cache results
    cache.set(cacheKey, {
      data: deathsWithCharacterData,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deathsWithCharacterData)
    };
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error("Stack trace:", err.stack);
    
    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore
      }
    }
    
    // Reset browser on complete failure
    if (browser && !browser.isConnected()) {
      sharedBrowser = null;
    }
    
    // Return detailed error info
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: err.message,
        stack: err.stack,
        type: err.constructor.name
      })
    };
  }
}
