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
const PROJECT_ROOT = path.join(__dirname, '..');

app.use(cors());
app.use(express.json());

// Endpoint to list CSV/ODS files
app.get('/api/files', (req, res) => {
    console.log(`--- FILE SCAN START ---`);
    console.log(`Current __dirname: ${__dirname}`);
    console.log(`Resolved PROJECT_ROOT: ${PROJECT_ROOT}`);

    if (!fs.existsSync(PROJECT_ROOT)) {
        console.error(`PROJECT_ROOT does not exist!`);
        return res.status(500).json({ error: 'Project root not found', path: PROJECT_ROOT });
    }

    fs.readdir(PROJECT_ROOT, (err, files) => {
        if (err) {
            console.error('Directory read error:', err);
            return res.status(500).json({ error: 'Cannot read directory', details: err.message });
        }

        console.log(`All files found in root: ${files}`);

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
    const { fileName, jobRef } = req.body;

    if (!fileName || !jobRef) {
        return res.status(400).json({ error: 'Missing filename or job reference' });
    }

    const scriptPath = path.join(PROJECT_ROOT, 'mep_validator_agent_v2.py');
    const filePath = path.join(PROJECT_ROOT, fileName);

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
