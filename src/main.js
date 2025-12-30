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

const DOMAIN_KEYWORDS = [
  'MEP', 'HVAC', 'Cleanroom', 'ISO 14644', 'Standard', 'Airlock', 'HEPA', 'ACH',
  'Pressure', 'Ventilation', 'Plumbing', 'Electrical', 'ASHRAE', 'Engineering',
  'Safety', 'Filter', 'Clean room', 'Laminar', 'Air change', 'Particle'
];

// LLM Integration Functions
async function checkLLMStatus() {
  try {
    const res = await fetch(`${API_BASE}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi', model: llmModelSelect.value })
    });
    if (res.ok) {
      llmStatus.classList.add('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Online';
    } else {
      llmStatus.classList.remove('online');
      llmStatus.querySelector('.tooltip-text').textContent = 'Local LLM Offline';
    }
  } catch (e) {
    llmStatus.classList.remove('online');
  }
}
checkLLMStatus();
llmModelSelect.addEventListener('change', checkLLMStatus);

async function performLLMReasoning(query) {
  const model = llmModelSelect.value;
  let systemPrompt = "You are a professional MEP and ISO 14644 Compliance Engineer. Your goal is to provide deep technical reasoning for audit results. Be concise and technical.";

  if (model === 'biomistral') {
    systemPrompt += " Use your scientific and cleanroom expertise to provide highly detailed filtration and contamination control insights.";
  }

  try {
    const res = await fetch(`${API_BASE}/ai-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `${systemPrompt}\n\nQuestion: ${query}`,
        model: model
      })
    });
    const data = await res.json();
    return data.response || null;
  } catch (e) {
    return null;
  }
}

function displayFocusedInsight(res) {
  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid var(--color-primary);">
      <span class="insight-tag">${res.path}</span>
      <p style="font-size: 1.125rem; line-height: 1.6; margin: 0.5rem 0;">${res.value}</p>
      <div style="margin-top: 1rem; font-size: 0.75rem; color: var(--color-text-dim);">
        💡 Selected from Standards Database
      </div>
    </div>
  `;
  aiExpert.classList.remove('hidden');
}
async function performWikipediaSearch(query) {
  try {
    // Attempt 1: Context Anchored Search
    let searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/ /g, '_'))}`;
    let response = await fetch(searchUrl);

    // If exact match fails, try adding " (HVAC)" for context
    if (!response.ok) {
      searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent((query + ' (HVAC)').replace(/ /g, '_'))}`;
      response = await fetch(searchUrl);
    }

    if (!response.ok) return null;
    const data = await response.json();

    // Context Guard: Check if the extract is relevant to our domain
    const isRelevant = DOMAIN_KEYWORDS.some(kw =>
      data.extract.toLowerCase().includes(kw.toLowerCase()) ||
      data.title.toLowerCase().includes(kw.toLowerCase())
    );

    if (!isRelevant) {
      console.warn(`Wikipedia result for "${query}" filtered out by Domain Guard.`);
      return null;
    }

    return {
      title: data.title,
      extract: data.extract,
      url: data.content_urls.desktop.page
    };
  } catch (e) {
    return null;
  }
}

function generateExternalLinks(query) {
  return `
    <div class="external-search-links" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--color-border);">
      <p style="font-size: 0.75rem; color: var(--color-text-dim); margin-bottom: 0.5rem;">Deep search on industry sites:</p>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <a href="https://www.hse.gov.uk/search/results.htm?q=${encodeURIComponent(query)}" target="_blank" class="external-link-tag">HSE.gov.uk</a>
        <a href="https://www.iso.org/search.html?q=${encodeURIComponent(query)}" target="_blank" class="external-link-tag">ISO.org</a>
        <a href="https://www.google.com/search?q=site:ashrae.org+${encodeURIComponent(query)}" target="_blank" class="external-link-tag">ASHRAE</a>
      </div>
    </div>
  `;
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

  // --- TIER 2: WIKIPEDIA (IF NEEDED OR FOR BROAD TERMS) ---
  if (results.length < 3) {
    const wiki = await performWikipediaSearch(query);
    if (wiki) {
      html += `
        <div class="result-item wiki-result" style="border-left-color: #72777d;">
          <span class="insight-tag">🛡️ DOMAIN GUARDED (WIKIPEDIA)</span>
          <p style="font-weight: 600; margin-bottom: 0.25rem;">${wiki.title}</p>
          <p style="font-size: 0.875rem; color: var(--color-text-dim)">${wiki.extract.substring(0, 150)}...</p>
          <a href="${wiki.url}" target="_blank" style="font-size: 0.75rem; color: var(--color-primary)">Read full article</a>
        </div>
      `;
    }
  }

  // --- TIER 3: LOCAL LLM REASONING (IF ONLINE) ---
  if (llmStatus.classList.contains('online')) {
    const reasoning = await performLLMReasoning(query);
    if (reasoning) {
      html += `
        <div class="result-item" style="border-left: 4px solid var(--color-success); background: rgba(16, 185, 129, 0.05); margin-bottom: 0.5rem; border-radius: 0.5rem; padding: 1rem;">
          <span class="insight-tag">🌟 DEEP REASONING (${llmModelSelect.value.toUpperCase()})</span>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #fff;">${reasoning}</p>
        </div>
      `;
    }
  }

  // --- TIER 4: EXTERNAL DEEP LINKS ---
  html += generateExternalLinks(query);

  if (html) {
    searchResults.innerHTML = html;

    // Add click listeners to LOCAL results only
    const items = searchResults.querySelectorAll('.result-item:not(.wiki-result)');
    items.forEach(item => {
      item.addEventListener('click', () => {
        const idx = item.getAttribute('data-index');
        const selected = results[idx];
        displayFocusedInsight(selected);
        searchResults.classList.add('hidden');
      });
    });

    searchResults.classList.remove('hidden');
  } else {
    searchResults.innerHTML = '<p style="font-size: 0.875rem; color: var(--color-text-dim)">No matching standards found. Try a broader term.</p>';
    searchResults.innerHTML += generateExternalLinks(query);
    searchResults.classList.remove('hidden');
  }
}

standardsSearch.addEventListener('input', (e) => {
  performSearch(e.target.value.toLowerCase());
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
  aiExpertContent.innerHTML = `
    <div class="insight-card animate-in" style="border-left: 4px solid #ef4444;">
      <span class="insight-tag">Compliance Insight: ${type.replace(/_/g, ' ')}</span>
      <p><strong>Engineering Analysis:</strong> ${insight.Cause}</p>
      <p style="color: var(--color-success); font-size: 0.875rem; margin-top: 1rem;"><strong>Expert Recommendation:</strong> ${insight.Action}</p>
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
