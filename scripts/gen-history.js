import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Skip generation if on Render/CI to preserve the COMMITTED local manifest
if (process.env.RENDER || process.env.CI) {
    console.log('Production/CI environment detected. Skipping history generation to preserve local manifest.');
    process.exit(0);
}

try {
    console.log('Generating Git History Manifest...');
    const cmd = `git log -n 50 --pretty=format:"%H|%an|%ad|%s" --date=short`;
    const stdout = execSync(cmd, { cwd: PROJECT_ROOT }).toString();

    const history = stdout.split('\n').filter(Boolean).map(line => {
        const [hash, author, date, message] = line.split('|');
        return { hash, author, date, message };
    });

    const outputPath = path.join(PROJECT_ROOT, 'src', 'history-manifest.json');
    fs.writeFileSync(outputPath, JSON.stringify(history, null, 2));
    console.log(`✓ History manifest generated with ${history.length} commits.`);
} catch (err) {
    console.error('Failed to generate git history manifest:', err.message);
    // Write an empty array so the build doesn't fail
    const outputPath = path.join(PROJECT_ROOT, 'src', 'history-manifest.json');
    fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
}
