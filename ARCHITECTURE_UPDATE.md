# Architecture Update: From Static HTML to Dynamic Content

## The Problem

The old Rubinot website:
- Served deaths table in initial HTML response
- Could use simple `fetch()` + regex parsing
- Consistent HTML structure per request

The new Rubinot website:
- Serves mostly empty HTML shell
- Uses JavaScript to **dynamically load** deaths data
- Data loads **without page refresh** when filters change
- Updates happen **on user interaction** (server select, level filter, VIP checkbox)

**Old approach failed because**: Initial fetch returns empty/placeholder content; actual deaths load AFTER JavaScript executes.

---

## The Solution: Browser Automation with Puppeteer

### Why Puppeteer?
- ✅ Executes JavaScript (renders dynamic content)
- ✅ Waits for content to load (`waitUntil: "networkidle2"`)
- ✅ Browser instance reuse (critical for Netlify cold starts)
- ✅ Can intercept network requests to find API endpoints
- ✅ Stealth mode bypasses bot detection

### Why NOT direct API calls?
- ❌ API endpoint URL unknown (not exposed in HTML)
- ❌ Would require intercepting actual XHR/fetch requests
- ❌ API response format unknown
- ⚠️ Could break if API changes

**Puppeteer is safer** because we extract from DOM (what user sees), not internal API.

---

## Architecture Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Frontend (React App)                                            │
│ User selects server via dropdown                                │
└──────────┬──────────────────────────────────────────────────────┘
           │
           │ Fetch /.netlify/functions/deaths?sever=20
           │
┌──────────▼──────────────────────────────────────────────────────┐
│ Netlify Function (Node.js)                                      │
│ netlify/functions/deaths.js                                     │
├──────────────────────────────────────────────────────────────────┤
│ 1. Check cache (3-second TTL) → Return if hit                   │
│ 2. Launch/reuse Puppeteer browser                               │
│ 3. Navigate to https://rubinot.com.br/deaths?sever=20           │
│ 4. Wait for DOM: "table tbody tr" selector                      │
│    ↓                                                             │
│    JavaScript executes, AJAX loads deaths data                  │
│    ↓                                                             │
│    networkidle2 = network activity stops                        │
│ 5. Extract deaths from DOM                                      │
│ 6. For each death:                                              │
│    - Check character cache (2-hour TTL)                         │
│    - If miss: Fetch character page at                           │
│      https://rubinot.com.br/characters?name=PlayerName          │
│    - Wait for load, extract vocation/residence/guild/status     │
│    - Cache result                                               │
│ 7. Return full death data with character info                   │
│ 8. Cache entire response (3 seconds)                            │
│ 9. Keep browser alive for next request                          │
└──────────┬──────────────────────────────────────────────────────┘
           │ JSON response
           │
┌──────────▼──────────────────────────────────────────────────────┐
│ Frontend (React App)                                            │
│ Display deaths with character data                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Performance Optimizations

### 1. Browser Reuse
```javascript
// Without reuse: Each request launches new browser = 5-10s per request
// With reuse: Second request reuses warm browser = 1-2s per request

// Netlify limitation: Functions timeout at 10 seconds with free tier,
// 26 seconds with paid. Browser startup is ~3s, so reuse is CRITICAL.
```

### 2. Dual Caching Strategy
```
Deaths Cache (3 seconds)
├─ Key: deaths_20_v4
├─ TTL: 3 seconds
└─ Use case: Same server queries within few seconds

Character Cache (2 hours)
├─ Key: char_playername_lowercase
├─ TTL: 7200000ms (2 hours)
├─ Size limit: 200 entries (LRU eviction)
└─ Use case: Same character name doesn't change vocation/residence
```

### 3. Resource Blocking
Already implemented in server-optimized.js (can add to Netlify version):
```javascript
// Block resources to reduce memory:
// - Images → Not needed for data extraction
// - Stylesheets → Not rendered anyway
// - Fonts → Not rendered anyway
// - Media → Not used
```

### 4. Viewport Optimization
```javascript
// Smaller viewport = less rendering
await page.setViewport({ width: 1024, height: 768 });
// vs. default 1920x1080 = 60% less memory
```

---

## What Happens During Updates

When user **changes server** on the website:
1. JavaScript event listener fires
2. New AJAX request to fetch deaths for selected server
3. New data renders to DOM
4. Page stays same URL (no reload)

