import './style.css'
import { STANDARDS_DB } from './standards.js'

const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
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

// AI Expert
const aiExpert = document.getElementById('aiExpert');
const aiExpertContent = document.getElementById('aiExpertContent');
const standardsSearch = document.getElementById('standardsSearch');
const searchResults = document.getElementById('searchResults');

// Backend Integration
const fileSelect = document.getElementById('fileSelect');
const refreshFiles = document.getElementById('refreshFiles');
const lastUpdated = document.getElementById('lastUpdated');
const jobRefInput = document.getElementById('jobRefInput');
const runBtn = document.getElementById('runBtn');
const runStatus = document.getElementById('runStatus');
const resetBtn = document.getElementById('resetBtn');

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
  fileInput.value = '';

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
    fileSelect.innerHTML = files.map(f => `<option value="${f}">${f}</option>`).join('');
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

runBtn.addEventListener('click', async () => {
  const fileName = fileSelect.value;
  const jobRef = jobRefInput.value;

  if (!fileName || !jobRef) return alert('Please select a file and enter a job reference');

  runBtn.disabled = true;
  runStatus.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE}/run-audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, jobRef })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    renderDashboard(data, fileName);
    alert('Audit Successful!');
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    runBtn.disabled = false;
    runStatus.classList.add('hidden');
  }
});

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.style.borderColor = 'var(--color-primary)';
  dropzone.style.background = 'rgba(59, 130, 246, 0.05)';
});

dropzone.addEventListener('dragleave', () => {
  dropzone.style.borderColor = 'var(--color-border)';
  dropzone.style.background = 'var(--color-surface)';
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = e.dataTransfer.files;
  if (files.length > 0) handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) handleFiles(e.target.files);
});

standardsSearch.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
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

  if (results.length > 0) {
    searchResults.innerHTML = results.slice(0, 5).map(res => `
      <div class="result-item">
        <span class="insight-tag">${res.path}</span>
        <p style="margin: 0.25rem 0">${res.value}</p>
      </div>
    `).join('');
    searchResults.classList.remove('hidden');
  } else {
    searchResults.innerHTML = '<p style="font-size: 0.875rem; color: var(--color-text-dim)">No matching standards found</p>';
    searchResults.classList.remove('hidden');
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
  const insight = STANDARDS_DB.Failure_Modes[type];
  if (!insight) return;

  aiExpert.classList.remove('hidden');
  aiExpertContent.innerHTML = `
    <div class="insight-card">
      <span class="insight-tag">Issue: ${type.replace(/_/g, ' ')}</span>
      <p><strong>Expert Explanation:</strong> ${insight.Explanation}</p>
      <p style="color: var(--color-text-dim); font-size: 0.875rem;"><strong>Reg Ref:</strong> ${insight.Regulatory_Ref}</p>
      <p style="color: var(--color-success); font-size: 0.875rem; margin-top: 1rem;"><strong>Recommended Action:</strong> ${insight.Action}</p>
    </div>
  `;
  aiExpert.scrollIntoView({ behavior: 'smooth' });
}

function renderDashboard(data, fileName) {
  dashboard.classList.remove('hidden');
  runDateEl.textContent = data.run_date || 'Unknown Date';
  jobRefEl.textContent = `Job: ${data.job_reference || 'Unreferenced'}`;
  fileNameEl.textContent = `File: ${data.input_file || fileName}`;

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
        ${!isPass ? `<button class="expert-btn" onclick="window.showAIInsight('Low_ACH')">Ask AI Expert</button>` : ''}
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
