import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Agent, request } from 'undici'; // Use low-level request

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = __dirname;
const COMMENTS_FILE = path.join(PROJECT_ROOT, 'src', 'comments.json');
const FEEDBACK_FILE = path.join(PROJECT_ROOT, 'src', 'feedback.json');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Lightweight health check for Ollama
app.get('/api/health', async (req, res) => {
    try {
        const { statusCode } = await request('http://127.0.0.1:11434/api/tags', {
            method: 'GET',
            dispatcher: ollamaAgent,
            headersTimeout: 5000,
            connectTimeout: 2000
        });
        res.json({ online: statusCode === 200 });
    } catch (e) {
        res.json({ online: false, error: e.message });
    }
});

// Vision-based chat for schematic interpretation
app.post('/api/vision-chat', async (req, res) => {
    const { prompt, images } = req.body;
    try {
        const { body } = await request('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            dispatcher: ollamaAgent,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'moondream',
                prompt: prompt,
                images: images, // Array of base64 strings
                stream: false
            })
        });

        const data = await body.json();
        res.json({ response: data.response });
    } catch (e) {
        console.error('Vision API Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Endpoint to list CSV/ODS files
app.get('/api/files', (req, res) => {
    fs.readdir(PROJECT_ROOT, (err, files) => {
        if (err) {
            console.error('Directory read error:', err);
            return res.status(500).json({ error: 'Cannot read directory', details: err.message });
        }

        const mepFiles = files.filter(f => {
            const lowerF = f.toLowerCase();
            return lowerF.endsWith('.csv') || lowerF.endsWith('.ods');
        });
        // Sort: CSVs first, then ODS
        mepFiles.sort((a, b) => {
            if (a.toLowerCase().endsWith('.csv') && !b.toLowerCase().endsWith('.csv')) return -1;
            if (!a.toLowerCase().endsWith('.csv') && b.toLowerCase().endsWith('.csv')) return 1;
            return a.localeCompare(b);
        });
        console.log(`Found MEP files: ${mepFiles}`);
        res.json(mepFiles);
    });
});

// Endpoint to run the audit
app.post('/api/run-audit', (req, res) => {
    const { fileName, jobRef, fileContent } = req.body;

    if (!fileName || !jobRef) {
        return res.status(400).json({ error: 'Missing filename or job reference' });
    }

    const scriptPath = path.join(PROJECT_ROOT, 'mep_validator_agent_v2.py');
    let filePath = path.join(PROJECT_ROOT, fileName);

    // If file content is provided, save it as a new file on the server first
    if (fileContent) {
        try {
            fs.writeFileSync(filePath, fileContent);
            console.log(`Saved uploaded file to: ${filePath}`);
        } catch (err) {
            console.error('Failed to save uploaded file:', err);
            return res.status(500).json({ error: 'Failed to save uploaded file' });
        }
    }

    // Command to run the python script
    const command = `python3 "${scriptPath}" --file "${filePath}" --job "${jobRef}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error: ${error.message}`);
            return res.status(500).json({ error: 'Audit execution failed', details: stderr });
        }

        // Parse the output to find the new JSON path
        const jsonMatch = stdout.match(/- (.+\.json)/);
        if (jsonMatch && jsonMatch[1]) {
            const jsonPath = jsonMatch[1];
            // Read the newly created JSON file
            fs.readFile(jsonPath, 'utf8', (err, data) => {
                if (err) return res.status(500).json({ error: 'Cannot read result file' });
                res.json(JSON.parse(data));
            });
        } else {
            res.status(500).json({ error: 'Could not locate result JSON in script output' });
        }
    });
});

// Endpoint for Ollama LLM integration
// Endpoint to capture user feedback on AI insights
app.post('/api/feedback', (req, res) => {
    const { query, response, isUseful } = req.body;

    try {
        let feedback = [];
        if (fs.existsSync(FEEDBACK_FILE)) {
            feedback = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
        }

        feedback.push({
            query,
            response,
            status: isUseful ? 'useful' : 'not_useful',
            date: new Date().toISOString()
        });

        fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
        res.json({ success: true });
    } catch (err) {
        console.error('Feedback error:', err);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
});

// Endpoint to fetch all feedback (for admin stats)
app.get('/api/feedback', (req, res) => {
    if (!fs.existsSync(FEEDBACK_FILE)) return res.json([]);
    try {
        const data = fs.readFileSync(FEEDBACK_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read feedback' });
    }
});

// Endpoint to list regulatory manuals
app.get('/api/admin/manuals', (req, res) => {
    const manualsDir = path.join(PROJECT_ROOT, 'manuals');
    if (!fs.existsSync(manualsDir)) return res.json([]);

    fs.readdir(manualsDir, (err, files) => {
        if (err) return res.status(500).json({ error: 'Failed to read manuals directory' });
        const pdfs = files.filter(f => f.toLowerCase().endsWith('.pdf'));
        res.json(pdfs);
    });
});

// Endpoint to trigger RAG re-indexing
app.post('/api/admin/reindex', (req, res) => {
    console.log('RAG Re-indexing Triggered');
    const cmd = `python3 ingest_manuals.py`;

    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout, stderr) => {
        if (error) {
            console.error('Re-index Error:', stderr || error.message);
            return res.status(500).json({ error: 'Re-indexing failed', details: stderr });
        }
        console.log('Re-index Success:', stdout);
        res.json({ success: true, message: 'Vector database rebuilt successfully', log: stdout });
    });
});

