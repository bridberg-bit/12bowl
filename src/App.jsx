import React, { useState, useEffect } from 'react';
import { Trophy, Calendar, User, Target, RefreshCw, Wifi, WifiOff, Download } from 'lucide-react';

const kids = ['Brixon', 'Jace', 'Knox', 'Makena', 'Cal', 'Will'];

const NFLPickemApp = () => {
  const [currentWeek, setCurrentWeek] = useState(1);
  const [selectedKid, setSelectedKid] = useState('');
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sheetsConnected, setSheetsConnected] = useState(false);

  // Check if Google Sheets is available
  useEffect(() => {
    const checkSheetsConnection = () => {
      const hasSheetId = window.GOOGLE_SHEET_ID && window.GOOGLE_SHEET_ID !== 'YOUR_SHEET_ID_HERE';
      const hasFunctions = window.saveToGoogleSheets && window.loadFromGoogleSheets;
      setSheetsConnected(hasSheetId && hasFunctions);
    };
    
    checkSheetsConnection();
    
    // Check again after a short delay in case scripts are still loading
    setTimeout(checkSheetsConnection, 1000);
  }, []);

  // Fetch NFL games from ESPN API
  const fetchNFLGames = async (week) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const formattedGames = data.events.map(event => {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(team => team.homeAway === 'home');
        const awayTeam = competition.competitors.find(team => team.homeAway === 'away');
        
        // Format game time
        const gameDate = new Date(event.date);
        const timeString = gameDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/New_York'
        });
        
        // Check if game is completed and get winner
        const isCompleted = competition.status.type.completed;
        let winner = null;
        if (isCompleted) {
          const homeScore = parseInt(homeTeam.score);
          const awayScore = parseInt(awayTeam.score);
          if (homeScore > awayScore) {
            winner = homeTeam.team.abbreviation;
          } else if (awayScore > homeScore) {
            winner = awayTeam.team.abbreviation;
          }
        }
        
        return {
          id: event.id,
          away: awayTeam.team.abbreviation,
          home: homeTeam.team.abbreviation,
          awayTeam: awayTeam.team.displayName,
          homeTeam: homeTeam.team.displayName,
          time: timeString,
          completed: isCompleted,
          winner: winner,
          homeScore: homeTeam.score,
          awayScore: awayTeam.score,
          // Mark Monday night game as tiebreaker
          tiebreaker: gameDate.getDay() === 1 // Monday
        };
      });
      
      // Sort games by date
      formattedGames.sort((a, b) => new Date(a.time) - new Date(b.time));
      
      setGames(formattedGames);
      setLastUpdated(new Date().toLocaleTimeString());
      
      // Save to Google Sheets if available
      if (sheetsConnected && window.saveToGoogleSheets) {
        try {
          await window.saveToGoogleSheets('schedule', { week, games: formattedGames });
        } catch (err) {
          console.warn('Could not save to Google Sheets:', err);
        }
      }
      
    } catch (err) {
      console.error('Error fetching NFL games:', err);
      setError('Failed to load games. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Load picks from localStorage and Google Sheets
  const loadPicks = async (week) => {
    try {
      // Load from localStorage first
      const savedPicks = localStorage.getItem(`week${week}-picks`);
      let localPicks = {};
      if (savedPicks) {
        localPicks = JSON.parse(savedPicks);
      }
      
      // Load from Google Sheets if available
      if (sheetsConnected && window.loadFromGoogleSheets) {
        try {
          const sheetPicks = await window.loadFromGoogleSheets('picks', week);
          // Merge with local picks (Google Sheets takes precedence)
          localPicks = { ...localPicks, ...sheetPicks };
        } catch (err) {
          console.warn('Could not load from Google Sheets:', err);
        }
      }
      
      setPicks(localPicks);
    } catch (err) {
      console.error('Error loading picks:', err);
    }
  };

  // Save picks to localStorage and Google Sheets
  const savePicks = async (newPicks) => {
    try {
      // Save to localStorage
      localStorage.setItem(`week${currentWeek}-picks`, JSON.stringify(newPicks));
      
      // Save to Google Sheets if available
      if (sheetsConnected && window.saveToGoogleSheets) {
        try {
          await window.saveToGoogleSheets('picks', {
            week: currentWeek,
            picks: newPicks
          });
        } catch (err) {
          console.warn('Could not save to Google Sheets:', err);
        }
      }
      
      setPicks(newPicks);
    } catch (err) {
      console.error('Error saving picks:', err);
    }
  };

  // Calculate scores and winners
  const calculateResults = () => {
    const scores = {};
    const details = {};
    
    kids.forEach(kid => {
      scores[kid] = 0;
      details[kid] = { correct: [], incorrect: [], pending: [] };
      
      if (picks[kid]) {
        games.forEach(game => {
          const kidPick = picks[kid][game.id];
          if (kidPick) {
            if (game.completed) {
              if (kidPick === game.winner) {
                scores[kid]++;
                details[kid].correct.push(game);
              } else {
                details[kid].incorrect.push(game);
              }
            } else {
              details[kid].pending.push(game);
            }
          }
        });
      }
    });
    
    return { scores, details };
  };

  // Export data for manual Google Sheets entry
  const exportData = () => {
    const { scores } = calculateResults();
    const exportData = {
      week: currentWeek,
      timestamp: new Date().toLocaleString(),
      picks: picks,
      games: games.map(g => ({
        id: g.id,
        away: g.away,
        home: g.home,
        completed: g.completed,
        winner: g.winner,
        awayScore: g.awayScore,
        homeScore: g.homeScore
      })),
      standings: scores
    };
    
    // Create downloadable JSON file
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nfl-pickem-week-${currentWeek}.json`;
    link.click();
    
    // Also show in console for copying
    console.log('=== WEEK ' + currentWeek + ' DATA FOR GOOGLE SHEETS ===');
    console.log(dataStr);
    console.log('=== END DATA ===');
  };

  // Auto-refresh every 5 minutes during game days
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const day = now.getDay();
      // Refresh on Thu (4), Fri (5), Sat (6), Sun (0), Mon (1) during NFL season
      if ([0, 1, 4, 5, 6].includes(day)) {
        fetchNFLGames(currentWeek);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [currentWeek, sheetsConnected]);

  // Load data when week changes
  useEffect(() => {
    fetchNFLGames(currentWeek);
    loadPicks(currentWeek);
  }, [currentWeek, sheetsConnected]);

  const handlePickChange = async (gameId, team) => {
    if (!selectedKid) return;
    
    const newPicks = {
      ...picks,
      [selectedKid]: {
        ...picks[selectedKid],
        [gameId]: team
      }
    };
    
    await savePicks(newPicks);
  };

  const handleTiebreakerChange = async (score) => {
    if (!selectedKid) return;
    
    const newPicks = {
      ...picks,
      [selectedKid]: {
        ...picks[selectedKid],
        tiebreaker: score
      }
    };
    
    await savePicks(newPicks);
  };

  const submitPicks = async () => {
    if (!selectedKid) {
      alert('Please select your name first!');
      return;
    }
    
    const kidPicks = picks[selectedKid] || {};
    const gameCount = games.length;
    const picksCount = Object.keys(kidPicks).filter(key => key !== 'tiebreaker').length;
    
    if (picksCount < gameCount) {
      alert(`Please make picks for all ${gameCount} games!`);
      return;
    }
    
    const tiebreakerGame = games.find(g => g.tiebreaker);
    if (tiebreakerGame && !kidPicks.tiebreaker) {
      alert('Please enter your tiebreaker score!');
      return;
    }
    
    // Final save to ensure everything is synced
    await savePicks(picks);
    alert(`Picks submitted for ${selectedKid}! Good luck! 🏈`);
  };

  const refreshGames = () => {
    fetchNFLGames(currentWeek);
  };

  const { scores, details } = calculateResults();
  const maxScore = Math.max(...Object.values(scores));
  const winners = Object.keys(scores).filter(kid => scores[kid] === maxScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              NFL Pick'em - Week {currentWeek}
            </h1>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshGames}
                disabled={loading}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  loading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600'
                } text-white`}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              
              <button
                onClick={exportData}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              
              {sheetsConnected ? (
                <Wifi className="text-green-500 w-5 h-5" title="Google Sheets Connected" />
              ) : (
                <WifiOff className="text-orange-500 w-5 h-5" title="Local Storage Only" />
              )}
            </div>
          </div>
          
          {lastUpdated && (
            <div className="text-sm text-gray-500 mb-4 flex items-center gap-4">
              <span>Last updated: {lastUpdated}</span>
              {sheetsConnected ? (
                <span className="text-green-600">📊 Google Sheets Connected</span>
              ) : (
                <span className="text-orange-600">📱 Local Storage Only</span>
              )}
            </div>
          )}
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          
          {/* Kid Selection */}
          <div className="flex items-center gap-4">
            <User className="text-gray-500" />
            <select
              value={selectedKid}
              onChange={(e) => setSelectedKid(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your name...</option>
              {kids.map(kid => (
                <option key={kid} value={kid}>{kid}</option>
              ))}
            </select>
            {selectedKid && (
              <span className="text-green-600 font-semibold">
                Making picks for {selectedKid}!
              </span>
            )}
          </div>
        </div>

        {/* Current Standings */}
        {games.some(g => g.completed) && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Week {currentWeek} Standings
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {kids.map(kid => (
                <div 
                  key={kid} 
                  className={`border rounded-lg p-4 ${
                    winners.includes(kid) && games.some(g => g.completed) 
                      ? 'border-yellow-400 bg-yellow-50' 
                      : 'border-gray-200'
                  }`}
                >
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {kid}
                    {winners.includes(kid) && games.some(g => g.completed) && (
                      <Trophy className="w-4 h-4 text-yellow-500" />
                    )}
                  </h3>
                  <p className="text-gray-600">
                    Score: {scores[kid]} / {games.filter(g => g.completed).length}
                  </p>
                  {picks[kid]?.tiebreaker && (
                    <p className="text-sm text-gray-500">
                      Tiebreaker: {picks[kid].tiebreaker}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Games */}
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="text-gray-500 w-4 h-4" />
                  <span className="text-sm text-gray-600">{game.time}</span>
                  {game.tiebreaker && (
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                      Tiebreaker Game
                    </span>
                  )}
                </div>
                {game.completed && (
                  <div className="text-right">
                    <span className="text-green-600 font-semibold">
                      Final: {game.awayTeam} {game.awayScore} - {game.homeScore} {game.homeTeam}
                    </span>
                    {game.winner && (
                      <div className="text-sm text-gray-600">
                        Winner: {game.winner}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handlePickChange(game.id, game.away)}
                  disabled={!selectedKid || game.completed}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    picks[selectedKid]?.[game.id] === game.away
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${(!selectedKid || game.completed) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold">{game.away}</div>
                  <div className="text-sm text-gray-600">{game.awayTeam}</div>
                  <div className="text-xs text-gray-500">@ {game.home}</div>
                  {game.completed && <div className="text-lg font-bold">{game.awayScore}</div>}
                </button>
                
                <button
                  onClick={() => handlePickChange(game.id, game.home)}
                  disabled={!selectedKid || game.completed}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    picks[selectedKid]?.[game.id] === game.home
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${(!selectedKid || game.completed) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="font-semibold">{game.home}</div>
                  <div className="text-sm text-gray-600">{game.homeTeam}</div>
                  <div className="text-xs text-gray-500">vs {game.away}</div>
                  {game.completed && <div className="text-lg font-bold">{game.homeScore}</div>}
                </button>
              </div>
            </div>
          ))}
          
          {/* Tiebreaker */}
          {games.find(g => g.tiebreaker) && (
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="text-yellow-600" />
                <h3 className="font-bold text-yellow-800">Tiebreaker</h3>
              </div>
              <p className="text-yellow-700 mb-3">
                Total points scored in the tiebreaker game:
              </p>
              <input
                type="number"
                value={picks[selectedKid]?.tiebreaker || ''}
                onChange={(e) => handleTiebreakerChange(e.target.value)}
                disabled={!selectedKid}
                placeholder="Enter total points..."
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          )}
          
          {selectedKid && (
            <div className="text-center">
              <button
                onClick={submitPicks}
                className="px-8 py-3 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-colors"
              >
                Submit Picks for {selectedKid}
              </button>
            </div>
          )}
        </div>
        
        {/* Week Navigation */}
        <div className="flex justify-center mt-8 gap-4">
          <button
            onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
            disabled={currentWeek === 1}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous Week
          </button>
          <button
            onClick={() => setCurrentWeek(currentWeek + 1)}
            disabled={currentWeek === 18}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next Week
          </button>
        </div>
      </div>
    </div>
  );
};

export default NFLPickemApp;
