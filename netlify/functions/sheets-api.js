const { google } = require('googleapis');

// Helper function for logging
function log(message, data = null) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`, data || '');
}

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Max-Age': '86400'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        log('Handling CORS preflight request');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    log(`Incoming request: ${event.httpMethod} from ${event.headers.origin || 'unknown'}`);

    try {
        // Validate environment variables
        const SHEET_ID = process.env.SHEET_ID;
        const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

        log('Environment check:', {
            hasSheetId: !!SHEET_ID,
            hasEmail: !!SERVICE_ACCOUNT_EMAIL,
            hasKey: !!PRIVATE_KEY && PRIVATE_KEY.length > 100,
            sheetIdLength: SHEET_ID ? SHEET_ID.length : 0,
            method: event.httpMethod
        });

        if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
            const missing = [];
            if (!SHEET_ID) missing.push('SHEET_ID');
            if (!SERVICE_ACCOUNT_EMAIL) missing.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
            if (!PRIVATE_KEY) missing.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
            
            log('Missing environment variables:', missing);
            
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Server configuration error',
                    message: 'Missing required environment variables',
                    missing: missing,
                    debug: {
                        hasSheetId: !!SHEET_ID,
                        hasEmail: !!SERVICE_ACCOUNT_EMAIL,
                        hasKey: !!PRIVATE_KEY
                    }
                })
            };
        }

        // Parse the request body
        let requestData = {};
        if (event.body) {
            try {
                requestData = JSON.parse(event.body);
                log('Request data parsed:', { action: requestData.action, hasData: !!requestData.data });
            } catch (parseError) {
                log('JSON parse error:', parseError.message);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid JSON in request body',
                        message: parseError.message 
                    })
                };
            }
        }

        const { action, data } = requestData;

        // Validate action parameter
        if (!action) {
            log('Missing action parameter');
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing action parameter',
                    availableActions: ['getCurrentWeek', 'savePick', 'getGames', 'getPicks', 'getStandings']
                })
            };
        }

        log(`Processing action: ${action}`);

        // Initialize Google Sheets API
        let sheets;
        try {
            const auth = new google.auth.JWT(
                SERVICE_ACCOUNT_EMAIL,
                null,
                PRIVATE_KEY,
                ['https://www.googleapis.com/auth/spreadsheets']
            );

            // Test authentication
            await auth.authorize();
            log('Google API authentication successful');

            sheets = google.sheets({ version: 'v4', auth });
        } catch (authError) {
            log('Google API authentication failed:', authError.message);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'Authentication failed',
                    message: 'Unable to authenticate with Google Sheets API',
                    details: authError.message
                })
            };
        }

        // Route to appropriate handler
        let result;
        switch (action) {
            case 'getCurrentWeek':
                result = await getCurrentWeek(sheets, SHEET_ID);
                break;
            
            case 'savePick':
                if (!data) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing data for savePick' })
                    };
                }
                result = await savePick(sheets, SHEET_ID, data);
                break;
            
            case 'getGames':
                if (!data || !data.week) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing week parameter for getGames' })
                    };
                }
                result = await getGames(sheets, SHEET_ID, data);
                break;

            case 'getPicks':
                if (!data || !data.player || !data.week) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing player or week parameter for getPicks' })
                    };
                }
                result = await getPicks(sheets, SHEET_ID, data);
                break;

            case 'getStandings':
                result = await getStandings(sheets, SHEET_ID, data);
                break;

            default:
                log(`Unknown action: ${action}`);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: `Unknown action: ${action}`,
                        availableActions: ['getCurrentWeek', 'savePick', 'getGames', 'getPicks', 'getStandings']
                    })
                };
        }

        log(`Action ${action} completed successfully`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        log('Function error:', {
            message: error.message,
            name: error.name,
            stack: error.stack?.split('\n')[0],
            code: error.code
        });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message,
                type: error.name,
                timestamp: new Date().toISOString()
            })
        };
    }
};

async function getCurrentWeek(sheets, sheetId) {
    try {
        log('Getting current week from sheet:', sheetId);
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Settings!A:B',
        });

        const rows = response.data.values || [];
        log(`Found ${rows.length} rows in Settings sheet`);

        const weekRow = rows.find(row => row[0] === 'Current_Week');
        const currentWeek = weekRow ? parseInt(weekRow[1]) : 1;

        log(`Current week determined: ${currentWeek}`);

        return { currentWeek, success: true };

    } catch (error) {
        log('getCurrentWeek error:', error.message);
        
        // Return a default week if sheet access fails
        return { 
            currentWeek: 1, 
            success: false, 
            error: error.message,
            fallback: true
        };
    }
}

async function savePick(sheets, sheetId, data) {
    try {
        log('Saving pick:', data);

        const { player, week, gameId, teamPick, tiebreaker } = data;
        
        // Validate required fields
        const requiredFields = ['player', 'week', 'gameId', 'teamPick'];
        const missingFields = requiredFields.filter(field => !data[field]);
        
        if (missingFields.length > 0) {
            log('Missing required fields:', missingFields);
            return {
                success: false,
                error: 'Missing required fields',
                missing: missingFields
            };
        }

        // Prepare the row data
        const timestamp = new Date().toISOString();
        const values = [[
            String(player),
            String(week),
            String(gameId),
            String(teamPick),
            String(tiebreaker || ''),
            timestamp
        ]];

        log('Appending to Picks sheet with values:', values[0]);

        // First, try to create the sheet structure if it doesn't exist
        try {
            await ensureSheetStructure(sheets, sheetId);
        } catch (structureError) {
            log('Sheet structure check failed (continuing anyway):', structureError.message);
        }

        // Append to Google Sheets
        const result = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Picks!A:F',
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: {
                values: values
            }
        });

        log('Pick saved successfully:', {
            updatedRange: result.data.updates?.updatedRange,
            updatedRows: result.data.updates?.updatedRows
        });
        
        return { 
            success: true,
            updatedRange: result.data.updates?.updatedRange,
            timestamp: timestamp
        };

    } catch (error) {
        log('savePick error:', {
            message: error.message,
            code: error.code,
            status: error.status
        });
        
        return {
            success: false,
            error: `Failed to save pick: ${error.message}`,
            code: error.code,
            retryable: error.code !== 404 // Can retry unless sheet not found
        };
    }
}

async function getGames(sheets, sheetId, data) {
    try {
        const { week } = data;
        log(`Getting games for week: ${week}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Games!A:I', // Expanded to include more columns
        });

        const rows = response.data.values || [];
        log(`Found ${rows.length} rows in Games sheet`);
        
        if (rows.length === 0) {
            log('No data found in Games sheet');
            return { games: [], success: true };
        }

        const headerRow = rows[0];
        const dataRows = rows.slice(1);
        
        log('Games sheet headers:', headerRow);

        // Filter games for the requested week and transform data
        const weekGames = dataRows
            .filter(row => row.length > 0 && parseInt(row[0]) === parseInt(week))
            .map((row, index) => {
                const game = {
                    id: `${week}_${index + 1}`, // Generate consistent ID
                    week: parseInt(row[0]) || week,
                    day: row[1] || '',
                    time: row[2] || '',
                    awayTeam: row[3] || '',
                    homeTeam: row[4] || '',
                    overUnder: parseFloat(row[5]) || 0,
                    completed: (row[6] || '').toString().toLowerCase() === 'true',
                    winner: row[7] || null,
                    awayScore: row[8] ? parseInt(row[8]) : null,
                    homeScore: row[9] ? parseInt(row[9]) : null
                };
                
                // Determine if it's Monday Night Football
                game.isMNF = game.day.toLowerCase().includes('monday');
                
                return game;
            });

        log(`Returning ${weekGames.length} games for week ${week}`);

        return { 
            games: weekGames, 
            success: true,
            week: parseInt(week),
            count: weekGames.length
        };

    } catch (error) {
        log('getGames error:', error.message);
        return { 
            games: [], 
            success: false, 
            error: error.message,
            week: parseInt(data.week)
        };
    }
}

