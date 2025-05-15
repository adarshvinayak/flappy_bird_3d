import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const supabaseUrl = process.env.SUPABASEURL;
const supabaseKey = process.env.SUPABASEKEY;

if (!supabaseKey) {
    console.error("Supabase key is not defined!");
} else {
    console.log("Supabase key loaded successfully!");
}

export const supabase = createClient(supabaseUrl, supabaseKey)
console.error('supabase connected')
export async function logScore(difficulty, name, score) {
    try {
        const tableName = difficulty === 'easy' ? 'Scores - Easy' : 'Scores - Hard'
        console.log(`Attempting to log score to ${tableName}:`, { name, score });
        
        const { data, error } = await supabase
            .from(tableName)
            .insert([
                { 
                    name: name || 'unknown',
                    score: score
                }
            ])
            .select()
        
        if (error) {
            console.error('Error logging score:', error)
            console.error('Error details:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint
            })
            return false
        }
        
        console.log('Score logged successfully:', data)
        return true
    } catch (error) {
        console.error('Unexpected error in logScore:', error)
        return false
    }
}

export async function getLeaderboard() {
    const [easyScores, hardScores] = await Promise.all([
        supabase
            .from('Scores - Easy')
            .select('*')
            .order('score', { ascending: false })
            .limit(10),
        supabase
            .from('Scores - Hard')
            .select('*')
            .order('score', { ascending: false })
            .limit(10)
    ])

    return {
        easy: easyScores.data || [],
        hard: hardScores.data || []
    }
}

async function testDatabaseConnection() {
    try {
        console.log('Testing database connection...');
        
        // Test writing to database
        console.log('Testing database write...');
        const testScore = {
            name: 'Test Player',
            score: 999,
            created_at: new Date().toISOString()
        };

        // Test Easy scores table
        const { data: easyData, error: easyError } = await supabase
            .from('Scores - Easy')
            .insert([testScore])
            .select();

        if (easyError) {
            console.error('Error writing to Easy scores:', easyError);
            return false;
        }
        console.log('Successfully wrote to Easy scores:', easyData);

        // Test Hard scores table
        const { data: hardData, error: hardError } = await supabase
            .from('Scores - Hard')
            .insert([testScore])
            .select();

        if (hardError) {
            console.error('Error writing to Hard scores:', hardError);
            return false;
        }
        console.log('Successfully wrote to Hard scores:', hardData);

        // Test reading from database
        console.log('Testing database read...');
        const { data: easyScores, error: easyReadError } = await supabase
            .from('Scores - Easy')
            .select('*')
            .order('score', { ascending: false })
            .limit(5);

        if (easyReadError) {
            console.error('Error reading Easy scores:', easyReadError);
            return false;
        }
        console.log('Successfully read Easy scores:', easyScores);

        const { data: hardScores, error: hardReadError } = await supabase
            .from('Scores - Hard')
            .select('*')
            .order('score', { ascending: false })
            .limit(5);

        if (hardReadError) {
            console.error('Error reading Hard scores:', hardReadError);
            return false;
        }
        console.log('Successfully read Hard scores:', hardScores);

        return true;
    } catch (error) {
        console.error('Database test failed:', error);
        return false;
    }
}
