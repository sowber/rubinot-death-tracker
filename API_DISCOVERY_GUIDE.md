# API Discovery Guide: Finding Direct API Endpoints

**Status**: The current implementation uses Puppeteer to render the page. If the new website has a public API endpoint, we can optimize further by calling it directly.

---

## Why Check for APIs?

| Approach | Speed | Memory | Reliability |
|----------|-------|--------|-------------|
| **Puppeteer** (current) | 2-5s per request | 200-400MB | High (uses DOM) |
| **Direct API** (if available) | <500ms per request | 50-100MB | Depends on API stability |

If the website makes API calls, we can skip the browser entirely and call the same API.

---

## How to Discover the API

### Step 1: Open DevTools Network Tab
1. Go to https://rubinot.com.br/deaths?sever=20
2. Press F12 (DevTools)
3. Click **Network** tab
4. Reload the page (Ctrl+R)

### Step 2: Look for XHR/Fetch Requests
The Network tab shows all HTTP requests:
- 🔴 **XHR** (XMLHttpRequest) - Old AJAX
- 🔴 **Fetch** - Modern AJAX
- 🟠 **document** - HTML page
- 🟢 **stylesheet** - CSS
- 🔵 **script** - JavaScript

**Focus on**: Red entries (XHR/Fetch) after page load

### Step 3: Inspect Request Details
Click on a suspicious XHR/Fetch request:
- **Headers tab**: See URL, method (GET/POST), auth headers
- **Payload tab**: What data is sent
- **Response tab**: See the JSON/data returned

### Step 4: Test the Endpoint

If you find an API endpoint like:
```
GET https://rubinot.com.br/api/deaths?server=20
```

Test it in browser console:
```javascript
// Test the endpoint
fetch('https://rubinot.com.br/api/deaths?server=20')
  .then(r => r.json())
  .then(data => console.log(data))
```

If it returns death data, we found it!

---

## Common API Patterns

Look for requests to URLs like:

```
// Deaths/latestdeaths endpoint
/api/deaths
/api/deaths?server=20
/api/latestdeaths
/deaths/latest
/api/v1/deaths

// Character endpoint
/api/character
/api/character?name=PlayerName
/characters/info
/api/v1/characters/:name

// Server list
/api/servers
/servers/list
```

---

## If You Find an API

### Create Alternative Implementation

Keep the current Puppeteer version but add API version:

```javascript
// netlify/functions/deaths-api.js (NEW FILE - API-based)

export async function handler(event) {
  const serverId = event.queryStringParameters?.sever || "20";
  
  try {
    // If API endpoint was discovered as: /api/deaths?server=X
    const deathsResponse = await fetch(
      `https://rubinot.com.br/api/deaths?server=${serverId}`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0...'
        }
      }
    );
    
    const deathsData = await deathsResponse.json();
    
    // Get character data for each death
    const deathsWithChars = await Promise.all(
      deathsData.slice(0, 5).map(async (death) => {
        const charResponse = await fetch(
          `https://rubinot.com.br/api/character?name=${death.player}`
        );
        const charData = await charResponse.json();
        return { ...death, ...charData };
      })
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(deathsWithChars)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
```

### Test Both Versions
Deploy both:
- `/.netlify/functions/deaths` (Puppeteer - current)
- `/.netlify/functions/deaths-api` (Direct API - if found)

A/B test which works better:
```javascript
// In frontend
const response = await fetch('/.netlify/functions/deaths-api?sever=20');
if (response.ok) {
  // Use API version (faster)
} else {
  // Fall back to Puppeteer version
  return fetch('/.netlify/functions/deaths?sever=20');
}
```

---

## Common Issues with APIs

### Issue 1: CORS Blocking
API might return:
```
Access-Control-Allow-Origin denied
```

**Solution**: The Netlify function calls the API from the server side, not from browser, so CORS won't block it. No action needed.

### Issue 2: Authentication Required
API might require:
```javascript
// Authorization header
'Authorization': 'Bearer token123'

// Or API key
'X-API-Key': 'key123'
```

**Solution**: Get from website's JavaScript source:
```javascript
// In DevTools Console on the site itself:
document.querySelector('meta[name="api-token"]')?.content
localStorage.getItem('api-token')
sessionStorage.getItem('api-key')
```

### Issue 3: Rate Limiting
API might block requests if too fast:
```
HTTP 429 Too Many Requests
```

**Solution**: Add caching (already implemented) and delays:
```javascript
// Add delay between character requests
await new Promise(resolve => setTimeout(resolve, 500));
```

### Issue 4: API Changes
Website updates API → endpoint breaks

**Solution**: Keep Puppeteer as fallback. If API calls fail:
```javascript
// Try API first
try {
  data = await fetch('API_ENDPOINT');
} catch {
  // Fall back to Puppeteer
  data = await puppeteerScraping();
}
```

---

## If No API Found

The current Puppeteer implementation is the right approach. The website might:
- Load data in client-side rendering (no public API)
- Use websockets (not REST)
- Require browser automation to work

Puppeteer handles all these cases.

---

## Investigation Checklist

- [ ] Open https://rubinot.com.br/deaths?sever=20
- [ ] Open DevTools (F12) → Network tab
- [ ] Reload page
- [ ] Look for red XHR/Fetch requests
- [ ] Click each request → inspect Response tab
- [ ] Note any API endpoints that return death data
- [ ] Test endpoint in console: `fetch('API_URL').then(r => r.json()).then(console.log)`
- [ ] If successful, share the API endpoint for optimization
- [ ] If no API found, use current Puppeteer implementation

---

## Report Template

If you find an API, share:

```
API Found! 🎉

Deaths Endpoint:
URL: https://rubinot.com.br/api/...
Method: GET/POST
Response: [Sample response JSON]
Example: https://rubinot.com.br/api/...?server=20

Character Endpoint:
URL: https://rubinot.com.br/...
Method: GET/POST
Response: [Sample response JSON]
Example: https://rubinot.com.br/..?name=SomePlayer

Authentication: Yes/No
Rate Limit: X requests per Y seconds
CORS: Allows external domains
```

---

## Optional: Performance Comparison

Once identified, we can measure:

```javascript
// Puppeteer version
console.time('puppeteer');
const response1 = await fetch('/.netlify/functions/deaths?sever=20');
console.timeEnd('puppeteer');

// API version (if found)
console.time('api');
const response2 = await fetch('/.netlify/functions/deaths-api?sever=20');
console.timeEnd('api');
```

Expected results:
- Puppeteer: 2-5 seconds
- Direct API: <500ms

---

**Status**: Current implementation works without needing an API. This guide is for future optimization if one is discovered.
