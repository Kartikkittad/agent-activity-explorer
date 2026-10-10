const { pageSize, tickerIntervalMs, tickerVisibleRows, storageKey } = window.APP_CONFIG;

const grid = document.getElementById('agents');
const searchInput = document.getElementById('search');
const resultsList = document.getElementById('results');
const resultsCount = document.getElementById('results-count');
const topbar = document.querySelector('.topbar');
const backToTop = document.getElementById('back-to-top');
const progress = document.getElementById('read-progress');
const tickerToggle = document.getElementById('ticker-toggle');
const preview = document.getElementById('row-preview');
const scrollContext = document.getElementById('scroll-context');

const searchDebounceMs = 150;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Timestamps are UTC ISO strings, so HH:MM:SS is already in there. Calling
// toLocaleTimeString per row built a new Intl formatter every time.
function formatTime(iso) {
  return iso.slice(11, 19);
}

// Everything derived from ACTIVITY is computed once here instead of on every
// keystroke, scroll or mousemove.
const eventsById = new Map();
const callsPerMinute = new Map();
const searchIndex = window.ACTIVITY
  .map((event) => {
    eventsById.set(event.id, event);
    const minute = event.timestamp.slice(11, 16);
    callsPerMinute.set(minute, (callsPerMinute.get(minute) || 0) + 1);
    return {
      event,
      haystack: [event.id, event.timestamp, event.agent, event.tool, event.status, event.latencyMs, event.summary]
        .join(' ')
        .toLowerCase(),
    };
  })
  // ISO timestamps in the same format sort correctly as strings: newest first.
  .sort((a, b) => (a.event.timestamp < b.event.timestamp ? 1 : a.event.timestamp > b.event.timestamp ? -1 : 0));

function countByAgent(events) {
  const counts = {};
  events.forEach((event) => {
    counts[event.agent] = (counts[event.agent] || 0) + 1;
  });
  return counts;
}

function renderAgents() {
  const counts = countByAgent(window.ACTIVITY);
  grid.innerHTML = window.AGENTS.map((agent, index) => {
    const image = 'assets/agents/agent-' + String((index % 12) + 1).padStart(2, '0') + '.webp';
    return (
      '<article class="agent-card">' +
      '<img class="agent-avatar" src="' + image + '" alt="" width="48" height="48" loading="lazy" decoding="async">' +
      '<h3>' + escapeHtml(agent.name) + '</h3>' +
      '<p class="agent-owner">' + escapeHtml(agent.owner) + '</p>' +
      '<p class="agent-description">' + escapeHtml(agent.description) + '</p>' +
      '<p class="agent-count">' + (counts[agent.name] || 0).toLocaleString() + ' calls today</p>' +
      '</article>'
    );
  }).join('');
}

function loadViewed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'));
  } catch {
    return new Set();
  }
}

const viewed = loadViewed();

function rememberViewed(items) {
  const before = viewed.size;
  items.forEach((item) => viewed.add(item.id));
  if (viewed.size !== before) {
    localStorage.setItem(storageKey, JSON.stringify([...viewed]));
  }
}

function search(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return searchIndex;
  return searchIndex.filter((entry) => entry.haystack.includes(needle));
}

function renderResults(query) {
  const matches = search(query);
  const page = matches.slice(0, pageSize).map((entry) => entry.event);
  resultsCount.textContent = matches.length.toLocaleString() + ' matching tool calls';
  resultsList.innerHTML = page.map((event) => {
    const isNew = !viewed.has(event.id);
    return (
      '<li class="result-row status-' + event.status + '" data-id="' + event.id + '" data-minute="' + event.timestamp.slice(11, 16) + '">' +
      '<span class="result-time">' + formatTime(event.timestamp) + '</span>' +
      '<span class="result-agent">' + escapeHtml(event.agent) + '</span>' +
      '<span class="result-tool">' + escapeHtml(event.tool) + '</span>' +
      '<span class="result-status">' + event.status + '</span>' +
      '<span class="result-latency">' + event.latencyMs + ' ms</span>' +
      '<span class="result-summary">' + escapeHtml(event.summary) + '</span>' +
      (isNew ? '<span class="badge-new">New</span>' : '') +
      '</li>'
    );
  }).join('');
  rememberViewed(page);
  observeRows();
}

