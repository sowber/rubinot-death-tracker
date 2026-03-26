# Get Started: Copy-Paste Commands

Run these commands in order:

---

## Step 1: Verify Changes (2 minutes)

```bash
# Check the updated Netlify function
cat netlify/functions/deaths.js | head -20

# Check frontend was updated
grep "netlify/functions/deaths" src/App.jsx
```

Expected output should show:
- Puppeteer imports ✓
- `?sever=` (not `?world=`) ✓
- `/.netlify/functions/deaths` endpoint ✓

---

## Step 2: Test Locally (5 minutes)

```bash
# Build the frontend
npm run build

# Test with Netlify CLI
npm install -g netlify-cli
netlify dev

# In another terminal:
curl "http://localhost:8888/.netlify/functions/deaths?sever=20"
```

Watch for:
- ✓ Response returns JSON with death data
- ✓ Logs show "🚀 Launching browser..." then "♻️  Reusing browser"
- ✓ Second curl request is faster (<200ms)

Exit: Ctrl+C in both terminals

---

## Step 3: Deploy to Netlify (3 minutes)

```bash
# Commit changes
git add netlify/functions/deaths.js src/App.jsx
git commit -m "Update for new Rubinot site - Puppeteer for dynamic content"

# Push (triggers automatic deploy)
git push origin main
# or: git push origin master
```

Monitor at: https://app.netlify.com/sites/YOUR-SITE-NAME/deploys

Wait for "Published" status (usually 1-2 minutes).

---

## Step 4: Verify Deployment (5 minutes)

```bash
# Test the live function
curl "https://YOUR-SITE-NAME.netlify.app/.netlify/functions/deaths?sever=20"

# Should return JSON with death data

# Open in browser
open https://YOUR-SITE-NAME.netlify.app
# Try selecting different servers
```

Checklist:
- [ ] Deaths appear when page loads
- [ ] Can select different servers
- [ ] Response time is reasonable (<3s for first, <1s for subsequent)
- [ ] Character data shows (not all "Unknown")

---

## Step 5: Monitor for Issues (Ongoing)

```bash
# Watch function logs in real-time
# Go to: https://app.netlify.com/sites/YOUR-SITE-NAME/functions
# Or tail logs via CLI:

netlify functions:list
netlify functions:logs deaths
```

Look for:
- ✓ "Cache hit" messages (means caching works)
- ✓ "🚀 Launching browser" only on first request
- ✓ "♻️  Reusing browser" on subsequent requests
- ✗ Avoid: "❌ Error" messages

---

## If Something Goes Wrong

### "No deaths found" Error
```bash
# DOM selector mismatch
# 1. Go to https://rubinot.com.br/deaths?sever=20
# 2. Press F12 (DevTools) → Console
# 3. Run:
document.querySelectorAll("table tbody tr").length
# 4. If it returns 0, selector needs fixing
# See: QUICK_ACTION.md Step 1
```

### "Browser not launching"
```bash
# Netlify memory limit
# Edit netlify/functions/deaths.js
# Change: const latestDeaths = deaths.slice(0, 5);
# To:     const latestDeaths = deaths.slice(0, 1);
# Then redeploy:
git add netlify/functions/deaths.js
git commit -m "Reduce character fetches to 1"
git push origin main
```

### "Character data showing Unknown"
```bash
# Character page structure different
# See: DEBUGGING_NEW_SITE.md for selector troubleshooting
```

---

## Quick Reference: Command Cheat Sheet

```bash
# Build frontend
npm run build

# Test locally
netlify dev

# Test function directly
curl "http://localhost:8888/.netlify/functions/deaths?sever=20"

# Deploy
git add . && git commit -m "message" && git push origin main

# View function logs
netlify functions:logs deaths

# Rollback if needed
git revert <commit-hash>

# Check browser is working
node -e "const p = require('puppeteer'); p.launch().then(b => b.close().then(() => console.log('✓ Works')))"
```

---

## Expected Timeline

| Step | Time | Action |
|------|------|--------|
| Verify | 2 min | Check code was updated |
| Local test | 5 min | npm build + netlify dev |
| Deploy | 3 min | git push |
| Live test | 5 min | Test deployed site |
| **Total** | **15 min** | Should be live! |

---

## Performance Expectations

### First Request (Browser Launches)
```
⏱️ Duration: 3-5 seconds
📝 Logs: "🚀 Launching browser..."
💾 Memory: Building up to 200-400MB
```

### Second Request (Browser Reused)
```
⏱️ Duration: <200ms (if cached) or 1-2s (if not cached)
📝 Logs: "♻️  Reusing browser"
💾 Memory: Stays at 200-400MB
```

### After 10 Requests
```
⏱️ Most requests: <200ms (cache hits)
⏱️ Some requests: 1-2s (cache misses)
📊 Smart caching working as intended
```

---

## Documentation Added

Four new guides were created:

1. **QUICK_ACTION.md** - Deploy checklist & troubleshooting
2. **DEBUGGING_NEW_SITE.md** - Detailed DOM selector debugging
3. **ARCHITECTURE_UPDATE.md** - Technical deep-dive
4. **API_DISCOVERY_GUIDE.md** - Find faster APIs if available
5. **DEPLOYMENT_SUMMARY.md** - Overview of all changes

---

## Need Help?

1. **Before deploying**: Check QUICK_ACTION.md Step 1 (DOM selectors)
2. **After deploying**: Check function logs at https://app.netlify.com/sites/YOUR-SITE/functions
3. **Stuck?**: Review DEBUGGING_NEW_SITE.md for your specific issue
4. **Want to optimize further?**: Follow API_DISCOVERY_GUIDE.md

---

**Ready to deploy? Run Step 3 above!** 🚀
