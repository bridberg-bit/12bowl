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
      if (game.completed && game.winner && playerPicks.games[game.id]) {
        total++;
        if (playerPicks.games[game.id] === game.winner) {
          correct++;
        }
      }
    });
    
    return {
      correct,
      total,
      percentage: total > 0 ? (correct / total) * 100 : 0
    };
  },

  /**
   * Calculate weekly scores for all players
   */
  calculateWeeklyScores: (week, games) => {
    const scores = {};
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    
    players.forEach(player => {
      const playerKey = `${player}_week${week}`;
      const playerPicks = App.picks[playerKey];
      
      if (playerPicks) {
        const accuracy = GameLogic.calculatePickAccuracy(playerPicks, games);
        scores[player] = {
          player: player,
          correct: accuracy.correct,
          total: accuracy.total,
          percentage: accuracy.percentage,
          tiebreaker: playerPicks.tiebreaker || null
        };
      } else {
        scores[player] = {
          player: player,
          correct: 0,
          total: games.filter(g => g.completed).length,
          percentage: 0,
          tiebreaker: null
        };
      }
    });
    
    return scores;
  },

  /**
   * Determine weekly winner based on picks and tiebreaker
   */
  determineWeeklyWinner: (weeklyScores, mnfGame) => {
    const players = Object.values(weeklyScores);
    
    // Sort by correct picks (descending)
    players.sort((a, b) => b.correct - a.correct);
    
    const topScore = players[0].correct;
    const winners = players.filter(p => p.correct === topScore);
    
    // If tie, use tiebreaker (closest to MNF total points)
    if (winners.length > 1 && mnfGame && mnfGame.completed) {
      const mnfTotal = GameData.calculateTotalPoints(mnfGame);
      
      if (mnfTotal !== null) {
        winners.forEach(player => {
          if (player.tiebreaker) {
            player.tiebreakerDiff = Math.abs(player.tiebreaker - mnfTotal);
          } else {
            player.tiebreakerDiff = 999; // Large number for no tiebreaker
          }
        });
        
        // Sort by tiebreaker difference (ascending)
        winners.sort((a, b) => a.tiebreakerDiff - b.tiebreakerDiff);
        
        return {
          winner: winners[0],
          isTiebreaker: true,
          mnfTotal: mnfTotal,
          tiedPlayers: winners.length
        };
      }
    }
    
    return {
      winner: winners[0],
      isTiebreaker: false,
      tiedPlayers: winners.length
    };
  },

  /**
   * Get season statistics for all players
   */
  getSeasonStats: () => {
    const stats = {};
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    
    players.forEach(player => {
      stats[player] = {
        player: player,
        totalCorrect: 0,
        totalPossible: 0,
        weeklyWins: 0,
        bestWeek: { week: 0, correct: 0, total: 0 },
        worstWeek: { week: 0, correct: 999, total: 0 },
        averageAccuracy: 0
      };
    });
    
    // Calculate stats for each completed week
    for (let week = 1; week <= App.currentWeek; week++) {
      const games = GameData.getSampleGames(week);
      const completedGames = games.filter(g => g.completed);
      
      if (completedGames.length === 0) continue;
      
      const weeklyScores = GameLogic.calculateWeeklyScores(week, games);
      const weekWinner = GameLogic.determineWeeklyWinner(weeklyScores, 
        games.find(g => g.isMNF));
      
      players.forEach(player => {
        const playerScore = weeklyScores[player];
        if (playerScore && playerScore.total > 0) {
          const stat = stats[player];
          
          // Update totals
          stat.totalCorrect += playerScore.correct;
          stat.totalPossible += playerScore.total;
          
          // Check if weekly winner
          if (weekWinner.winner.player === player) {
            stat.weeklyWins++;
          }
          
          // Update best/worst weeks
          if (playerScore.correct > stat.bestWeek.correct) {
            stat.bestWeek = { week, correct: playerScore.correct, total: playerScore.total };
          }
          
          if (playerScore.correct < stat.worstWeek.correct) {
            stat.worstWeek = { week, correct: playerScore.correct, total: playerScore.total };
          }
        }
      });
    }
    
    // Calculate average accuracy
    players.forEach(player => {
      const stat = stats[player];
      stat.averageAccuracy = stat.totalPossible > 0 
        ? (stat.totalCorrect / stat.totalPossible) * 100 
        : 0;
    });
    
    return stats;
  },

  /**
   * Get remaining games for current week
   */
  getRemainingGames: (games) => {
    return games.filter(game => !game.completed);
  },

  /**
   * Get completed games for current week
   */
  getCompletedGames: (games) => {
    return games.filter(game => game.completed);
  },

  /**
   * Check if player has made all picks for the week
   */
  hasCompletePicks: (player, week, games) => {
    const playerKey = `${player}_week${week}`;
    const playerPicks = App.picks[playerKey];
    
    if (!playerPicks || !playerPicks.games) {
      return false;
    }
    
    const availableGames = games.filter(g => !g.completed);
    const requiredPicks = availableGames.length;
    const madePicks = Object.keys(playerPicks.games).length;
    
    return madePicks >= requiredPicks;
  },

  /**
   * Get pick deadline for current week
   */
  getPickDeadline: (games) => {
    if (!games || games.length === 0) return null;
    
    // Find earliest game that's not completed
    const upcomingGames = games.filter(g => !g.completed);
    if (upcomingGames.length === 0) return null;
    
    // For now, return a placeholder - in real app this would parse actual dates/times
    return {
      game: upcomingGames[0],
      deadline: `${upcomingGames[0].day} at ${upcomingGames[0].time}`,
      hasDeadlinePassed: false
    };
  },

  /**
   * Validate pick submission
   */
  validatePick: (gameId, teamPick, games) => {
    const game = games.find(g => g.id == gameId);
    
    if (!game) {
      return { valid: false, error: 'Game not found' };
    }
    
    if (game.completed) {
      return { valid: false, error: 'Cannot pick completed games' };
    }
    
    if (teamPick !== game.awayTeam && teamPick !== game.homeTeam) {
      return { valid: false, error: 'Invalid team selection' };
    }
    
    // Check deadline (placeholder - would use real time logic)
    const deadline = GameLogic.getPickDeadline(games);
    if (deadline && deadline.hasDeadlinePassed) {
      return { valid: false, error: 'Pick deadline has passed' };
    }
    
    return { valid: true };
  },

  /**
   * Generate leaderboard for current standings
   */
  generateLeaderboard: () => {
    const seasonStats = GameLogic.getSeasonStats();
    const players = Object.values(seasonStats);
    
    // Sort by weekly wins first, then by total accuracy
    players.sort((a, b) => {
      if (b.weeklyWins !== a.weeklyWins) {
        return b.weeklyWins - a.weeklyWins;
      }
      return b.averageAccuracy - a.averageAccuracy;
    });
    
    return players.map((player, index) => ({
      rank: index + 1,
      ...player,
      isLeader: index === 0
    }));
  },

  /**
   * Get player's pick for a specific game
   */
  getPlayerPick: (player, week, gameId) => {
    const playerKey = `${player}_week${week}`;
    const playerPicks = App.picks[playerKey];
    
    return playerPicks?.games?.[gameId] || null;
  },

  /**
   * Check if all players have submitted picks
   */
  allPlayersSubmitted: (week, games) => {
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    
    return players.every(player => 
      GameLogic.hasCompletePicks(player, week, games)
    );
  },

  /**
   * Get pick distribution for a game (how many picked each team)
   */
  getPickDistribution: (gameId, week) => {
    const players = App.players.length > 0 ? App.players : Config.APP.PLAYERS;
    const distribution = {
      awayTeam: { count: 0, players: [] },
      homeTeam: { count: 0, players: [] },
      noPick: { count: 0, players: [] }
    };
    
    const game = App.games.find(g => g.id == gameId);
    if (!game) return distribution;
    
    players.forEach(player => {
      const pick = GameLogic.getPlayerPick(player, week, gameId);
      
      if (pick === game.awayTeam) {
        distribution.awayTeam.count++;
        distribution.awayTeam.players.push(player);
      } else if (pick === game.homeTeam) {
        distribution.homeTeam.count++;
        distribution.homeTeam.players.push(player);
      } else {
        distribution.noPick.count++;
        distribution.noPick.players.push(player);
      }
    });
    
    return distribution;
  }
};

// Log game module load
Logger.info('Game module loaded');