let searchTimer = 0;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => renderResults(searchInput.value), searchDebounceMs);
}

// The "in focus" band is 30%–60% down the viewport. An IntersectionObserver
// tells us when rows enter or leave it, so scrolling never measures rows.
const focusObserver = new IntersectionObserver(onFocusChange, { rootMargin: '-30% 0px -40% 0px' });

function observeRows() {
  focusObserver.disconnect();
  resultsList.querySelectorAll('.result-row').forEach((row) => focusObserver.observe(row));
  updateScrollContext();
}

function onFocusChange(entries) {
  entries.forEach((entry) => entry.target.classList.toggle('in-focus', entry.isIntersecting));
  updateScrollContext();
}

function updateScrollContext() {
  const focused = resultsList.querySelector('.in-focus');
  if (focused) {
    const minute = focused.dataset.minute;
    scrollContext.textContent = minute + ' UTC · ' + (callsPerMinute.get(minute) || 0) + ' calls that minute';
  } else {
    scrollContext.textContent = '';
  }
}

let scrollFrame = 0;
function onScroll() {
  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    const scrolled = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? scrolled / max : 0) + ')';
    topbar.classList.toggle('topbar-raised', scrolled > 8);
    backToTop.classList.toggle('visible', scrolled > window.innerHeight);
  });
}

let previewFrame = 0;
let pendingPreview = null;

function hidePreview() {
  cancelAnimationFrame(previewFrame);
  previewFrame = 0;
  preview.hidden = true;
}

function showPreview(event) {
  pendingPreview = event;
  if (previewFrame) return;
  previewFrame = requestAnimationFrame(() => {
    previewFrame = 0;
    const row = pendingPreview.target.closest('.result-row');
    if (!row) return;
    const item = eventsById.get(row.dataset.id);
    if (!item) return;
    if (preview.textContent !== item.summary) preview.textContent = item.summary;
    preview.style.transform = 'translate(' + (pendingPreview.clientX + 12) + 'px, ' + (pendingPreview.clientY + 12) + 'px)';
    preview.hidden = false;
  });
}

let tickerPanel = null;
let tickerTimer = 0;

function tickerRow(event) {
  const row = document.createElement('li');
  row.className = 'ticker-row status-' + event.status;
  row.innerHTML =
    '<span class="ticker-time">' + formatTime(event.timestamp) + '</span>' +
    '<span class="ticker-agent">' + escapeHtml(event.agent) + '</span>' +
    '<span class="ticker-tool">' + escapeHtml(event.tool) + '</span>';
  return row;
}

function positionTicker() {
  if (!tickerPanel) return;
  tickerPanel.style.maxHeight = window.innerHeight - 120 + 'px';
}

function openTicker() {
  if (tickerPanel) return;
  const panel = document.createElement('aside');
  panel.className = 'ticker';
  panel.innerHTML = '<header class="ticker-header">Live tool calls</header><ul class="ticker-list"></ul>';
  document.body.appendChild(panel);
  tickerPanel = panel;
  const list = panel.querySelector('.ticker-list');

  tickerTimer = setInterval(() => {
    const event = window.ACTIVITY[Math.floor(Math.random() * window.ACTIVITY.length)];
    list.prepend(tickerRow(event));
    while (list.children.length > tickerVisibleRows) {
      list.lastElementChild.remove();
    }
  }, tickerIntervalMs);

  positionTicker();
  tickerToggle.setAttribute('aria-pressed', 'true');
  tickerToggle.textContent = 'Hide live calls';
}

function closeTicker() {
  if (!tickerPanel) return;
  clearInterval(tickerTimer);
  tickerTimer = 0;
  tickerPanel.remove();
  tickerPanel = null;
  tickerToggle.setAttribute('aria-pressed', 'false');
  tickerToggle.textContent = 'Show live calls';
}

searchInput.addEventListener('input', onSearchInput);
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', positionTicker);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTicker();
});
resultsList.addEventListener('mousemove', showPreview);
resultsList.addEventListener('mouseleave', hidePreview);
resultsList.addEventListener('wheel', hidePreview, { passive: true });
resultsList.addEventListener('touchstart', hidePreview, { passive: true });
backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
tickerToggle.addEventListener('click', () => (tickerPanel ? closeTicker() : openTicker()));

renderAgents();
renderResults('');
