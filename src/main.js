import './style.css'
import { STANDARDS_DB } from './standards.js'

const dashboard = document.getElementById('dashboard');

// Metrics
const runDateEl = document.getElementById('runDate');
const jobRefEl = document.getElementById('jobRef');
const fileNameEl = document.getElementById('fileName');
const roomMetricEl = document.getElementById('roomMetric');
const equipMetricEl = document.getElementById('equipMetric');
const roomPassCountEl = document.getElementById('roomPassCount');
const roomFailCountEl = document.getElementById('roomFailCount');
const equipPassCountEl = document.getElementById('equipPassCount');
const equipFailCountEl = document.getElementById('equipFailCount');

// Tables
const roomTableBody = document.querySelector('#roomTable tbody');
const equipTableBody = document.querySelector('#equipTable tbody');
const equipSection = document.getElementById('equipSection');
const equipTableWrapper = document.getElementById('equipTableWrapper');
const equipNoData = document.getElementById('equipNoData');

// AI Expert
const aiExpert = document.getElementById('aiExpert');
const aiExpertContent = document.getElementById('aiExpertContent');
const standardsSearch = document.getElementById('standardsSearch');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const llmModelSelect = document.getElementById('llmModelSelect');
const llmStatus = document.getElementById('llmStatus');

// Backend Integration
const fileSelect = document.getElementById('fileSelect');
const refreshFiles = document.getElementById('refreshFiles');
const lastUpdated = document.getElementById('lastUpdated');
const jobRefInput = document.getElementById('jobRefInput');
const runBtn = document.getElementById('runBtn');
const runStatus = document.getElementById('runStatus');
const resetBtn = document.getElementById('resetBtn');
const runFileInput = document.getElementById('runFileInput');

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001/api`
  : '/api';

// Utility: Debounce
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Reset Functionality
resetBtn.addEventListener('click', () => {
  // Hide sections
  dashboard.classList.add('hidden');
  aiExpert.classList.add('hidden');
  searchResults.classList.add('hidden');

  // Clear inputs
  jobRefInput.value = '';
  standardsSearch.value = '';
  fileSelect.value = '';
  runFileInput.value = '';

  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
  console.log('Interface reset to initial state');
});

// Fetch available reference files on load
async function fetchFiles() {
  try {
    const res = await fetch(`${API_BASE}/files`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const files = await res.json();
    if (!Array.isArray(files)) throw new Error('Response is not an array');
    console.log('Backend returned files:', files);
    fileSelect.innerHTML = '<option value="">Choose File from List</option>' +
      files.map(f => `<option value="${f}">${f}</option>`).join('');
    if (lastUpdated) lastUpdated.textContent = `(Updated: ${new Date().toLocaleTimeString()})`;
  } catch (err) {
    console.error('Fetch error:', err);
    fileSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
  }
}
fetchFiles();

if (refreshFiles) {
  refreshFiles.addEventListener('click', () => {
    fetchFiles();
    alert('File list updated');
  });
}

// Clear Option 2 if Option 1 is selected
fileSelect.addEventListener('change', () => {
  if (fileSelect.value) {
    runFileInput.value = '';
  }
});

// Clear Option 1 if Option 2 is selected
runFileInput.addEventListener('change', () => {
  if (runFileInput.files.length > 0) {
    fileSelect.value = '';
  }
});

runBtn.addEventListener('click', async () => {
  let fileName = fileSelect.value;
  let fileContent = null;
  const jobRef = jobRefInput.value;

  // Check if user uploaded a local file (Option 2)
  if (runFileInput.files.length > 0) {
    const file = runFileInput.files[0];
    fileName = file.name;

    // Check if it's a JSON file (View Only)
    if (fileName.toLowerCase().endsWith('.json')) {
      fileContent = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
      });
      try {
        const data = JSON.parse(fileContent);
        renderDashboard(data, fileName);
        alert('Displaying local report');
        return; // Shortcut for local JSON
      } catch (e) {
        return alert('Invalid JSON file format');
      }
    }

    // Otherwise treat as CSV for Running
    fileContent = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsText(file);
    });
  }

  if (!fileName) return alert('No Data to Process at this time. Choose a .csv file if you want to process a Room Schedule');
  if (!jobRef) return alert('Please enter a Job Reference to continue');

  runBtn.disabled = true;
  runStatus.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/run-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, jobRef, fileContent })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    renderDashboard(data, fileName);
    alert('Audit Successful!');

    // Refresh the files list in case a new file was uploaded to the server
    if (fileContent) fetchFiles();

  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    runBtn.disabled = false;
    runStatus.classList.add('hidden');
  }
});


// Dropzone logic removed as per design update


// LLM Integration Functions
async function checkLLMStatus() {
  try {
    const res = await fetch(`${API_BASE}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi', model: llmModelSelect.value })
    });
    if (res.ok) {
      console.info(`✓ Ollama check: "${llmModelSelect.value}" is ONLINE`);
      llmStatus.classList.add('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Online';
    } else {
      console.warn(`✗ Ollama check: "${llmModelSelect.value}" status code ${res.status}`);
      llmStatus.classList.remove('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Offline';
    }
  } catch (e) {
    llmStatus.classList.remove('online');
  }
}
checkLLMStatus();
llmModelSelect.addEventListener('change', checkLLMStatus);

