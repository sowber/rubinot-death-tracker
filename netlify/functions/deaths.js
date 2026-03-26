// Real API version - Fetches deaths from rubinot.com.br
const cache = new Map();
const CACHE_DURATION = 5000; // 5 second cache

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
    const vipOnly = event.queryStringParameters?.vip === 'true';

    const cacheKey = `deaths_${worldName}_${minLevel}_${vipOnly}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ Cache hit for world ${worldName}`);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(cached.data)
      };
    }

    console.log(`📊 Fetching deaths for world ${worldName}, minLevel=${minLevel}`);

    // Fetch from real Rubinot API
    const response = await fetch('https://rubinot.com.br/deaths', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=UTF-8',
      },
      body: '{}'
    });

    if (!response.ok) {
      throw new Error(`Rubinot API returned ${response.status}`);
    }

    const apiData = await response.json();

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

    // Filter by world
    deaths = deaths.filter(d => d.worldName === worldName);

    // Filter by level
    if (minLevel > 0) {
      deaths = deaths.filter(d => d.level >= minLevel);
    }

    // Note: vipOnly filter not applicable with current API data
    // (no VIP status in the response)
    if (vipOnly) {
      console.log('⚠️  vipOnly filter not supported by Rubinot API');
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