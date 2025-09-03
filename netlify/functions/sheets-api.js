const { google } = require('googleapis');

exports.handler = async (event, context) => {
    console.log('Function called with method:', event.httpMethod);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Get environment variables
        const SHEET_ID = process.env.SHEET_ID;
        const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

        console.log('Environment check:', {
            hasSheetId: !!SHEET_ID,
            hasEmail: !!SERVICE_ACCOUNT_EMAIL,
            hasKey: !!PRIVATE_KEY
        });

        if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing environment variables',
                    details: 'Please check SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY'
                })
            };
        }

        // Parse request
        let requestData = {};
        if (event.body) {
            try {
                requestData = JSON.parse(event.body);
            } catch (e) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Invalid JSON' })
                };
            }
        }

        const { action, data } = requestData;
        console.log('Processing action:', action);

        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing action parameter' })
            };
        }

        // Setup Google Sheets
        const auth = new google.auth.JWT(
            SERVICE_ACCOUNT_EMAIL,
            null,
            PRIVATE_KEY,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });

        // Route actions
        let result;
        switch (action) {
            case 'getCurrentWeek':
                result = await getCurrentWeek(sheets, SHEET_ID);
                break;
                
            case 'getPlayers':
                result = await getPlayers(sheets, SHEET_ID);
                break;
                
            case 'savePick':
                result = await savePick(sheets, SHEET_ID, data);
                break;
                
            case 'getGames':
                result = await getGames(sheets, SHEET_ID, data);
                break;
                
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Unknown action: ${action}` })
                };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message
            })
        };
    }
};

// Get current week
async function getCurrentWeek(sheets, sheetId) {
    try {
        console.log('Getting current week');
        return { currentWeek: 1, success: true };
    } catch (error) {
        console.error('getCurrentWeek error:', error);
        return { currentWeek: 1, success: false, error: error.message };
    }
}

// Get players from Standings sheet
async function getPlayers(sheets, sheetId) {
    try {
        console.log('Getting players from Standings sheet');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Standings!A:A'
        });

        const rows = response.data.values || [];
        console.log('Raw sheet data:', rows);
        
        // Skip header and get player names
        const players = rows
            .slice(1) // Skip header row
            .filter(row => row && row[0] && row[0].trim())
            .map(row => row[0].trim());

        console.log('Processed players:', players);

        // If no players found, return defaults
        if (players.length === 0) {
            console.log('No players found, using defaults');
            return { 
                players: ['Brixon', 'Knox', 'Makena', 'Cal', 'Will', 'Jace'],
                success: false,
                fallback: true
            };
        }

        return { 
            players: players,
            success: true
        };

    } catch (error) {
        console.error('getPlayers error:', error);
        return { 
            players: ['Brixon', 'Knox', 'Makena', 'Cal', 'Will', 'Jace'],
            success: false,
            error: error.message,
            fallback: true
        };
    }
}

// Save pick to Picks sheet
async function savePick(sheets, sheetId, data) {
    try {
        console.log('Saving pick:', data);

        const { player, week, gameId, teamPick, tiebreaker } = data;
        
        if (!player || !week || !gameId || !teamPick) {
            return {
                success: false,
                error: 'Missing required fields: player, week, gameId, teamPick'
            };
        }

        // Try to get existing picks first
        const playerWeekKey = `${player}_Week${week}`;
        
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Picks!A:Z'
            });

            const rows = response.data.values || [];
            let existingRowIndex = -1;
            let existingRow = null;

            // Find existing row for this player/week
            for (let i = 1; i < rows.length; i++) {
                if (rows[i][0] === playerWeekKey) {
                    existingRowIndex = i;
                    existingRow = [...rows[i]];
                    break;
                }
            }

            let rowData;
            const timestamp = new Date().toISOString();

            if (existingRow) {
                // Update existing row
                console.log('Updating existing row');
                rowData = existingRow;
                
                // Ensure row has enough columns
                while (rowData.length < 26) {
                    rowData.push('');
                }
                
                // Update specific game pick (games start at column C, index 2)
                const gameIndex = parseInt(gameId);
                const gameColumn = 2 + gameIndex - 1; // Game1 = index 2, Game2 = index 3, etc.
                
                if (gameColumn < 26) {
                    rowData[gameColumn] = teamPick;
                }
                
                // Update tiebreaker and timestamp
                if (tiebreaker) {
                    rowData[24] = tiebreaker.toString(); // Column Y
                }
                rowData[25] = timestamp; // Column Z

                const updateRange = `Picks!A${existingRowIndex + 1}:Z${existingRowIndex + 1}`;
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: updateRange,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [rowData]
                    }
                });

                console.log('Updated existing row');

            } else {
                // Create new row
                console.log('Creating new row');
                rowData = [playerWeekKey, player]; // Columns A, B
                
                // Add empty game columns (C-V = indices 2-21)
                for (let i = 0; i < 20; i++) {
                    rowData.push('');
                }
                
                // Set specific game pick
                const gameIndex = parseInt(gameId);
                const gameColumn = 2 + gameIndex - 1;
                
                if (gameColumn < 22) {
                    rowData[gameColumn] = teamPick;
                }
                
                // Add reserved columns, tiebreaker, timestamp
                rowData.push(''); // W - Reserved1
                rowData.push(''); // X - Reserved2
                rowData.push(tiebreaker ? tiebreaker.toString() : ''); // Y - Tiebreaker
                rowData.push(timestamp); // Z - LastUpdated

                await sheets.spreadsheets.values.append({
                    spreadsheetId: sheetId,
                    range: 'Picks!A:Z',
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [rowData]
                    }
                });

                console.log('Created new row');
            }

            return { 
                success: true,
                method: existingRow ? 'updated' : 'created',
                timestamp: timestamp
            };

        } catch (sheetError) {
            console.error('Sheet access error:', sheetError);
            
            // Try to create basic structure and retry
            try {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: 'Picks!A1:Z1',
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [['PlayerWeek', 'Player', 'Game1', 'Game2', 'Game3', 'Game4', 'Game5', 
                                'Game6', 'Game7', 'Game8', 'Game9', 'Game10', 'Game11', 'Game12',
                                'Game13', 'Game14', 'Game15', 'Game16', 'Game17', 'Game18', 'Game19', 'Game20',
                                'Reserved1', 'Reserved2', 'Tiebreaker', 'LastUpdated']]
                    }
                });
                console.log('Created sheet headers');
                
                // Retry save
                return await savePick(sheets, sheetId, data);
                
            } catch (retryError) {
                console.error('Retry failed:', retryError);
                throw retryError;
            }
        }

    } catch (error) {
        console.error('savePick error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Get games (placeholder)
async function getGames(sheets, sheetId, data) {
    try {
        console.log('Getting games for week:', data.week);
        
        // Return empty for now - you can enhance this later
        return { 
            games: [],
            success: true,
            week: data.week
        };
        
    } catch (error) {
        console.error('getGames error:', error);
        return { 
            games: [],
            success: false,
            error: error.message
        };
    }
}