**How Puppeteer captures this**:
- We navigate to URL with `?sever=20` (server specified in URL)
- Puppeteer waits for network idle after page loads
- At this point, JavaScript HAS executed and loaded the data
- We extract from DOM (which now has the correct data)

---

## DOM Structure - What to Verify

Test in browser console at `https://rubinot.com.br/deaths?sever=20`:

```javascript
// Deaths table check:
const rows = document.querySelectorAll("table tbody tr");
console.log(`Found ${rows.length} death rows`);

// Inspect first row:
const firstRow = rows[0];
const cells = firstRow.querySelectorAll("td");
cells.forEach((cell, i) => {
  console.log(`Cell ${i}:`, cell.innerText.substring(0, 50));
});

// Character page check (on character page):
const vocText = document.body.innerText;
console.log(vocText.includes("Vocation:"));  // Should be true
```

---

## Error Handling Strategy

The function gracefully degrades:
1. **Table selector fails** → Logs warning, tries to extract available content
2. **Character fetch fails** → Returns death with "Unknown" fields
3. **Browser disconnects** → Resets and launches new browser on next request
4. **Timeout** → Returns 500 error with specific message

---

## Testing Approach

### Stage 1: Manual Testing (Local)
```bash
npm run build
node server-optimized.js
# Open http://localhost:3000
# Watch console logs
```

### Stage 2: Netlify Dev Testing
```bash
netlify dev
# Tests actual Netlify function runtime
# Can see function logs in real-time
```

### Stage 3: Deployed Testing
```bash
# Monitor at: https://app.netlify.com/sites/<name>/functions
# Check: https://<site>.netlify.app
# Test different servers with: /?server=20, /?server=11, etc.
```

### Stage 4: A/B Testing (Optional)
Keep both versions running:
```
/api/deaths → Old version (HTML scraping)
/.netlify/functions/deaths → New version (Puppeteer)

// In frontend, use feature flag:
const response = await fetch(
  usePuppeteer 
    ? '/.netlify/functions/deaths?sever=20'
    : '/api/deaths?world=20'
);
```

---

## Debugging Commands

```javascript
// In Netlify function, add temporary logging:

// Log DOM content for debugging:
const html = await page.content();
console.log(html.substring(0, 1000));  // First 1000 chars of rendered HTML

// Check what JavaScript set:
const tableHTML = await page.evaluate(() => {
  return document.querySelector("table")?.outerHTML;
});
console.log(tableHTML);

// Test specific selectors:
const count = await page.evaluate(() => {
  return document.querySelectorAll("table tbody tr").length;
});
console.log(`Row count: ${count}`);
```

---

## Rollback Strategy

If Puppeteer approach fails:

**Option 1**: Revert to HTML parsing
- Check if JavaScript generates HTML that contains data
- Use parsing instead of DOM extraction
- Trade-off: Slower, less robust

**Option 2**: Find API endpoint
- Use browser's Network tab → XHR filter
- Find the API URL the website calls
- Call API directly instead of using Puppeteer
- Trade-off: Fragile if API changes

**Option 3**: Hybrid approach
- Use Puppeteer to intercept requests
- Get API endpoint URL dynamically
- Switch to direct API calls for performance

---

## Monitoring & Alerts

For production, monitor:
1. **Function execution time**: Should be 1-3 seconds (with cache/reuse)
2. **Error rate**: Should be < 1%
3. **Cache hit rate**: Higher = better performance
4. **Browser reuse rate**: Check logs for "Reusing browser" frequency

```javascript
// Add custom metric to logs:
console.log(`⏱️ Total time: ${Date.now() - startTime}ms`);
console.log(`💾 Cache: ${cacheHits} hits, ${cacheMisses} misses`);
console.log(`🔄 Browser: ${sharedBrowser ? 'reused' : 'spawned'}`);
```

---

## Next Actions

1. **Verify DOM selectors** on new website (see DEBUGGING_NEW_SITE.md)
2. **Deploy to Netlify** and monitor function logs
3. **Test each server** (IDs: 11, 19, 15, 17, 1, 9, 18, 12, 10, 20, 16)
4. **Monitor performance** metrics over first few hours
5. **Adjust cache duration** based on actual update frequency
6. **Fine-tune character data extraction** based on table structure