// Endpoint to query the local RAG Vector Database
app.post('/api/rag-query', (req, res) => {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    console.log(`RAG Query Initiated: "${query}"`);

    // Execute the Python bridge script
    // Using --break-system-packages context if needed, but here we just run python3 directly
    const cmd = `python3 query_manuals.py "${query.replace(/"/g, '\\"')}"`;

    exec(cmd, { cwd: PROJECT_ROOT, timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('RAG Query Error:', stderr || error.message);
            return res.status(500).json({ error: 'Failed to query vector database', details: stderr });
        }

        try {
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (parseErr) {
            console.error('RAG Parse Error:', stdout);
            res.status(500).json({ error: 'invalid response from RAG engine' });
        }
    });
});

// Endpoint for Ollama LLM integration
const ollamaAgent = new Agent({
    headersTimeout: 1200000, // 20 minutes for very slow model loading/generation
    bodyTimeout: 1200000,    // 20 minutes for very slow model loading/generation
    connectTimeout: 60000   // 1 minute for initial handshake
});

app.post('/api/ai-chat', async (req, res) => {
    const { prompt, model = 'phi3:latest' } = req.body;

    try {
        console.log(`AI Chat Request: model=${model}`);

        // --- FEW-SHOT REINFORCEMENT ---
        let contextPrefix = "";
        try {
            if (fs.existsSync(FEEDBACK_FILE)) {
                const feedbackData = JSON.parse(fs.readFileSync(FEEDBACK_FILE, 'utf8'));
                const usefulItems = feedbackData.filter(f => f.status === 'useful').slice(-3);
                if (usefulItems.length > 0) {
                    contextPrefix = "Reference these previously verified high-quality engineering insights for tone and technical depth:\n\n";
                    usefulItems.forEach(item => {
                        contextPrefix += `Query: ${item.query}\nCorrect Response: ${item.response}\n\n`;
                    });
                    contextPrefix += "Current Query to answer with similar engineering precision:\n";
                }
            }
        } catch (e) {
            console.error("Reinforcement context error:", e.message);
        }

        const { statusCode, body, headers } = await request('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            dispatcher: ollamaAgent,
            headersTimeout: 1200000,
            bodyTimeout: 1200000,
            body: JSON.stringify({
                model: model,
                prompt: contextPrefix + prompt,
                stream: false
            })
        });

        if (statusCode !== 200) {
            const errText = await body.text();
            throw new Error(`Ollama error (${statusCode}): ${errText}`);
        }

        const data = await body.json();
        res.json({ response: data.response });
    } catch (err) {
        console.error('AI Chat error:', err);
        res.status(503).json({
            error: 'Local LLM offline or unreachable',
            details: 'Ensure Ollama is running at http://localhost:11434'
        });
    }
});

// Endpoint to fetch Git History (Simple version for Local/Dev check)
app.get('/api/git-history', (req, res) => {
    const gitDir = path.join(PROJECT_ROOT, '.git');

    if (!fs.existsSync(gitDir)) {
        return res.json([]);
    }

    const cmd = `git log -n 50 --pretty=format:"%H|%an|%ad|%s" --date=short`;
    exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout) => {
        if (error) {
            console.error('Git Log Error:', error);
            return res.json([]);
        }
        const history = stdout.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });
        res.json(history);
    });
});

// Endpoint to fetch persistent comments
app.get('/api/comments', (req, res) => {
    if (!fs.existsSync(COMMENTS_FILE)) return res.json({});
    try {
        const data = fs.readFileSync(COMMENTS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read comments' });
    }
});

// Endpoint to save a comment
app.post('/api/comments', (req, res) => {
    const { hash, comment } = req.body;
    if (!hash) return res.status(400).json({ error: 'Missing hash' });

    let comments = {};
    if (fs.existsSync(COMMENTS_FILE)) {
        try {
            comments = JSON.parse(fs.readFileSync(COMMENTS_FILE, 'utf8'));
        } catch (e) {
            console.error('JSON parse error on comments:', e);
        }
    }
    comments[hash] = comment;
    try {
        fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save comment' });
    }
});

// 2. STATIC FILES & CATCH-ALL (AFTER API)
const DIST_PATH = path.join(__dirname, 'dist');
app.use(express.static(DIST_PATH));

// Use a regular expression literal for the catch-all to satisfy Express 5 / path-to-regexp
app.get(/.*/, (req, res) => {
    const indexPath = path.join(DIST_PATH, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('MEP Audit System is initializing. Please wait and refresh in 10 seconds.');
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`MEP Backend running at http://0.0.0.0:${PORT}`);
});
