// Simplified version - Mock data (Puppeteer had too many environment issues on Netlify)
const cache = new Map();
const CACHE_DURATION = 3000;

const mockDeathsByServer = {
  "20": [
    { player: "Torment Knight", level: 280, cause: "a dragon lord", time: "26.03.2026, 22:15:30", vocation: "Elite Knight", residence: "Thais", accountStatus: "VIP Account", guild: "Dragons of Power" },
    { player: "Monster Hunter", level: 210, cause: "a demon", time: "26.03.2026, 21:45:12", vocation: "Royal Paladin", residence: "Carlin", accountStatus: "Free Account", guild: "No Guild" },
    { player: "Shadow Master", level: 195, cause: "a lich", time: "26.03.2026, 20:30:45", vocation: "Master Sorcerer", residence: "Ankrahmun", accountStatus: "VIP Account", guild: "Shadow Guild" },
  ],
  "11": [
    { player: "Golden Knight", level: 250, cause: "a tyrant", time: "26.03.2026, 22:00:00", vocation: "Elite Knight", residence: "Thais", accountStatus: "VIP Account", guild: "Golden Order" },
  ],
  "default": [
    { player: "Test Player", level: 100, cause: "a rat", time: "26.03.2026, 12:00:00", vocation: "Sorcerer", residence: "Unknown", accountStatus: "Free Account", guild: "No Guild" }
  ]
};

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
    const serverId = event.queryStringParameters?.sever || "20";
    const minLevel = parseInt(event.queryStringParameters?.minLevel || "0");
    const vipOnly = event.queryStringParameters?.vip === 'true';

    const cacheKey = `deaths_${serverId}_${minLevel}_${vipOnly}`;
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

    console.log(`📊 Mock deaths for server ${serverId}, minLevel=${minLevel}, vipOnly=${vipOnly}`);

    let deaths = [...(mockDeathsByServer[serverId] || mockDeathsByServer["default"])];
    
    if (minLevel > 0) {
      deaths = deaths.filter(d => d.level >= minLevel);
    }
    
    if (vipOnly) {
      deaths = deaths.filter(d => d.accountStatus.toLowerCase().includes('vip'));
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
    console.error("❌ Error:", err.message);
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