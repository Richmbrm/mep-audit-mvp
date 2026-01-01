const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : '';

const manualList = document.getElementById('manualList');
const reindexBtn = document.getElementById('reindexBtn');
const reindexLog = document.getElementById('reindexLog');
const logContent = document.getElementById('logContent');
const indexingStatus = document.getElementById('indexingStatus');
const totalFeedback = document.getElementById('totalFeedback');

async function loadManuals() {
    try {
        const res = await fetch(`${API_BASE}/api/admin/manuals`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.length === 0) {
            manualList.innerHTML = '<li style="color: var(--color-text-dim)">No PDF manuals found in manuals/ folder.</li>';
        } else {
            manualList.innerHTML = data.map(file => `<li>${file}</li>`).join('');
        }
    } catch (e) {
        manualList.innerHTML = `<li style="color: #ef4444">Error loading library: ${e.message}</li>`;
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/api/feedback`);
        if (!res.ok) throw new Error('Stats unavailable');
        const data = await res.json();
        const usefulCount = data.filter(f => f.status === 'useful').length;
        totalFeedback.textContent = usefulCount;
    } catch (e) {
        totalFeedback.textContent = '--';
    }
}

reindexBtn.addEventListener('click', async () => {
    if (!confirm('Rebuilding the index will delete the current vector database and re-process all manuals. Proceed?')) return;

    reindexBtn.disabled = true;
    reindexBtn.textContent = '⏳ Ingesting & Embedding...';
    indexingStatus.textContent = 'Working';
    indexingStatus.className = 'status-badge working';
    reindexLog.classList.remove('hidden');
    logContent.textContent = '> Initializing vector engine...\n> Wiping old database...\n';

    try {
        const res = await fetch(`${API_BASE}/api/admin/reindex`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            logContent.textContent += data.log || '> Re-indexing Complete.';
            logContent.textContent += '\n\nSUCCESS: Vector vault is up to date.';
            indexingStatus.textContent = 'Ready';
            indexingStatus.className = 'status-badge';
        } else {
            logContent.textContent += `\nERROR: ${data.details || 'Unknown error'}`;
            indexingStatus.textContent = 'Failed';
            indexingStatus.className = 'status-badge working';
        }
    } catch (e) {
        logContent.textContent += `\nCRITICAL ERROR: ${e.message}`;
        indexingStatus.textContent = 'Error';
    } finally {
        reindexBtn.disabled = false;
        reindexBtn.textContent = '🚀 Rebuild Regulatory Index';
        reindexLog.scrollTop = reindexLog.scrollHeight;
    }
});

// Init
loadManuals();
loadStats();
