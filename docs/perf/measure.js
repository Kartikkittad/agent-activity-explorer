// Usage: node measure.js <url> <label>
const puppeteer = require('puppeteer-core');
const url = process.argv[2] || 'http://localhost:5199/';
const label = process.argv[3] || 'run';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    args: ['--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const cdp = await page.createCDPSession();
  await cdp.send('Performance.enable');
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  // ~ "Fast 4G": 9 Mbps down, 40 ms RTT
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 40, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8,
  });

  let bytes = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });

  await page.evaluateOnNewDocument(() => {
    localStorage.clear();
    window.__lcp = 0; window.__cls = 0; window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; })).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
  });

  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));

  await page.goto(url, { waitUntil: 'networkidle0' });
  await sleep(500);
  const load = await page.evaluate(() => {
    const fcp = performance.getEntriesByName('first-contentful-paint')[0];
    return {
      fcpMs: Math.round(fcp ? fcp.startTime : -1),
      lcpMs: Math.round(window.__lcp),
      cls: +window.__cls.toFixed(3),
      longestTaskMs: Math.round(Math.max(0, ...window.__long)),
    };
  });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  // Search: time a typed query, char by char, including the layout it causes.
  const typeQuery = (q) => page.evaluate(async (q) => {
    const input = document.getElementById('search');
    const t0 = performance.now();
    let worst = 0;
    for (let i = 1; i <= q.length; i++) {
      const s = performance.now();
      input.value = q.slice(0, i);
      input.dispatchEvent(new Event('input'));
      document.body.offsetHeight; // flush layout so it is counted
      worst = Math.max(worst, performance.now() - s);
    }
    await new Promise((r) => setTimeout(r, 400)); // let any debounce fire
    document.body.offsetHeight;
    return { totalMs: Math.round(performance.now() - t0), worstKeyMs: Math.round(worst) };
  }, q);

  const search1 = await typeQuery('billing');
  // Simulate a session of 30 searches to grow the "viewed" list.
  const words = ['sql', 'fs.', 'slack', 'jira', 'email', 'shell', 'acme', 'priya', 'jonas', 'maria', 'kenji', 'amara', 'liam', 'support', 'code',
    'sales', 'hr-', 'incident', 'data', 'contract', 'qa-', 'security', 'marketing', 'travel', 'release', 'it-', 'pricing', 'translation', 'compliance', 'capacity'];
  for (const w of words) await typeQuery(w);
  const searchLate = await typeQuery('billing');
  const viewedBytes = await page.evaluate(() => (localStorage.getItem('activity:viewed') || '').length);
  await typeQuery('');

  // Scroll: 60 scroll steps, time the handler work + layouts.
  await page.evaluate(() => window.scrollTo(0, document.querySelector('#results').offsetTop - 200));
  await sleep(300);
  let m0 = await metrics();
  const scroll = await page.evaluate(async () => {
    const times = [];
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const s = performance.now();
      window.scrollBy(0, 40);
      window.dispatchEvent(new Event('scroll'));
      await new Promise((r) => requestAnimationFrame(r)); // rAF-throttled handlers run here
      document.body.offsetHeight;
      times.push(performance.now() - s);
    }
    times.sort((a, b) => a - b);
    return { medianFrameMs: +times[30].toFixed(1), p95FrameMs: +times[57].toFixed(1) };
  });
  let m1 = await metrics();
  scroll.layouts = m1.LayoutCount - m0.LayoutCount;

  // Resize
  const resize = await page.evaluate(() => {
    const s = performance.now();
    for (let i = 0; i < 5; i++) { window.dispatchEvent(new Event('resize')); document.body.offsetHeight; }
    return { fiveResizesMs: Math.round(performance.now() - s) };
  });

  // Hover preview
  const hover = await page.evaluate(async () => {
    const rows = document.querySelectorAll('.result-row');
    const s = performance.now();
    for (let i = 0; i < 100; i++) {
      const row = rows[i % rows.length];
      const r = row.getBoundingClientRect();
      row.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left + 200, clientY: r.top + 5 }));
    }
    await new Promise((r) => requestAnimationFrame(r));
    document.body.offsetHeight;
    return { hundredMovesMs: Math.round(performance.now() - s) };
  });

  // Idle: marquee cost over 3 s with nothing else happening.
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  m0 = await metrics();
  await sleep(3000);
  m1 = await metrics();
  const idle = { layoutsIn3s: m1.LayoutCount - m0.LayoutCount, styleRecalcsIn3s: m1.RecalcStyleCount - m0.RecalcStyleCount };

  // Ticker: open/close 5 times, then measure what keeps running.
  await page.evaluate(async () => {
    const btn = document.getElementById('ticker-toggle');
    for (let i = 0; i < 5; i++) { btn.click(); await new Promise((r) => setTimeout(r, 600)); btn.click(); }
  });
  await sleep(500);
  m0 = await metrics();
  await sleep(5000);
  m1 = await metrics();
  const ticker = {
    listeners: m1.JSEventListeners,
    detachedNodeGrowthIn5s: m1.Nodes - m0.Nodes,
    scriptMsIn5sAfterClose: Math.round((m1.ScriptDuration - m0.ScriptDuration) * 1000),
  };

  console.log(JSON.stringify({ label, load: { ...load, transferredKB: Math.round(bytes / 1024) }, search1, searchLate, viewedBytes, scroll, resize, hover, idle, ticker }, null, 2));
  await browser.close();
})();
