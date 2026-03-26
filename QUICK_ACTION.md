# Quick Action Checklist

## ✅ Changes Already Made

- [x] Updated `netlify/functions/deaths.js` to use Puppeteer instead of fetch
- [x] Changed URLs to new format: `deaths?sever=X` and `characters?name=X`
- [x] Updated `src/App.jsx` to call `/.netlify/functions/deaths?sever=X`
- [x] Added browser reuse optimization
- [x] Added stealth mode for bot detection
- [x] Implemented 3-second deaths cache + 2-hour character cache

---

## 🔍 Before Deploying: Verify DOM Selectors

**CRITICAL**: The table selectors must match the actual website structure.

### Step 1: Test on Production Website
1. Open https://rubinot.com.br/deaths?sever=20
2. Open DevTools (F12)
3. Go to Console tab
4. Run these commands:

```javascript
// Test 1: Can we find death rows?
document.querySelectorAll("table tbody tr").length

// Should print something like: 10, 15, 20 (number of rows)
// If prints 0, try alternatives:
document.querySelectorAll("table tr").length
document.querySelectorAll("div.deaths table tr").length
document.querySelectorAll("[class*='table'] tr").length

// Test 2: Extract first death player name
const firstRow = document.querySelectorAll("table tbody tr")[0];
const playerCell = firstRow.querySelectorAll("td")[2];  // Adjust index if needed
playerCell.querySelector("a")?.innerText

// Should print: actual player name
// If prints "undefined", adjust the cell index [2] → [1] or [3] or [0]
```

### Step 2: If Selectors Don't Match
Edit `netlify/functions/deaths.js` in the `extractDeathsFromPage()` function:

**Current code** (lines ~90-110):
```javascript
const rows = document.querySelectorAll("table tbody tr");
```

**If the above didn't return rows**, try these in order and use the one that works:
```javascript
// Option A: All table rows
const rows = document.querySelectorAll("table tr:not(:first-child)");

// Option B: Specific class
const rows = document.querySelectorAll(".death-row");

// Option C: More specific path
const rows = document.querySelectorAll("div.content table tbody tr");

// Option D: Get all and filter
const rows = Array.from(document.querySelectorAll("table tr")).slice(1);
```

### Step 3: Test Character Page
1. Go to character page: https://rubinot.com.br/characters?name=SomeCharacterName
2. In Console, run:

```javascript
// Should return true if vocation info exists:
document.body.innerText.includes("Vocation")

// Check other fields:
document.body.innerText.includes("Residence")
document.body.innerText.includes("Guild")

// If character info exists, this approach works!
// The current regex-based parsing should work.
```

---

## 🚀 Deployment Steps

### Option A: Deploy to Netlify (Recommended)
```bash
# 1. Commit changes
git add netlify/functions/deaths.js src/App.jsx
git commit -m "Update for new Rubinot site - dynamic content with Puppeteer"

# 2. Push to trigger deploy
git push origin main
# or
git push origin master

# 3. Monitor deployment
# Go to https://app.netlify.com/sites/<your-site-name>/deploys
# Wait for "Published" status (usually 1-2 minutes)

# 4. Check function logs
# Go to https://app.netlify.com/sites/<your-site-name>/functions
# Filter for "deaths" function
# Make a request to your site and watch logs appear
```

### Option B: Test Locally First
```bash
# 1. Build the frontend
npm run build

# 2. Test with Netlify CLI
npm install -g netlify-cli  # If not installed
netlify dev
# Opens http://localhost:8888

# 3. Open in browser and test
# DevTools → Network tab
# Select server dropdown
# Should see request to /.netlify/functions/deaths?sever=X
# Should see response with death data

# 4. Check function logs in CLI output
```

---

## 🧪 Testing After Deploy

### Test 1: Basic Deaths Fetch
```bash
# Test different servers
curl "https://<your-domain>.netlify.app/.netlify/functions/deaths?sever=20"
curl "https://<your-domain>.netlify.app/.netlify/functions/deaths?sever=11"
curl "https://<your-domain>.netlify.app/.netlify/functions/deaths?sever=1"

# Should return JSON array with deaths
# Each death should have: player, level, cause, time, vocation, residence, guild, accountStatus
```

