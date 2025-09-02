const { google } = require('googleapis');

exports.handler = async (event, context) => {
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
            hasKey: !!PRIVATE_KEY,
            method: event.httpMethod
        });

        if (!SHEET_ID || !SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY) {
            console.error('Missing environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required environment variables',
                    missing: {
                        SHEET_ID: !SHEET_ID,
                        EMAIL: !SERVICE_ACCOUNT_EMAIL,
                        KEY: !PRIVATE_KEY
                    }
                })
            };
        }

        // Parse the request
        let requestData = {};
        try {
            if (event.body) {
                requestData = JSON.parse(event.body);
            }
        } catch (e) {
            console.error('JSON parse error:', e);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }

        const { action, data } = requestData;
        console.log('Request:', { action, data });

        // Validate action
        if (!action) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing action parameter' })
            };
        }

        // Set up Google Sheets auth
        const auth = new google.auth.JWT(
            SERVICE_ACCOUNT_EMAIL,
            null,
            PRIVATE_KEY,
            ['https://www.googleapis.com/auth/spreadsheets']
        );

        const sheets = google.sheets({ version: 'v4', auth });

        // Handle different actions
        switch (action) {
            case 'getCurrentWeek':
                return await getCurrentWeek(sheets, SHEET_ID, headers);
            
            case 'savePick':
                if (!data) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing data for savePick' })
                    };
                }
                return await savePick(sheets, SHEET_ID, data, headers);
            
            case 'getGames':
                if (!data || !data.week) {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Missing week parameter for getGames' })
                    };
                }
                return await getGames(sheets, SHEET_ID, data, headers);

            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: `Unknown action: ${action}` })
                };
        }

    } catch (error) {
        console.error('Function error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                type: error.name,
                details: 'Check function logs for more details'
            })
        };
    }
};

async function getCurrentWeek(sheets, sheetId, headers) {
    try {
        console.log('Getting current week from sheet:', sheetId);
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Settings!A:B',
        });

        const rows = response.data.values || [];
        const weekRow = rows.find(row => row[0] === 'Current_Week');
        const currentWeek = weekRow ? parseInt(weekRow[1]) : 1;

        console.log('Current week found:', currentWeek);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ currentWeek })
        };
    } catch (error) {
        console.error('getCurrentWeek error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `Failed to get current week: ${error.message}` })
        };
    }
}

async function savePick(sheets, sheetId, data, headers) {
    try {
        console.log('Attempting to save pick:', data);

        const { player, week, gameId, teamPick, tiebreaker } = data;
        
        // Validate required fields
        if (!player || !week || !gameId || !teamPick) {
            const missing = [];
            if (!player) missing.push('player');
            if (!week) missing.push('week'); 
            if (!gameId) missing.push('gameId');
            if (!teamPick) missing.push('teamPick');
            
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    error: 'Missing required fields',
                    missing: missing
                })
            };
        }

        // Prepare the row data
        const values = [[
            String(player),
            String(week),
            String(gameId),
            String(teamPick),
            String(tiebreaker || ''),
            new Date().toISOString()
        ]];

        console.log('Appending to sheet - values:', values);

        // Append to Google Sheets
        const result = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Picks!A:F',
            valueInputOption: 'RAW',
            requestBody: {
                values: values
            }
        });

        console.log('Pick saved successfully, updated range:', result.data.updates?.updatedRange);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                updatedRange: result.data.updates?.updatedRange
            })
        };

    } catch (error) {
        console.error('savePick error details:', {
            message: error.message,
            code: error.code,
            status: error.status
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: `Failed to save pick: ${error.message}`,
                code: error.code
            })
        };
    }
}

async function getGames(sheets, sheetId, data, headers) {
    try {
        const { week } = data;
        console.log('Getting games for week:', week);

        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: 'Games!A:H',
        });

        const rows = response.data.values || [];
        
        if (rows.length === 0) {
            console.log('No data found in Games sheet');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ games: [] })
            };
        }

        const headerRow = rows[0];
        const dataRows = rows.slice(1);

        // Filter games for the requested week
        const weekGames = dataRows
            .filter(row => row.length > 0 && parseInt(row[0]) === parseInt(week))
            .map((row, index) => ({
                id: index + 1,
                day: row[1] || '',
                time: row[2] || '',
                awayTeam: row[3] || '',
                homeTeam: row[4] || '',
                overUnder: parseFloat(row[5]) || 0,
                completed: row[6] === 'TRUE',
                winner: row[7] || null,
                isMNF: (row[1] || '').toLowerCase().includes('monday')
            }));

        console.log(`Found ${weekGames.length} games for week ${week}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ games: weekGames })
        };

    } catch (error) {
        console.error('getGames error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: `Failed to get games: ${error.message}` })
        };
    }
}