async function performLLMReasoning(query, ragContext = null) {
  const model = llmModelSelect.value;
  let systemPrompt = "You are a professional MEP and ISO 14644 Compliance Engineer. Your goal is to provide deep technical reasoning for audit results. Be concise and technical.";

  if (model.includes('biomistral')) {
    systemPrompt += " Use your scientific and cleanroom expertise to provide highly detailed filtration and contamination control insights.";
  }

  // --- AUGMENTATION: Inject RAG Context ---
  let augmentedPrompt = `${systemPrompt}\n\n`;
  if (ragContext && ragContext.length > 0) {
    augmentedPrompt += "CONTEXT FROM REGULATORY MANUALS (FDA, WHO, EU GMP):\n";
    ragContext.forEach(res => {
      augmentedPrompt += `[Source: ${res.source}, Page: ${res.page}] Content: ${res.content}\n\n`;
    });
    augmentedPrompt += "Use the above regulatory evidence to inform your reasoning. If the context is relevant, cite the specific manual and page.\n\n";
  }
  augmentedPrompt += `Question: ${query}`;

  try {
    const res = await fetch(`${API_BASE}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: augmentedPrompt,
        model: model
      })
    });
    const data = await res.json();
    return data.response || null;
  } catch (e) {
    return null;
  }
}

// Global copy helper for AI results
window.copyToClipboard = async (text, btn) => {
  try {
    await navigator.clipboard.writeText(text);
    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.classList.add('success');
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('success');
    }, 2000);
  } catch (err) {
    console.error('Failed to copy/export:', err);
  }
};

// Global feedback submitter
window.submitFeedback = async (query, response, isUseful, btn) => {
  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, response, isUseful })
    });

    if (res.ok) {
      const container = btn.closest('.feedback-container');
      const allBtns = container.querySelectorAll('.feedback-btn');
      allBtns.forEach(b => b.classList.add('hidden'));

      const msg = document.createElement('span');
      msg.className = 'animate-in';
      msg.style.fontSize = '0.75rem';
      msg.style.color = isUseful ? 'var(--color-success)' : '#ef4444';
      msg.style.fontWeight = '700';
      msg.innerHTML = isUseful ? '✅ Engineering Insight Verified' : '❌ Technical Pitfall Noted';
      container.appendChild(msg);
    }
  } catch (err) {
    console.error('Feedback Submit Error:', err);
  }
};

function displayFocusedInsight(res) {
  const escapedValue = res.value.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid var(--color-primary); position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <span class="insight-tag">${res.path}</span>
        <button onclick="copyToClipboard('${escapedValue}', this)" class="mini-copy-btn">📋 Copy</button>
      </div>
      <p style="font-size: 1.125rem; line-height: 1.6; margin: 0.5rem 0;">${res.value}</p>
      
      <div class="feedback-container">
        <button onclick="submitFeedback('${res.path}', '${escapedValue}', true, this)" class="feedback-btn">👍 Useful</button>
        <button onclick="submitFeedback('${res.path}', '${escapedValue}', false, this)" class="feedback-btn">👎 Not Useful</button>
      </div>

      <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--color-text-dim);">
        💡 Selected from Standards Database
      </div>
    </div>
  `;
  aiExpert.classList.remove('hidden');
}


async function performSearch(query) {
  if (!query) {
    searchResults.classList.add('hidden');
    return;
  }

  const results = [];
  // Basic recursive search through standards DB
  function search(obj, path = '') {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object') {
        search(value, `${path} > ${key}`);
      } else if (value.toLowerCase().includes(query) || key.toLowerCase().includes(query)) {
        results.push({ key, value, path });
      }
    }
  }
  search(STANDARDS_DB);

  let html = ''; // Initialize html here

  // --- TIER 1: LOCAL RESULTS ---
  if (results.length > 0) {
    html += results.slice(0, 5).map((res, index) => `
      <div class="result-item" data-index="${index}" style="cursor: pointer;">
        <span class="insight-tag">LOCAL EXPERT: ${res.path}</span>
        <p style="margin: 0.25rem 0">${res.value}</p>
      </div>
    `).join('');
  }

  // --- TIER 2: REGULATORY EVIDENCE (RAG) ---
  const ragResults = await performRAGQuery(query);
  if (ragResults && ragResults.length > 0) {
    html += ragResults.map(res => `
      <div class="result-item" style="border-left: 4px solid var(--color-warning); background: rgba(245, 158, 11, 0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <span class="insight-tag">📜 REGULATORY EVIDENCE: ${res.source}</span>
          <button onclick="copyToClipboard('${res.content.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', this)" class="mini-copy-btn">📋 Copy</button>
        </div>
        <p style="font-size: 0.875rem; color: var(--color-text); line-height: 1.5;">"${res.content.substring(0, 300)}..."</p>
      </div>
    `).join('');
  }



  // --- TIER 3: LOCAL LLM REASONING (IF ONLINE) ---
  if (llmStatus.classList.contains('online')) {
    // Pass the RAG results directly into the LLM reasoning function for "Augmentation"
    const reasoning = await performLLMReasoning(query, ragResults);
    if (reasoning) {
      const escapedReasoning = reasoning.replace(/'/g, "\\'").replace(/"/g, '&quot;');
      html += `
        <div class="result-item" style="border-left: 4px solid var(--color-success); background: rgba(16, 185, 129, 0.05); margin-bottom: 0.5rem; border-radius: 0.5rem; padding: 1rem; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <span class="insight-tag">🌟 LOCAL ENGINEERING LLM (${llmModelSelect.value.toUpperCase()})</span>
            <button onclick="copyToClipboard('${escapedReasoning}', this)" class="mini-copy-btn" title="Copy reasoning to clipboard">📋 Copy</button>
          </div>
          <p class="llm-reasoning-text" style="font-size: 0.95rem; line-height: 1.5; color: #fff;">${reasoning}</p>
          
          <div class="feedback-container">
            <button onclick="submitFeedback('${query.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${escapedReasoning}', true, this)" class="feedback-btn">👍 Useful</button>
            <button onclick="submitFeedback('${query.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${escapedReasoning}', false, this)" class="feedback-btn">👎 Not Useful</button>
          </div>
        </div>
      `;
    }
  }


  async function performRAGQuery(query) {
    try {
      const res = await fetch(`${API_BASE}/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.results || null;
    } catch (e) {
      return null;
    }
  }

  if (html) {
    searchResults.innerHTML = html;

    // Add click listeners to LOCAL results only (those with data-index)
    const items = searchResults.querySelectorAll('.result-item[data-index]');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const idx = item.getAttribute('data-index');
        const selected = results[idx];
        if (selected) {
          displayFocusedInsight(selected);
          searchResults.classList.add('hidden');
        }
      });
    });

    searchResults.classList.remove('hidden');
  } else {
    searchResults.innerHTML = '<p style="font-size: 0.875rem; color: var(--color-text-dim)">No matching standards found. Try a broader term.</p>';
    searchResults.innerHTML += generateExternalLinks(query);
    searchResults.classList.remove('hidden');
  }
}

const debouncedSearch = debounce((q) => performSearch(q), 400);

standardsSearch.addEventListener('input', (e) => {
  debouncedSearch(e.target.value.toLowerCase());
});

searchBtn.addEventListener('click', () => {
  performSearch(standardsSearch.value.toLowerCase());
});

standardsSearch.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    performSearch(standardsSearch.value.toLowerCase());
  }
});

function handleFiles(files) {
  const file = files[0];
  if (file.type !== 'application/json') return alert('Please upload a JSON file');

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      renderDashboard(data, file.name);
    } catch (err) {
      alert('Error parsing JSON file');
    }
  };
  reader.readAsText(file);
}

function showInsight(type) {
  const insight = STANDARDS_DB.FAILURE_ANALYSIS_MODES[type];
  if (!insight) return;

  aiExpert.classList.remove('hidden');
  const fullText = `Expert Analysis: ${insight.Cause}\nRecommendation: ${insight.Action}`;
  const escapedText = fullText.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid #ef4444; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <span class="insight-tag">Compliance Insight: ${type.replace(/_/g, ' ')}</span>
        <button onclick="copyToClipboard('${escapedText}', this)" class="mini-copy-btn">📋 Copy</button>
      </div>
      <p><strong>Engineering Analysis:</strong> ${insight.Cause}</p>
      <p style="color: var(--color-success); font-size: 0.875rem; margin-top: 1rem;"><strong>Expert Recommendation:</strong> ${insight.Action}</p>
      
      <div class="feedback-container">
        <button onclick="submitFeedback('${type.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${escapedText}', true, this)" class="feedback-btn">👍 Useful</button>
        <button onclick="submitFeedback('${type.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${escapedText}', false, this)" class="feedback-btn">👎 Not Useful</button>
      </div>
    </div>
  `;
  aiExpert.scrollIntoView({ behavior: 'smooth' });
}

function renderDashboard(data, fileName) {
  const isOption1 = !!fileSelect.value;

  dashboard.classList.remove('hidden');
  runDateEl.textContent = data.run_date || 'Unknown Date';
  jobRefEl.textContent = `Job: ${data.job_reference || 'Unreferenced'}`;
  fileNameEl.textContent = `File: ${data.input_file || fileName}`;

  // Visibility Logic for Equipment Section
  if (!isOption1) {
    equipSection.classList.add('hidden');
  } else {
    equipSection.classList.remove('hidden');

    // Check if data contains only "Invalid power format" errors
    const allInvalid = data.equipment && data.equipment.length > 0 &&
      data.equipment.every(e => e.status === 'FAIL' && e.issues.includes('Invalid power format'));

    if (allInvalid) {
      equipTableWrapper.classList.add('hidden');
      equipNoData.classList.remove('hidden');
    } else {
      equipTableWrapper.classList.remove('hidden');
      equipNoData.classList.add('hidden');
    }
  }

  // Rooms
  roomTableBody.innerHTML = '';
  let roomPass = 0;
  let roomFail = 0;

  data.rooms.forEach(room => {
    const row = document.createElement('tr');
    const isPass = room.status === 'PASS';
    if (isPass) roomPass++; else roomFail++;

    row.innerHTML = `
      <td>${room.name}</td>
      <td>${room.ach}</td>
      <td>${room.comfort}</td>
      <td><span class="status-badge ${isPass ? 'status-pass' : 'status-fail'}">${room.status}</span></td>
      <td>
        ${!isPass ? `<button class="expert-btn" onclick="window.showAIInsight('ACH_Variance')">Ask AI Expert</button>` : ''}
      </td>
    `;
    roomTableBody.appendChild(row);
  });

  window.showAIInsight = showInsight; // Global for onclick

  const roomTotal = data.rooms.length;
  roomMetricEl.textContent = roomTotal ? `${Math.round((roomPass / roomTotal) * 100)}%` : '0%';
  roomPassCountEl.textContent = `${roomPass} PASSED`;
  roomFailCountEl.textContent = `${roomFail} FAILED`;

  // Equipment
  equipTableBody.innerHTML = '';
  let equipPass = 0;
  let equipFail = 0;

  data.equipment.forEach(item => {
    const row = document.createElement('tr');
    const isPass = item.status === 'PASS';
    if (isPass) equipPass++; else equipFail++;

    row.innerHTML = `
      <td><strong>${item.mark}</strong></td>
      <td>${item.category}</td>
      <td>${item.issues}</td>
      <td><span class="status-badge ${isPass ? 'status-pass' : 'status-fail'}">${item.status}</span></td>
    `;
    equipTableBody.appendChild(row);
  });

  const equipTotal = data.equipment.length;
  equipMetricEl.textContent = equipTotal ? `${Math.round((equipPass / equipTotal) * 100)}%` : '0%';
  equipPassCountEl.textContent = `${equipPass} PASSED`;
  equipFailCountEl.textContent = `${equipFail} FAILED`;

  dashboard.scrollIntoView({ behavior: 'smooth' });
}
