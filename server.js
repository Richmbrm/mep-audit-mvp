import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const PROJECT_ROOT = __dirname;
const COMMENTS_FILE = path.join(PROJECT_ROOT, 'comments.json');

app.use(cors());
app.use(express.json());

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
app.post('/api/ai-chat', async (req, res) => {
    const { prompt, model = 'biomistral' } = req.body;

    try {
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                prompt: prompt,
                stream: false
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();
        res.json({ response: data.response });
    } catch (err) {
        console.error('AI Chat error:', err);
        res.status(503).json({
            error: 'Local LLM offline or unreachable',
            details: 'Ensure Ollama is running at http://localhost:11434'
        });
    }
});

// Endpoint to fetch Git History
app.get('/api/git-history', (req, res) => {
    const getLog = () => {
        const cmd = `git log -n 50 --pretty=format:"%H|%an|%ad|%s" --date=short`;
        exec(cmd, { cwd: PROJECT_ROOT }, (error, stdout) => {
            if (error) {
                console.error('Git error:', error);
                return res.status(500).json({ error: 'Failed to fetch git history' });
            }
            const history = stdout.split('\n').filter(Boolean).map(line => {
                const [hash, author, date, message] = line.split('|');
                return { hash, author, date, message };
            });

            // If we only have 1 commit and might be shallow, attempt to deepen (Production fix)
            const isProbablyShallow = history.length === 1 && fs.existsSync(path.join(PROJECT_ROOT, '.git/shallow'));

            if (isProbablyShallow && !req.query.retried) {
                console.log('Shallow clone detected on Render. Attempting to deepen history...');
                exec(`git fetch --depth=50`, { cwd: PROJECT_ROOT }, (fetchErr) => {
                    if (fetchErr) {
                        console.error('Failed to unshallow repo:', fetchErr);
                        return res.json(history); // Return what we have
                    }
                    // Retry once
                    res.redirect('/api/git-history?retried=true');
                });
            } else {
                res.json(history);
            }
        });
    };
    getLog();
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
