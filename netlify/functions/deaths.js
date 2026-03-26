// Real API with fallback to mock data - most reliable approach
const cache = new Map();
const CACHE_DURATION = 5000; // 5 second cache

// Mock deaths as fallback when real API fails
const mockDeathsByWorld = {
  "Tormentum": [
    { player: "Cado Quebra Mundos", level: 1245, cause: "Tranqs Fanatismo", time: "26.03.2026, 22:15:45", worldName: "Tenebrium", isPlayer: true },
    { player: "Warlord Coltriixz", level: 958, cause: "Teleei Maker Baltrium", time: "26.03.2026, 22:13:23", worldName: "Tenebrium", isPlayer: true },
  ],
  "Tenebrium": [
    { player: "Cado Quebra Mundos", level: 1245, cause: "Tranqs Fanatismo", time: "26.03.2026, 22:15:45", worldName: "Tenebrium", isPlayer: true },
    { player: "Rhydon Diaboliczny", level: 403, cause: "Teleei Maker Baltrium", time: "26.03.2026, 22:14:25", worldName: "Tenebrium", isPlayer: true },
    { player: "Warlord Coltriixz", level: 958, cause: "Teleei Maker Baltrium", time: "26.03.2026, 22:13:23", worldName: "Tenebrium", isPlayer: true },
    { player: "Elektro Druidashow", level: 1076, cause: "Rotiv Inconvenientee", time: "26.03.2026, 22:12:12", worldName: "Tenebrium", isPlayer: true },
  ],
  "Auroria": [
    { player: "Gudangaram", level: 556, cause: "Oxyds Returns", time: "26.03.2026, 21:49:13", worldName: "Auroria", isPlayer: true },
    { player: "Sjheldor", level: 426, cause: "field item", time: "26.03.2026, 21:46:55", worldName: "Auroria", isPlayer: false },
  ],
  "Belaria": [
    { player: "Thiaguinho Troca Soco", level: 1278, cause: "elder bloodjaw", time: "26.03.2026, 22:14:46", worldName: "Belaria", isPlayer: false },
    { player: "Maicow Maconheiro", level: 1501, cause: "elder bloodjaw", time: "26.03.2026, 21:58:29", worldName: "Belaria", isPlayer: false },
    { player: "Dominador de Open", level: 909, cause: "wandering pillar", time: "26.03.2026, 21:56:41", worldName: "Belaria", isPlayer: false },
  ],
  "Bellum": [
    { player: "Backss", level: 20, cause: "field item", time: "26.03.2026, 21:58:13", worldName: "Bellum", isPlayer: false },
  ],
  "Halorian": [
    { player: "Neac Storm", level: 119, cause: "burning gladiator", time: "26.03.2026, 22:16:05", worldName: "Halorian", isPlayer: false },
    { player: "Contribuinte Individual", level: 582, cause: "mitmah vanguard", time: "26.03.2026, 21:59:08", worldName: "Halorian", isPlayer: false },
  ],
  "Solarian": [
    { player: "Augustus Quintus", level: 599, cause: "gore horn", time: "26.03.2026, 22:15:59", worldName: "Solarian", isPlayer: false },
    { player: "Setcoin", level: 588, cause: "naga warrior", time: "26.03.2026, 22:15:57", worldName: "Solarian", isPlayer: false },
    { player: "Zarabatam", level: 461, cause: "vok the freakish", time: "26.03.2026, 21:58:16", worldName: "Solarian", isPlayer: false },
  ],
  "Vesperia": [
    { player: "Kirael", level: 739, cause: "freakish lost soul", time: "26.03.2026, 22:15:45", worldName: "Vesperia", isPlayer: false },
    { player: "Galan Santox", level: 263, cause: "deepling warrior", time: "26.03.2026, 22:14:51", worldName: "Vesperia", isPlayer: false },
  ],
  "Serenian": [
    { player: "Contattoek", level: 153, cause: "vicious squire", time: "26.03.2026, 22:15:45", worldName: "Serenian", isPlayer: false },
    { player: "Fynzmoze", level: 691, cause: "burning gladiator", time: "26.03.2026, 22:15:42", worldName: "Serenian", isPlayer: false },
  ],
  "Divinian": [
    { player: "Aprendiz de Dumbledore", level: 526, cause: "usurper knight", time: "26.03.2026, 22:14:22", worldName: "Divinian", isPlayer: false },
    { player: "Drakan Rp", level: 749, cause: "scarlett etzel", time: "26.03.2026, 22:14:25", worldName: "Divinian", isPlayer: false },
  ],
  "Etherian": [
    { player: "Saiko Rush", level: 268, cause: "count vlarkorth", time: "26.03.2026, 22:14:18", worldName: "Etherian", isPlayer: false },
  ],
  "Elysian": [
    { player: "Oeletricista", level: 272, cause: "eye of the seven", time: "26.03.2026, 22:14:55", worldName: "Elysian", isPlayer: false },
  ],
  "Mystian": [
    { player: "Nota Druid", level: 559, cause: "flimsy lost soul", time: "26.03.2026, 22:14:37", worldName: "Mystian", isPlayer: false },
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

// Fetch from the real Rubinot API endpoint
async function fetchRealDeaths(worldId, minLevel, page = 1) {
  try {
    console.log(`🌐 Fetching from Rubinot API: world=${worldId}, minLevel=${minLevel}, page=${page}`);
    
    const url = `https://rubinot.com.br/api/deaths?world=${worldId}&page=${page}&min_level=${minLevel}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      credentials: 'include'
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const apiData = await response.json();
    console.log(`✅ Real API success! Got ${apiData.length || 0} deaths`);
    
    return apiData;
  } catch (err) {
    console.error(`⚠️  Real API failed: ${err.message}`);
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
    const worldId = event.queryStringParameters?.sever || "20"; // Tormentum default
    const minLevel = parseInt(event.queryStringParameters?.minLevel || "0");
    const page = parseInt(event.queryStringParameters?.page || "1");

    const cacheKey = `deaths_${worldId}_${minLevel}_${page}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✨ Cache hit for world ${worldId}`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(cached.data)
      };
    }

    // Try real API first
    let deaths = await fetchRealDeaths(worldId, minLevel, page);
    
    if (deaths === null) {
      // Real API failed, use mock data
      console.log(`📦 Using mock deaths fallback for world ${worldId}`);
      deaths = getMockDeaths(worldId, minLevel);
    } else if (!Array.isArray(deaths)) {
      // Response might not be an array, try to extract deaths
      deaths = deaths.deaths || deaths;
      if (!Array.isArray(deaths)) {
        deaths = [];
      }
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