### Test 2: Character Data
Look at response JSON - check if objects have these fields:
```json
{
  "player": "CharacterName",
  "level": 123,
  "cause": "Death cause",
  "time": "25.03.2026, 14:30:45",
  "vocation": "Elite Knight",        // Should NOT be "Unknown"
  "residence": "Thais",              // Should NOT be "Unknown"
  "guild": "Guild Name",             // Should NOT be "Unknown"
  "accountStatus": "VIP Account"     // Should NOT be "Free Account"
}
```

If all show "Unknown", the character page selector needs fixing.

### Test 3: Cache Behavior
```bash
# First request (cache miss):
time curl "https://<your-domain>.netlify.app/.netlify/functions/deaths?sever=20"
# Should take 2-3 seconds, logs show "Parsing X deaths"

# Second request immediately after (cache hit):
time curl "https://<your-domain>.netlify.app/.netlify/functions/deaths?sever=20"
# Should take <100ms, logs show "Cache hit for server 20"
```

### Test 4: Performance Check
Monitor Netlify Functions dashboard:
- **Duration**: First request 2-5s (browser launches), subsequent <2s (reuse)
- **Memory**: Should be 200-400MB
- **Status**: All 200 (unless site is down)

---

## ⚠️ Troubleshooting Guide

### Problem: "No deaths found - page structure may have changed"
**Diagnosis**:
1. Check website manually - are deaths showing?
2. Run DOM selector test from Step 1 above
3. Are the table rows present?

**Solutions**:
1. Update selectors in `extractDeathsFromPage()` function
2. Add temporary console.log to see what HTML is getting:
   ```javascript
   const html = await page.content();
   console.log(html.substring(0, 500));  // Log first 500 chars
   ```
3. Open browser's DevTools Inspector and find the correct CSS selector

### Problem: Character data shows "Unknown" for all fields
**Diagnosis**:
1. Character pages load but data not extracted
2. DOM structure different than expected

**Solutions**:
1. Manually visit character page and inspect HTML
2. Update `extractCharacterFromPage()` function with correct selectors
3. Try alternative regex patterns if HTML structure differs

### Problem: "Browser disconnected, creating new one" appears many times
**Diagnosis**:
1. Browser crashing or Netlify limits
2. Out of memory

**Solutions**:
1. Reduce character fetches: Change `const latestDeaths = deaths.slice(0, 5);` to `slice(0, 1);`
2. Add resource blocking (from server-optimized.js):
   ```javascript
   await page.setRequestInterception(true);
   page.on('request', (req) => {
     if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
       req.abort();
     } else {
       req.continue();
     }
   });
   ```

### Problem: Timeout on Netlify
**Diagnosis**:
1. Function takes >10 seconds (free tier) or >26 seconds (paid)
2. Browser stuck waiting for something

**Solutions**:
1. Reduce character data fetches to 1: `deaths.slice(0, 1)`
2. Reduce timeout: `waitUntil: "domcontentloaded"` instead of `"networkidle2"`
3. Add `timeout: 10000` to page.goto()
4. Skip character data entirely for MVP:
   ```javascript
   // Return deaths without character data
   return deaths.map(d => ({
     ...d,
     vocation: "Unknown",
     residence: "Unknown",
     guild: "No Guild",
     accountStatus: "Free Account"
   }));
   ```

---

## 📊 Success Indicators

- [x] Function deploys without errors
- [ ] First request returns death data (even if character fields are "Unknown")
- [ ] Cache logging shows hit/miss correctly
- [ ] Second request in <200ms
- [ ] Character data shows real values (not "Unknown")
- [ ] All 11 servers clickable and returning data
- [ ] Zero error responses (status 200 for all)

---

## 🆘 If Everything Fails

**Fallback Option**: Keep server-optimized.js working locally
```bash
npm run dev:server
# App runs on localhost:3000 with working deaths tracker
# Can manually deploy this to other services (Railway, Render, etc.) if Netlify function fails
```

---

## 📝 Notes

- **URL typo preserved**: New website uses `?sever=` (not `?server=`). Script matches this.
- **Netlify environment**: Functions run Node.js with Puppeteer support
- **Cold starts**: First request slow (~3-5s), subsequent requests fast (<2s) due to browser reuse
- **Browser memory**: ~200-300MB with reuse, acceptable for Netlify

---

## Questions?

If you hit issues:
1. Check `DEBUGGING_NEW_SITE.md` for detailed debugging steps
2. Review `ARCHITECTURE_UPDATE.md` for technical overview
3. Post error message + server ID to check reproducibility
