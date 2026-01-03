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

// Vision Controls
const schematicUpload = document.getElementById('schematicUpload');
const visionPreviewContainer = document.getElementById('visionPreviewContainer');
const visionPreview = document.getElementById('visionPreview');
const analyzeSchematicBtn = document.getElementById('analyzeSchematicBtn');
const clearSchematicBtn = document.getElementById('clearSchematicBtn');

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:3001/api`
  : '/api';

// Request Cancellation Controllers
let searchAbortController = null;
let llmAbortController = null;

// Utility: Debounce
function debounce(func, timeout = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

// Utility: Safe Escape for HTML attributes and JS strings
const safeEscape = (str) => {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

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
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(10000) // 10s timeout for safety
    });
    const data = await res.json();
    if (data.online) {
      console.info(`✓ Ollama check: "${llmModelSelect.value}" is ONLINE`);
      llmStatus.classList.add('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Online (Ready)';
    } else {
      console.warn(`✗ Ollama check: "${llmModelSelect.value}" is BUSY or OFFLINE`);
      llmStatus.classList.remove('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Busy/Offline';
    }
  } catch (e) {
    llmStatus.classList.remove('online');
    llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Offline';
  }
}
checkLLMStatus();
// Re-check periodically
setInterval(checkLLMStatus, 30000);
llmModelSelect.addEventListener('change', checkLLMStatus);

async function performLLMReasoning(query, ragContext = null) {
  // Cancel any existing LLM request
  if (llmAbortController) llmAbortController.abort();
  llmAbortController = new AbortController();

  const model = llmModelSelect.value;
  let systemPrompt = "You are a professional MEP and ISO 14644 Compliance Engineer. Provide a high-level technical summary of how regulatory standards apply to the user's query.\n\n" +
    "STRICT RULES:\n" +
    "1. Format your response as 3 BULLET POINTS ONLY.\n" +
    "2. Be extremely concise (MAX 100 WORDS total).\n" +
    "3. Focus on high-level technical implications, not document-level verbosity.";

  if (model.includes('biomistral')) {
    systemPrompt += "\n4. Use your scientific expertise to highlight filtration and contamination control priorities.";
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
      }),
      signal: llmAbortController.signal
    });
    const data = await res.json();
    return data.response || null;
  } catch (e) {
    if (e.name === 'AbortError') return 'REQUEST_CANCELLED';
    return null;
  } finally {
    llmAbortController = null;
  }
}

// Global handler for deep reasoning button
window.triggerDeepReasoning = async (query, btn) => {
  const container = btn.closest('.result-item');
  const queryData = btn.dataset.query;
  const ragData = JSON.parse(btn.dataset.rag || '[]');

  btn.disabled = true;
  btn.innerHTML = '⚙️ Analyzing Standards...';

  const response = await performLLMReasoning(queryData, ragData);

  if (response === 'REQUEST_CANCELLED') return;

  if (response) {
    const escapedReasoning = safeEscape(response);
    const escapedQuery = safeEscape(queryData);

    // Replace button area with result
    btn.parentElement.innerHTML = `
      <div class="animate-in" style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
        <p class="llm-reasoning-text" style="font-size: 0.95rem; line-height: 1.5; color: #fff;">${response}</p>
        <div class="feedback-container" style="margin-top: 1rem;">
          <button onclick="submitFeedback('${escapedQuery}', '${escapedReasoning}', true, this)" class="feedback-btn mini">👍 Useful</button>
          <button onclick="submitFeedback('${escapedQuery}', '${escapedReasoning}', false, this)" class="feedback-btn mini">👎 Not Useful</button>
          <button onclick="copyToClipboard('${escapedReasoning}', this)" class="mini-copy-btn" style="margin-left: auto;">📋 Copy</button>
        </div>
      </div>
    `;
  } else {
    btn.disabled = false;
    btn.innerHTML = '❌ Reasoning Failed - Retry?';
  }
};

// Global copy helper for AI results
window.copyToClipboard = async (text, btn) => {
  try {
    // Use the modern API if available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      throw new Error('Clipboard API unavailable');
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '✅ Copied!';
    btn.classList.add('success');
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.classList.remove('success');
    }, 2000);
  } catch (err) {
    // Fallback for non-HTTPS or incompatible browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Ensure it's not visible but still part of the DOM
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);

      const originalText = btn.innerHTML;
      btn.innerHTML = '✅ Copied!';
      setTimeout(() => {
        btn.innerHTML = originalText;
      }, 2000);
    } catch (fallbackErr) {
      console.error('Failed to copy/export:', fallbackErr);
    }
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
  const escapedValue = safeEscape(res.value);
  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid var(--color-primary); position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <span class="insight-tag">${res.path}</span>
        <button onclick="copyToClipboard('${escapedValue}', this)" class="mini-copy-btn">📋 Copy</button>
      </div>
      <p style="font-size: 1.125rem; line-height: 1.6; margin: 0.5rem 0;">${res.value}</p>
      
      <div class="feedback-container">
        <button onclick="submitFeedback('${safeEscape(res.path)}', '${escapedValue}', true, this)" class="feedback-btn">👍 Useful</button>
        <button onclick="submitFeedback('${safeEscape(res.path)}', '${escapedValue}', false, this)" class="feedback-btn">👎 Not Useful</button>
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

  // Cancel any existing search (RAG) request
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

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

  let html = '';

  // --- TIER 1: LOCAL RESULTS ---
  if (results.length > 0) {
    html += '<div class="search-category-header">Local Standards Reference</div>';
    html += results.slice(0, 5).map((res, index) => `
      <div class="result-item" data-index="${index}" style="cursor: pointer;">
        <span class="insight-tag">LOCAL EXPERT: ${res.path}</span>
        <p style="margin: 0.25rem 0">${res.value}</p>
      </div>
    `).join('');
  }

  // --- TIER 2: REGULATORY EVIDENCE (RAG) ---
  const ragResults = await performRAGQuery(query, searchAbortController.signal);

  if (ragResults === 'REQUEST_CANCELLED') return;

  if (ragResults && ragResults.length > 0) {
    html += '<div class="search-category-header">Regulatory Manual Evidence (RAG)</div>';
    html += ragResults.map(res => `
      <div class="result-item" style="border-left: 4px solid var(--color-warning); background: rgba(245, 158, 11, 0.05);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
          <span class="insight-tag">📜 ${res.source} (Pg ${res.page})</span>
          <button onclick="copyToClipboard('${safeEscape(res.content)}', this)" class="mini-copy-btn">📋 Copy</button>
        </div>
        <p style="font-size: 0.875rem; color: var(--color-text); line-height: 1.5;">"${res.content.substring(0, 300)}..."</p>
      </div>
    `).join('');
  }

  // --- TIER 3: LOCAL LLM REASONING (ALWAYS SHOW TRIGGER) ---
  const escapedQuery = safeEscape(query);
  const escapedRagData = safeEscape(JSON.stringify(ragResults || []));
  const isOnline = llmStatus.classList.contains('online');

  html += `
    <div class="result-item" style="border-left: 4px solid var(--color-success); background: rgba(16, 185, 129, 0.05); text-align: center; padding: 1.5rem;">
      <span class="insight-tag" style="margin-bottom: 1rem; display: inline-block;">🌟 AI ENGINEERING ANALYSIS</span>
      <p style="font-size: 0.85rem; color: var(--color-text-dim); margin-bottom: 1rem;">
        ${isOnline ? 'Generate a technical breakdown using ' + llmModelSelect.value.toUpperCase() + '.' : 'LLM is currently Busy/Offline. You can still try to trigger an analysis.'}
      </p>
      <button 
        onclick="triggerDeepReasoning('${escapedQuery}', this)" 
        class="primary-btn mini" 
        data-query="${escapedQuery}"
        data-rag="${escapedRagData}"
        style="width: 100%; border: ${isOnline ? 'none' : '1px solid var(--color-warning)'}; background: ${isOnline ? 'var(--color-primary)' : 'rgba(0,0,0,0.3)'}"
      >
        🚀 Generate Deep AI Insight
      </button>
    </div>
  `;

  async function performRAGQuery(query, signal) {
    try {
      const res = await fetch(`${API_BASE}/rag-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
        signal: signal
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.results || null;
    } catch (e) {
      if (e.name === 'AbortError') return 'REQUEST_CANCELLED';
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

const debouncedSearch = debounce((q) => performSearch(q), 800);

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
  const escapedText = safeEscape(fullText);
  const escapedType = safeEscape(type);

  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid #ef4444; position: relative;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
        <span class="insight-tag">Compliance Insight: ${type.replace(/_/g, ' ')}</span>
        <button onclick="copyToClipboard('${escapedText}', this)" class="mini-copy-btn">📋 Copy</button>
      </div>
      <p><strong>Engineering Analysis:</strong> ${insight.Cause}</p>
      <p style="color: var(--color-success); font-size: 0.875rem; margin-top: 1rem;"><strong>Expert Recommendation:</strong> ${insight.Action}</p>
      
      <div class="feedback-container">
        <button onclick="submitFeedback('${escapedType}', '${escapedText}', true, this)" class="feedback-btn">👍 Useful</button>
        <button onclick="submitFeedback('${escapedType}', '${escapedText}', false, this)" class="feedback-btn">👎 Not Useful</button>
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

// --- VISION INTERPRETER LOGIC ---

schematicUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    visionPreview.src = event.target.result;
    visionPreviewContainer.classList.remove('hidden');
    visionPreviewContainer.scrollIntoView({ behavior: 'smooth' });
  };
  reader.readAsDataURL(file);
});

