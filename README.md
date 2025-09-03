# 🏈 12Bowl NFL Pick'em App

A modern, responsive NFL pick'em application designed for 6 kids to make weekly picks. Features a beautiful dark theme, Google Sheets backend integration, and comprehensive debugging tools.

## ✨ Features

- **🎨 Modern UI**: Beautiful dark theme with smooth animations
- **📱 Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **☁️ Cloud Sync**: Google Sheets backend for data persistence
- **🔄 Offline Support**: Falls back to local storage when offline
- **🏆 Live Standings**: Weekly and season leaderboards
- **🔧 Debug Tools**: Comprehensive admin controls for testing
- **💾 Auto-Save**: Automatically saves picks as you make them
- **🎯 Smart UI**: Visual feedback for completed games and correct/incorrect picks

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-username/12bowl.git
cd 12bowl
npm install
```

### 2. Google Sheets Setup

#### Create Google Sheets Document
1. Create a new Google Sheet
2. Create these tabs with the following structure:

**Settings Sheet:**
```
A1: Setting      B1: Value
A2: Current_Week B2: 1
```

**Games Sheet:**
```
A1: Week  B1: Day        C1: Time     D1: Away_Team  E1: Home_Team  F1: Over_Under  G1: Completed  H1: Winner  I1: Away_Score  J1: Home_Score
A2: 1     B2: Sunday     C2: 1:00 PM  D2: Team1      E2: Team2      F2: 45.5        G2: FALSE      H2:         I2:             J2:
```

**Picks Sheet:**
```
A1: Player  B1: Week  C1: GameID  D1: Pick  E1: Tiebreaker  F1: Timestamp
```

**Standings Sheet:**
```
A1: Player  B1: Wins  C1: Total_Games
A2: Kid1    B2: 0     C2: 0
A3: Kid2    B3: 0     C3: 0
A4: Kid3    B4: 0     C4: 0
A5: Kid4    B5: 0     C5: 0
A6: Kid5    B6: 0     C6: 0
A7: Kid6    B7: 0     C7: 0
```

#### Google Service Account Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google Sheets API
4. Create Service Account:
   - Go to IAM & Admin → Service Accounts
   - Click "Create Service Account"
   - Give it a name like "12bowl-sheets-access"
   - Create and download the JSON key file
5. Share your Google Sheet with the service account email (give Editor access)

### 3. Netlify Environment Variables

Set these in your Netlify dashboard under Site Settings → Environment Variables:

```bash
SHEET_ID=your_google_sheet_id_here
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nYourPrivateKeyHere\n-----END PRIVATE KEY-----
```

**Important:** For the private key, copy the entire key including the header and footer, and replace actual newlines with `\n`.

### 4. Deploy to Netlify

#### Option A: Git Integration (Recommended)
1. Push code to GitHub
2. Connect repository in Netlify
3. Set environment variables
4. Deploy

#### Option B: Manual Deploy
```bash
npm install -g netlify-cli
netlify login
netlify init
netlify env:set SHEET_ID "your_sheet_id"
netlify env:set GOOGLE_SERVICE_ACCOUNT_EMAIL "your_service_account_email"
netlify env:set GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY "your_private_key"
netlify deploy --prod
```

## 🔧 Development & Debugging

### Local Development
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Start local development server
netlify dev

# Access at http://localhost:8888
```

### Debug Mode
Add `?debug=true` to your URL to enable debug mode:
```
https://yoursite.netlify.app?debug=true
```

Debug mode provides:
- Console logging
- Debug panel (toggle with Ctrl+D)
- Admin controls in browser console
- Network request monitoring

### Admin Console Commands

Open browser console and use these commands:

