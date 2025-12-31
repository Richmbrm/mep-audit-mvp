import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(PROJECT_ROOT, 'src', 'history-manifest.json');

// Skip generation if on Render/CI to preserve the COMMITTED local manifest
if (process.env.RENDER || process.env.CI) {
    console.log('Production/CI environment detected. Skipping history generation to preserve local manifest.');
    process.exit(0);
}

async function generateAISummary(message) {
    try {
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.2:latest',
                prompt: `You are a technical lead. Summarize this git commit message into a single, professional one-sentence engineering update for a release log: "${message}". Output ONLY the summary sentence.`,
                stream: false
            })
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.response.trim();
    } catch (e) {
        return null;
    }
}

async function run() {
    try {
        console.log('Generating Git History Manifest...');

        // Load existing manifest to preserve existing summaries
        let existingManifest = [];
        if (fs.existsSync(MANIFEST_PATH)) {
            existingManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        }
        const existingMap = new Map(existingManifest.map(c => [c.hash, c]));

        const cmd = `git log -n 50 --pretty=format:"%H|%an|%ad|%s" --date=short`;
        const stdout = execSync(cmd, { cwd: PROJECT_ROOT }).toString();

        const rawCommits = stdout.split('\n').filter(Boolean).map(line => {
            const [hash, author, date, message] = line.split('|');
            return { hash, author, date, message };
        });

        const history = [];
        console.log('Checking for AI summaries...');

        for (const commit of rawCommits) {
            const existing = existingMap.get(commit.hash);
            if (existing && existing.aiSummary) {
                history.push(existing);
            } else {
                console.log(`Generating AI summary for: ${commit.hash.substring(0, 7)}...`);
                const aiSummary = await generateAISummary(commit.message);
                history.push({ ...commit, aiSummary: aiSummary || 'Manual update verified.' });
            }
        }

        fs.writeFileSync(MANIFEST_PATH, JSON.stringify(history, null, 2));
        console.log(`✓ History manifest generated with ${history.length} commits and AI summaries.`);
    } catch (err) {
        console.error('Failed to generate git history manifest:', err.message);
        if (!fs.existsSync(MANIFEST_PATH)) {
            fs.writeFileSync(MANIFEST_PATH, JSON.stringify([], null, 2));
        }
    }
}

run();
