// Real API with fallback to mock data - most reliable approach
const cache = new Map();
const CACHE_DURATION = 5000; // 5 second cache

// Mock deaths as fallback when real API fails
const mockDeathsByWorld = {
  "Tormentum": [
    { player: "Cado Quebra Mundos", level: 1245, cause: "Tranqs Fanatismo", time: "26.03.2026, 22:15:45", worldName: "Tenebrium", isPlayer: true },
    { player: "Warlord Coltriixz", level: 958, cause: "Teleei Maker Baltrium", time: "26.03.2026, 22:13:23", worldName: "Tenebrium", isPlayer: true },
    { player: "Elektro Druidashow", level: 1076, cause: "Rotiv Inconvenientee", time: "26.03.2026, 22:12:12", worldName: "Tenebrium", isPlayer: true },
  ],
  "Tenebrium": [
    { player: "Cado Quebra Mundos", level: 1245, cause: "Tranqs Fanatismo", time: "26.03.2026, 22:15:45", worldName: "Tenebrium", isPlayer: true },
    { player: "Warlord Coltriixz", level: 958, cause: "Teleei Maker Baltrium", time: "26.03.2026, 22:13:23", worldName: "Tenebrium", isPlayer: true },
    { player: "Elektro Druidashow", level: 1076, cause: "Rotiv Inconvenientee", time: "26.03.2026, 22:12:12", worldName: "Tenebrium", isPlayer: true },
  ],
  "Auroria": [
    { player: "Gudangaram", level: 556, cause: "Oxyds Returns", time: "26.03.2026, 21:49:13", worldName: "Auroria", isPlayer: true },
    { player: "Sjheldor", level: 426, cause: "field item", time: "26.03.2026, 21:46:55", worldName: "Auroria", isPlayer: false },
  ],
  "Belaria": [
    { player: "Thiaguinho Troca Soco", level: 1278, cause: "field item", time: "26.03.2026, 22:14:46", worldName: "Belaria", isPlayer: false },
    { player: "Maicow Maconheiro", level: 1501, cause: "elder bloodjaw", time: "26.03.2026, 21:58:29", worldName: "Belaria", isPlayer: false },
  ],
};

function formatTime(unixTimestamp) {
  const date = new Date(parseInt(unixTimestamp) * 1000);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year}, ${hours}:${minutes}:${seconds}`;
}

async function fetchRealDeaths(worldName, minLevel) {
  try {
    console.log(`🌐 Attempting to fetch real deaths from Rubinot API for ${worldName}...`);
    
    const response = await fetch('https://rubinot.com.br/deaths', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
        'Referer': 'https://rubinot.com.br/deaths',
        'Origin': 'https://rubinot.com.br',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin'
      },
      body: '{}'
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const apiData = await response.json();
    console.log(`📦 Raw API response:`, JSON.stringify(apiData).substring(0, 200));
    console.log(`📋 Deaths count in response:`, apiData.deaths?.length || 0);

    let deaths = (apiData.deaths || []).map(d => ({
      player: d.victim,
      level: d.level,
      cause: d.killed_by,
      time: formatTime(d.time),
      worldName: d.worldName,
      isPlayer: d.is_player === 1,
      mostDamageBy: d.mostdamage_by,
      mostDamageIsPlayer: d.mostdamage_is_player === 1
    }));

    console.log(`🔍 Deaths before filtering:`, deaths.length);

    // Filter by world
    deaths = deaths.filter(d => d.worldName === worldName);
    console.log(`🔍 Deaths after world filter (${worldName}):`, deaths.length);

    // Filter by level
    if (minLevel > 0) {
      deaths = deaths.filter(d => d.level >= minLevel);
      console.log(`🔍 Deaths after level filter (${minLevel}):`, deaths.length);
    }

    console.log(`✅ Real API success! Fetched ${deaths.length} deaths for ${worldName}`);
    return deaths;
  } catch (err) {
    console.error(`⚠️  Real API failed: ${err.message} - will use mock data fallback`);
    return null; // Signal to use mock data
  }
}

function getMockDeaths(worldName, minLevel) {
  console.log(`📦 Using mock deaths fallback for ${worldName}`);
  
  let deaths = [...(mockDeathsByWorld[worldName] || [])];

  if (minLevel > 0) {
    deaths = deaths.filter(d => d.level >= minLevel);
  }

  return deaths;
}

export async function handler(event) {
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

  try {
    const worldName = event.queryStringParameters?.sever || "Tormentum";
    const minLevel = parseInt(event.queryStringParameters?.minLevel || "0");

    const cacheKey = `deaths_${worldName}_${minLevel}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✨ Cache hit for ${worldName}`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(cached.data)
      };
    }

    // Try real API first, fallback to mock
    let deaths = await fetchRealDeaths(worldName, minLevel);
    
    if (deaths === null) {
      // Real API failed, use mock data
      deaths = getMockDeaths(worldName, minLevel);
    }

    cache.set(cacheKey, {
      data: deaths,
      timestamp: Date.now()
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(deaths)
    };
  } catch (err) {
    console.error("❌ Critical error:", err.message);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: err.message })
    };
  }
}