```javascript
// Week Management
adminControls.setWeek(5)                    // Set current week
adminControls.getStatus()                   // Show current status

// Connection Testing  
adminControls.toggleOnlineMode()            // Toggle online/offline
adminControls.testBackend()                 // Test backend connection

// Data Management
adminControls.exportData()                  // Download all data as JSON
importFromFile()                            // Import data from JSON file
adminControls.resetSeason()                 // Reset all data (with confirmation)

// Game Simulation (for testing)
adminControls.simulateGameResults(2)        // Simulate results for week 2
adminControls.calculateWeekScores(2)        // Calculate scores for week 2
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "Offline Mode" / Connection Issues
**Symptoms:** Red "🔴 Offline Mode" indicator
**Solutions:**
```javascript
// Test backend connection
adminControls.testBackend()

// Check environment variables are set correctly
// Verify Google Sheets permissions
// Check Netlify function logs
```

#### 2. Google Sheets Permission Errors
**Symptoms:** 403 errors in network tab
**Solutions:**
- Ensure service account email has Editor access to the sheet
- Verify SHEET_ID is correct
- Check that all required environment variables are set

#### 3. Function Timeout Issues
**Symptoms:** 504 errors or slow responses
**Solutions:**
- Check Google Sheets API quotas
- Verify network connectivity
- Try the offline mode toggle

#### 4. Picks Not Saving
**Symptoms:** Picks disappear after refresh
**Solutions:**
```javascript
// Check if data exists locally
console.log(localStorage.getItem('nflPicks'))

// Force save current picks
savePicks(true)

// Export data as backup
adminControls.exportData()
```

### Network Debugging

Check Netlify function logs:
```bash
netlify functions:logs
```

Monitor network requests in browser DevTools:
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Look for calls to `/.netlify/functions/sheets-api`
4. Check response status and error messages

### Google Sheets API Debugging

Test your Google Sheets setup:
1. Open Google Sheets
2. Check that service account has access
3. Verify sheet structure matches expected format
4. Test with sample data

## 📊 Data Structure

### LocalStorage Keys
- `nflPicks`: All player picks by week
- `nflStandings`: Season standings data  
- `currentWeek`: Currently selected week

### Pick Data Format
```javascript
{
  "Kid1_week1": {
    "player": "Kid1",
    "week": 1,
    "games": {
      "1": "Kansas City",
      "2": "Pittsburgh"
    },
    "tiebreaker": 45
  }
}
```

### Game Data Format
```javascript
{
  "id": 1,
  "day": "Sunday, Sep. 8",
  "time": "1:00 PM ET", 
  "awayTeam": "Atlanta",
  "homeTeam": "Pittsburgh",
  "overUnder": 42.0,
  "completed": false,
  "winner": null,
  "awayScore": null,
  "homeScore": null,
  "isMNF": false
}
```

## 🔒 Security Notes

- Service account has minimal required permissions
- No sensitive data stored in frontend code
- Environment variables secure in Netlify
- CORS properly configured for your domain

## 🎯 Usage Tips

### For Players
1. Select your name from dropdown
2. Click team buttons to make picks
3. Enter tiebreaker for Monday Night Football
4. Picks auto-save as you make them
5. Green checkmark means pick was saved

### For Administrators
1. Use admin console commands for management
2. Export data regularly as backup
3. Monitor connection status indicator
4. Use debug mode for troubleshooting

## 📱 Mobile Optimization

- Touch-friendly buttons (44px minimum)
- Scrollable week selector
- Responsive layout for all screen sizes
- Prevents zoom on input focus
- Optimized for both portrait and landscape

## 🚀 Performance Features

- Lazy loading of game data
- Efficient local storage caching
- Debounced auto-save
- Optimized API calls
- Minimal external dependencies

## 📈 Future Enhancements

Potential improvements:
- [ ] Real-time NFL API integration (ESPN/Yahoo)
- [ ] Push notifications for game results
- [ ] Detailed analytics and charts
- [ ] Tournament bracket mode
- [ ] Custom scoring rules
- [ ] Email notifications
- [ ] Discord/Slack integration

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check this README first
2. Use debug mode to gather information
3. Check browser console for errors
4. Export your data before making changes
5. Create GitHub issue with:
   - Steps to reproduce
   - Browser and device info
   - Console error messages
   - Screenshot if applicable

---

**Made with ❤️ for the 12Bowl League**
