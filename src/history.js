import './history.css'

const commitList = document.getElementById('commit-list');
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `http://${window.location.hostname}:3001/api`
    : '/api';

async function initHistory() {
    try {
        // Fetch Git Log and Comments in parallel
        const [historyRes, commentsRes] = await Promise.all([
            fetch(`${API_BASE}/git-history`),
            fetch(`${API_BASE}/comments`)
        ]);

        const history = await historyRes.json();
        const comments = await commentsRes.json();

        renderHistory(history, comments);
    } catch (err) {
        console.error('History load failed:', err);
        commitList.innerHTML = `<div class="jira-card" style="color:red">Failed to load history: ${err.message}</div>`;
    }
}

function renderHistory(history, comments) {
    if (!history || history.length === 0) {
        commitList.innerHTML = '<div class="jira-card">No git history found.</div>';
        return;
    }

    commitList.innerHTML = history.map(item => `
        <div class="jira-card" id="card-${item.hash}">
            <div class="card-header">
                <p class="commit-msg">${item.message}</p>
                <span class="commit-hash-tag">${item.hash.substring(0, 7)}</span>
            </div>
            <div class="card-meta">
                <div class="author-avatar">${item.author.charAt(0)}</div>
                <span>${item.author}</span>
                <span>•</span>
                <span>${item.date}</span>
                <span style="flex:1"></span>
                <span class="summary-badge" style="background:#e3fcef; color:#006644">PUSHED</span>
            </div>
            <div class="card-feedback">
                <textarea 
                    class="comment-input" 
                    placeholder="Add a comment for this release..."
                    data-hash="${item.hash}">${comments[item.hash] || ''}</textarea>
                <div class="save-status" id="status-${item.hash}">
                  <span>✓</span> Changes saved
                </div>
            </div>
        </div>
    `).join('');

    // Add Auto-save listeners
    const inputs = commitList.querySelectorAll('.comment-input');
    inputs.forEach(input => {
        let timeout;
        input.addEventListener('input', (e) => {
            const hash = e.target.getAttribute('data-hash');
            const comment = e.target.value;
            const statusEl = document.getElementById(`status-${hash}`);

            clearTimeout(timeout);
            timeout = setTimeout(async () => {
                await saveComment(hash, comment);
                statusEl.classList.add('active');
                setTimeout(() => statusEl.classList.remove('active'), 2000);
            }, 800);
        });
    });
}

async function saveComment(hash, comment) {
    try {
        await fetch(`${API_BASE}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hash, comment })
        });
        console.log(`Saved comment for ${hash}`);
    } catch (err) {
        console.error('Save failed:', err);
    }
}

// Start
initHistory();
