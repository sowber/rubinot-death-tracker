# Debugging Guide: New Rubinot Deaths Tracker

## Changes Made

### 1. **Updated Netlify Function** (`netlify/functions/deaths.js`)
- ✅ Switched from simple `fetch()` to **Puppeteer** for dynamic content
- ✅ Using stealth mode to avoid bot detection
- ✅ Browser instance reuse for better Netlify performance
- ✅ Updated URLs:
  - Deaths: `https://rubinot.com.br/deaths?sever=<servernumberhere>`
  - Characters: `https://rubinot.com.br/characters?name=<charnamehere>`

### 2. **Frontend Updates** (`src/App.jsx`)
- ✅ Changed API endpoint to `/.netlify/functions/deaths`
- ✅ Updated query parameter from `world=` to `sever=` (matches new website typo)

### 3. **Key Optimizations**
- **Puppeteer browser reuse**: Avoids cold starts on Netlify (browser launches once, reused across requests)
- **3-second cache**: Deaths data cached briefly to avoid hammering the site
- **2-hour character cache**: Character data cached long-term
- **Stealth mode**: Bypasses bot detection with `puppeteer-extra-plugin-stealth`

---

## Testing & Debugging Steps

### Step 1: Test Locally
```bash
npm run build
npm run dev:server
# Visit http://localhost:3000
# Open DevTools → Network tab
# Check if `/api/deaths?sever=20` returns data
```

### Step 2: Monitor Logs
The function logs help debug:
- `🚀 Launching browser...` = Browser startup
- `♻️  Reusing browser` = Browser reuse (good!)
- `🌐 Fetching deaths for server X...` = Starting fetch
- `✅ Parsed X deaths` = Success
- `❌ Error: ...` = Problem area

### Step 3: Fix DOM Selectors
**If you see "No deaths found" error**, the table selectors need updating.

Open browser DevTools on https://rubinot.com.br/deaths?sever=20 and find the actual selectors:

```javascript
// In DevTools Console, test these:

// For deaths table:
document.querySelectorAll("table tbody tr")  // Check if this returns rows
document.querySelectorAll("div.TableContent table tr")  // Alternative
document.querySelectorAll("table.TableContent tr")  // Another option

// For character page selectors:
// Go to https://rubinot.com.br/characters?name=<playername>
document.querySelector("table")  // Should exist
document.querySelectorAll("td")  // Should contain character info
```

---

## Common Issues & Fixes

### Issue: "No deaths found - page structure may have changed"
**Cause**: DOM selectors don't match the actual HTML

**Fix**: Update `extractDeathsFromPage()` function:
```javascript
// Current selector:
const rows = document.querySelectorAll("table tbody tr");

// Try alternates if above fails:
// Option 1: Different table class
const rows = document.querySelectorAll(".deaths-table tr");

// Option 2: Get all table rows
const rows = document.querySelectorAll("table tr:not(:first-child)");  

// Option 3: More specific path
const rows = document.querySelectorAll("div.content table tbody tr");
```

Then update cell extraction:
```javascript
// If cells are in different positions:
const time = cells[0]?.innerText.trim() || '';      // Position 0?
const player = cells[1]?.querySelector("a")?.innerText || '';
const cause = cells[2]?.innerText || '';
```

### Issue: Character data showing "Unknown"
**Cause**: Character page DOM structure different

**Fix**: Update `extractCharacterFromPage()`:
```javascript
// Current approach: regex text matching
// Alternative: Query specific elements
const vocation = document.querySelector(".vocation")?.innerText;
const residence = document.querySelector(".residence")?.innerText;

// Or find all table cells and match labels
const allCells = Array.from(document.querySelectorAll("td"));
const vocCell = allCells.find(el => el.innerText.toLowerCase().includes("vocation"));
if (vocCell) {
  const nextCell = vocCell.nextElementSibling;
  info.vocation = nextCell?.innerText || 'Unknown';
}
```

### Issue: Browser not launching on Netlify
**Cause**: Netlify memory/timeout limits

**Fix**: Already optimized with:
- Single-process mode `--single-process`
- Disabled GPU `--disable-gpu`
- Reduced viewport `{ width: 1024, height: 768 }`

If still failing, reduce to 1 character fetch:
```javascript
const latestDeaths = deaths.slice(0, 1);  // Only fetch 1 char instead of 5
```

---

## How the Dynamic Updates Work

The website loads data **without full page refresh** when you:
1. Change server dropdown
2. Type in level filter
3. Check VIP box

**This means**:
- JavaScript renders content to DOM
- Network requests happen in background
- Puppeteer waits with `waitUntil: "networkidle2"` to let JS load data

This is why we can't use simple `fetch()` anymore - the initial HTML doesn't contain the table data!

---

## Next Steps for Testing

1. **Deploy to Netlify**:
   ```bash
   git add .
   git commit -m "Update for new Rubinot site - use Puppeteer for dynamic content"
   git push
   ```

2. **Monitor Netlify Functions**:
   - Go to `https://app.netlify.com/sites/<your-site>/functions`
   - Watch logs while testing

3. **Test All Servers**:
   - Try different server IDs: 11, 19, 15, 17, 1, 9, 18, 12, 10, 20, 16
   - Check character data loads for each

4. **Performance Monitoring**:
   - First request: ~3-5 seconds (browser launches)
   - Subsequent requests: ~1-2 seconds (browser reused + cache)

---

## Rollback Plan

If you need to go back to the old approach:
```bash
git log --oneline
git revert <commit-hash>
```

Or manually restore old version from `git show HEAD~1:netlify/functions/deaths.js`