async function getPicks(sheets, sheetId, data) {
    try {
        const { player, week } = data;
        log(`Getting picks for player: ${player}, week: ${week}`);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Picks!A:F',
        });

        const rows = response.data.values || [];
        
        // Filter picks for the requested player and week
        const playerPicks = rows
            .slice(1) // Skip header
            .filter(row => row[0] === player && row[1] === String(week))
            .map(row => ({
                player: row[0],
                week: parseInt(row[1]),
                gameId: row[2],
                teamPick: row[3],
                tiebreaker: row[4] ? parseInt(row[4]) : null,
                timestamp: row[5]
            }));

        log(`Found ${playerPicks.length} picks`);

        return { 
            picks: playerPicks, 
            success: true,
            player: player,
            week: parseInt(week)
        };

    } catch (error) {
        log('getPicks error:', error.message);
        return { 
            picks: [], 
            success: false, 
            error: error.message 
        };
    }
}

async function getStandings(sheets, sheetId, data) {
    try {
        log('Getting standings data');

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Standings!A:C',
        });

        const rows = response.data.values || [];
        
        const standings = rows
            .slice(1) // Skip header
            .map(row => ({
                player: row[0],
                wins: parseInt(row[1]) || 0,
                totalGames: parseInt(row[2]) || 0,
                percentage: row[2] ? (parseInt(row[1]) / parseInt(row[2])).toFixed(3) : '0.000'
            }))
            .sort((a, b) => b.wins - a.wins); // Sort by wins descending

        log(`Returning standings for ${standings.length} players`);

        return { 
            standings: standings, 
            success: true,
            lastUpdated: new Date().toISOString()
        };

    } catch (error) {
        log('getStandings error:', error.message);
        return { 
            standings: [], 
            success: false, 
            error: error.message 
        };
    }
}

async function ensureSheetStructure(sheets, sheetId) {
    try {
        // Check if required sheets exist and create headers if needed
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId
        });

        const sheetNames = spreadsheet.data.sheets.map(sheet => sheet.properties.title);
        log('Existing sheets:', sheetNames);

        // Ensure Picks sheet has proper headers
        if (sheetNames.includes('Picks')) {
            try {
                const picksResponse = await sheets.spreadsheets.values.get({
                    spreadsheetId: sheetId,
                    range: 'Picks!A1:F1',
                });

                if (!picksResponse.data.values || picksResponse.data.values.length === 0) {
                    // Add headers to Picks sheet
                    await sheets.spreadsheets.values.update({
                        spreadsheetId: sheetId,
                        range: 'Picks!A1:F1',
                        valueInputOption: 'RAW',
                        requestBody: {
                            values: [['Player', 'Week', 'GameID', 'Pick', 'Tiebreaker', 'Timestamp']]
                        }
                    });
                    log('Added headers to Picks sheet');
                }
            } catch (headerError) {
                log('Could not check/add Picks headers:', headerError.message);
            }
        }

        return true;
    } catch (error) {
        log('ensureSheetStructure error:', error.message);
        throw error;
    }
}

// Health check endpoint
exports.healthCheck = async (event, context) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.1',
            environment: {
                hasSheetId: !!process.env.SHEET_ID,
                hasServiceAccount: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                hasPrivateKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
            }
        })
    };
};
