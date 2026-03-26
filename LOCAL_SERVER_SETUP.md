# Local Puppeteer Server Setup Guide

This guide walks you through running a local Node + Puppeteer server that fetches **real, live deaths data** from Rubinot, bypassing all Cloudflare/IP restrictions.

## Why This Works

- **Real Browser**: Puppeteer runs an actual Chrome browser, so Rubinot's Cloudflare protection sees legitimate browser traffic
- **No IP Blocking**: Requests come from your local IP, not Netlify's blocked IPs
- **Live Data**: You get actual deaths as they happen on Rubinot
- **Development**: Perfect for testing locally before deployment

## Prerequisites

Make sure you have:
- Node.js 16+ installed (`node --version`)
- Puppeteer already in package.json (it is)

## Step 1: Install Puppeteer (if not already installed)

```bash
npm install puppeteer
```

This downloads a compatible Chromium browser (~300MB) - only happens once.

## Step 2: Start the Local Server

Open a terminal in your project root and run:

```bash
node server-puppeteer.js
```

**Expected output:**
```
🚀 Launching Puppeteer browser...
✅ Browser launched successfully

🎯 Puppeteer death tracker server running on http://localhost:3001
📍 API endpoint: http://localhost:3001/api/deaths?world=20&min_level=0

To use this with React:
1. Update App.jsx to call http://localhost:3001/api/deaths?...
2. Keep this server running while developing
```

✅ **Server is now running!** Keep this terminal open.

## Step 3: Test the Endpoint (in a new terminal)

Test that the server works:

```bash
curl "http://localhost:3001/api/deaths?world=20&min_level=0"
```

Or just visit in your browser:
```
http://localhost:3001/api/deaths?world=20&min_level=0
```

**Expected response:** A JSON array of death objects like:
```json
[
  {
    "time": "1774488165",
    "level": 403,
    "killed_by": "Rhydon Diaboliczny",
    "is_player": 1,
    "victim": "Teleei Maker Baltrium",
    "worldName": "Tenebrium"
  },
  ...
]
```

## Step 4: Start React Dev Server (in another terminal)

```bash
npm run dev
```

This starts React on `http://localhost:5173` (or 3000 if using older config).

## Step 5: Test in the Browser

1. Open your React app in browser: `http://localhost:5173`
2. Open **DevTools Console** (F12 → Console)
3. **Select a world** from the dropdown
4. **Watch the console logs**:
   - `🔗 Trying local server...` - attempting to connect to local server
   - `✅ Got X deaths from LOCAL Puppeteer server!` - **SUCCESS! Real data!**
   - Or `⚠️ Local server unavailable...` - local server not running, falling back to mock

## How It Works

**When local server is running:**
```
React App → Local Node Server (localhost:3001)
            ↓
         Puppeteer Browser
            ↓
         Chromium (real browser)
            ↓
         Rubinot.com.br (sees legitimate browser traffic)
            ↓
         Real deaths data ✅
```

**When local server is NOT running:**
```
React App → Netlify Function
            ↓
         Mock deaths data (fallback)
```

## Server Parameters

The endpoint accepts these query parameters:

| Parameter | Description | Default |
|-----------|-------------|---------|
| `world` | World ID (11, 15, 17, 20, etc.) | 20 |
| `min_level` | Minimum level to show | 0 |
| `page` | Page number | 1 |

**Examples:**
- `http://localhost:3001/api/deaths?world=11&min_level=100&page=1` - Auroria, level 100+
- `http://localhost:3001/api/deaths?world=20&min_level=0&page=1` - Tormentum, all levels

## Troubleshooting

### ❌ "Cannot find module 'puppeteer'"
**Solution:** Install puppeteer
```bash
npm install puppeteer
```

### ❌ "Cannot find Chromium"
**Solution:** Puppeteer should auto-download Chromium, but you can explicitly download it:
```bash
npx puppeteer browsers install chrome
```

### ❌ Server starts but returns empty array
**Possible causes:**
- Rubinot website structure changed (check if `/api/deaths` endpoint still exists)
- Network timeout (try increasing timeout in server-puppeteer.js from 30000 to 60000)
- **Solution:** Check Rubinot.com.br/deaths in your browser to verify it's working

### ❌ "Port 3001 already in use"
**Solution:** Kill the process using port 3001:

On Windows PowerShell:
```powershell
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

On Mac/Linux:
```bash
lsof -i :3001
kill -9 <PID>
```

Or change the PORT in `server-puppeteer.js` to 3002, 3003, etc., and update the URL in App.jsx.

## Production Deployment

**For a deployed version with real data**, you have several options:

### Option 1: Railway.app (Recommended)
- Supports Node.js + Puppeteer
- Free tier available
- Easy deployment from GitHub
- Environment: Full system libraries for Chromium

### Option 2: Heroku
- Similar to Railway
- Used to have free tier (now paid)
- Good Puppeteer support

### Option 3: Your Own VPS
- DigitalOcean, Linode, AWS EC2
- Install Node.js and Puppeteer on the server
- Run the server 24/7

### Option 4: Keep Local, Share Link
- Run the server on your home computer
- Share the URL with a static IP or ngrok tunnel
- Others can use it remotely

**To deploy to Railway:** [See RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md)

## Performance Notes

- **First request**: 5-10 seconds (browser startup + navigation)
- **Subsequent requests**: 2-3 seconds (browser reuse)
- Consider caching responses for 30-60 seconds to reduce load

## Keeping It Running

For local development, keep the terminal open while you work. For production:

### Linux/Mac (using screen or tmux)
```bash
screen -S death-tracker
node server-puppeteer.js
# Press Ctrl+A then D to detach
# screen -r death-tracker  # to reattach later
```

### Windows (using PM2)
```bash
npm install -g pm2
pm2 start server-puppeteer.js --name death-tracker
pm2 save
pm2 startup
```

## Next Steps

1. ✅ Server running locally with real data
2. ⏭️ Test thoroughly for 24 hours
3. ⏭️ Decide on production deployment
4. ⏭️ Update Netlify to point to your production server

---

**Questions?** Check the console logs - they're very detailed and will tell you exactly what's happening at each step.