async function analyzeSchematic() {
  const file = schematicUpload.files[0];
  if (!file) {
    alert("Please select a schematic image first.");
    return;
  }

  analyzeSchematicBtn.disabled = true;
  analyzeSchematicBtn.innerText = "🔍 Analyzing Layout...";

  // Get base64 without the prefix
  const base64 = visionPreview.src.split(',')[1];

  try {
    const res = await fetch(`${API_BASE}/vision-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: "Analyze this schematic diagram. Identify key MEP components, filtration systems, and room cleanroom classifications. Briefly summarize the compliance risks if any.",
        images: [base64]
      })
    });

    const data = await res.json();

    // Display result in AI Expert panel
    aiExpertContent.innerHTML = `
      <div class="insight-card animate-in" style="border-left: 4px solid var(--color-primary);">
        <span class="insight-tag">📋 SCHEMATIC VISUAL ANALYSIS</span>
        <p style="font-size: 0.875rem; line-height: 1.6; margin: 0.5rem 0; white-space: pre-wrap;">${data.response}</p>
        <div style="margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--color-border); font-size: 0.75rem; color: var(--color-text-dim);">
          💡 Analysis provided by Moondream Vision Model
        </div>
      </div>
    `;
    aiExpert.classList.remove('hidden');
  } catch (err) {
    console.error('Vision Analysis Error:', err);
    alert('Failed to analyze schematic. Ensure Ollama is running Moondream.');
  } finally {
    analyzeSchematicBtn.disabled = false;
    analyzeSchematicBtn.innerText = "Analyze Layout";
  }
}

analyzeSchematicBtn.addEventListener('click', analyzeSchematic);

clearSchematicBtn.addEventListener('click', () => {
  schematicUpload.value = '';
  visionPreview.src = '';
  visionPreviewContainer.classList.add('hidden');
});
