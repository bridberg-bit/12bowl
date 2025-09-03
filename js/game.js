/**
 * 12Bowl NFL Pick'em App - Game Module
 * Handles game data, logic, and calculations
 */

window.GameData = {
  /**
   * Get sample games for a specific week
   */
  getSampleGames: (week) => {
    return Config.SAMPLE_GAMES[week] || [];
  },

  /**
   * Generate more comprehensive sample data for additional weeks
   */
  generateSampleWeek: (week) => {
    const teams = Object.keys(Config.NFL_TEAMS);
    const days = ['Sunday', 'Monday', 'Thursday'];
    const times = ['1:00 PM ET', '4:25 PM ET', '8:20 PM ET'];
    
    const games = [];
    let gameId = week * 100; // Unique ID generation
    
    // Generate 15-16 games per week (typical NFL schedule)
    for (let i = 0; i < 15; i++) {
      const awayTeam = teams[Math.floor(Math.random() * teams.length)];
      let homeTeam = teams[Math.floor(Math.random() * teams.length)];
      
      // Ensure different teams
      while (homeTeam === awayTeam) {
        homeTeam = teams[Math.floor(Math.random() * teams.length)];
      }
      
      const day = i === 14 ? 'Monday' : (i === 0 ? 'Thursday' : 'Sunday');
      const time = day === 'Monday' ? '8:15 PM ET' : times[Math.floor(Math.random() * times.length)];
      
      games.push({
        id: gameId + i,
        day: `${day}, ${GameData._getDateString(week, day)}`,
        time: time,
        awayTeam: awayTeam,
        homeTeam: homeTeam,
        overUnder: Math.round((Math.random() * 20 + 35) * 2) / 2, // 35-55 range, .5 increments
        completed: false,
        awayScore: null,
        homeScore: null,
        winner: null,
        isMNF: day === 'Monday'
      });
    }
    
    return games;
  },

  /**
   * Get date string for a given week and day
   */
  _getDateString: (week, day) => {
    const seasonStart = new Date(2024, 8, 5); // September 5, 2024 (Thursday)
    const weekStart = new Date(seasonStart.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
    
    const dayOffset = {
      'Thursday': 0,
      'Sunday': 3,
      'Monday': 4
    };
    
    const gameDate = new Date(weekStart.getTime() + (dayOffset[day] || 0) * 24 * 60 * 60 * 1000);
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${months[gameDate.getMonth()]}. ${gameDate.getDate()}`;
  },

  /**
   * Simulate game results for testing
   */
  simulateGameResults: (games) => {
    return games.map(game => {
      if (game.completed) return game;
      
      // Generate realistic scores
      const awayScore = Math.floor(Math.random() * 28) + 7; // 7-35
      const homeScore = Math.floor(Math.random() * 28) + 7; // 7-35
      
      return {
        ...game,
        completed: true,
        awayScore: awayScore,
        homeScore: homeScore,
        winner: awayScore > homeScore ? game.awayTeam : game.homeTeam
      };
    });
  },

  /**
   * Check if a team name is valid
   */
  isValidTeam: (teamName) => {
    return Config.NFL_TEAMS.hasOwnProperty(teamName);
  },

  /**
   * Get team abbreviation
   */
  getTeamAbbreviation: (teamName) => {
    return Config.NFL_TEAMS[teamName] || teamName;
  },

  /**
   * Calculate total points for a game
   */
  calculateTotalPoints: (game) => {
    if (!game.completed || game.awayScore === null || game.homeScore === null) {
      return null;
    }
    return game.awayScore + game.homeScore;
  },

  /**
   * Check if game went over/under the line
   */
  checkOverUnder: (game) => {
    const total = GameData.calculateTotalPoints(game);
    if (total === null) return null;
    
    return total > game.overUnder ? 'over' : 'under';
  }
};

window.GameLogic = {
  /**
   * Calculate pick accuracy for a player
   */
  calculatePickAccuracy: (playerPicks, games) => {
    let correct = 0;
    let total = 0;
    
    games.forEach(game => {
      if (game.completed && game.winner &&
