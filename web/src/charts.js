// Hand-built SVG charts. No chart library, so every mark follows the dataviz spec directly.
// Colours come from CSS custom properties defined in style.css (.viz-root).
const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
};
const fmt = (v, d = 1) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(d));

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

function tooltipFor(host) {
  let tip = host.querySelector('.tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'status');
    host.appendChild(tip);
  }
  return tip;
}

// Generic line chart with crosshair, optional bands and markers.
// cfg: { host, series:[{name,color,values,dash,width,labelEnd}], n, xTick(i)->string, xEvery, yMax, yTitle,
//        bands:[{y0,y1,cls,label}], markers:[{i,label,series}], cursor, onCursor(i), extra(svg, sx, sy), tipRows(i)->[{name,color,text}] }
export function lineChart(cfg) {
  const host = cfg.host;
  host.querySelectorAll('svg').forEach((s) => s.remove());
  const W = host.clientWidth || 640;
  const H = cfg.height || 280;
  const m = { l: 44, r: cfg.rightPad ?? 96, t: 12, b: 34 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const n = cfg.n;
  const yMax = cfg.yMax || niceMax(Math.max(...cfg.series.flatMap((s) => s.values.filter((v) => v != null))) * 1.08);
  const sx = (i) => m.l + (n <= 1 ? 0 : (i / (n - 1)) * iw);
  const sy = (v) => m.t + ih - (v / yMax) * ih;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': cfg.aria || cfg.yTitle });
  host.insertBefore(svg, host.firstChild);

  (cfg.bands || []).forEach((b) => {
    el('rect', { x: m.l, y: sy(Math.min(b.y1, yMax)), width: iw, height: Math.max(0, sy(b.y0) - sy(Math.min(b.y1, yMax))), class: `band ${b.cls}` }, svg);
    const t = el('text', { x: m.l + iw + 8, y: (sy(b.y0) + sy(Math.min(b.y1, yMax))) / 2 + 4, class: 'axis-label' }, svg);
    t.textContent = b.label;
  });
  const ticks = cfg.yTicks || Array.from({ length: 5 }, (_, k) => (yMax * k) / 4);
  ticks.forEach((v) => {
    el('line', { x1: m.l, x2: m.l + iw, y1: sy(v), y2: sy(v), class: 'grid' }, svg);
    const t = el('text', { x: m.l - 8, y: sy(v) + 4, class: 'axis-label', 'text-anchor': 'end' }, svg);
    t.textContent = fmt(v, v < 10 && v % 1 ? 1 : 0);
  });
  el('line', { x1: m.l, x2: m.l + iw, y1: sy(0), y2: sy(0), class: 'axis' }, svg);
  const every = cfg.xEvery || 1;
  for (let i = 0; i < n; i += every) {
    const t = el('text', { x: sx(i), y: H - 12, class: 'axis-label', 'text-anchor': 'middle' }, svg);
    t.textContent = cfg.xTick(i);
  }
  if (cfg.yTitle) {
    const t = el('text', { x: m.l, y: m.t - 2, class: 'axis-title' }, svg);
    t.textContent = cfg.yTitle;
  }
  if (cfg.extra) cfg.extra(svg, sx, sy, { m, iw, ih, W, H });

  const labels = [];
  cfg.series.forEach((s, si) => {
    const pts = s.values.map((v, i) => (v == null ? null : [sx(i), sy(v)]));
    let d = '';
    pts.forEach((p, i) => {
      if (!p) return;
      d += (i === 0 || !pts[i - 1] ? 'M' : 'L') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    });
    el('path', { d, class: 'line', stroke: s.color, 'stroke-width': s.width || 2, 'stroke-dasharray': s.dash || 'none', opacity: s.opacity ?? 1, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    if (s.labelEnd) {
      const last = [...s.values].reverse().findIndex((v) => v != null);
      const li = s.values.length - 1 - last;
      labels.push({ x: sx(li) + 8, y: sy(s.values[li]) + 4, name: s.name });
    }
  });
  // de-collide direct labels: keep at least 13 px apart
  labels.sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k++) if (labels[k].y - labels[k - 1].y < 13) labels[k].y = labels[k - 1].y + 13;
  labels.forEach((l) => {
    const t = el('text', { x: l.x, y: l.y, class: 'series-label' }, svg);
    t.textContent = l.name;
  });
  (cfg.markers || []).forEach((mk) => {
    const x = sx(mk.i);
    const y = mk.v != null ? sy(mk.v) : m.t + 6;
    el('circle', { cx: x, cy: y, r: 5, fill: mk.color || 'var(--text-primary)', stroke: 'var(--surface-1)', 'stroke-width': 2 }, svg);
    if (mk.label) {
      const t = el('text', { x: x, y: y - 10, class: 'marker-label', 'text-anchor': 'middle' }, svg);
      t.textContent = mk.label;
    }
  });

  const cur = el('line', { y1: m.t, y2: m.t + ih, class: 'cursor', x1: 0, x2: 0, visibility: 'hidden' }, svg);
  const hover = el('line', { y1: m.t, y2: m.t + ih, class: 'hover', x1: 0, x2: 0, visibility: 'hidden' }, svg);
  const dots = cfg.series.map((s) => el('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface-1)', 'stroke-width': 2, visibility: 'hidden' }, svg));
  const tip = tooltipFor(host);
  const hit = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', tabindex: 0, 'aria-label': `${cfg.aria || 'chart'}: use arrow keys to inspect, Enter to set the time cursor` }, svg);
  let kb = Math.round((n - 1) / 2);
  const show = (i) => {
    i = Math.max(0, Math.min(n - 1, i));
    hover.setAttribute('x1', sx(i));
    hover.setAttribute('x2', sx(i));
    hover.setAttribute('visibility', 'visible');
    cfg.series.forEach((s, k) => {
      if (s.values[i] == null) return dots[k].setAttribute('visibility', 'hidden');
      dots[k].setAttribute('cx', sx(i));
      dots[k].setAttribute('cy', sy(s.values[i]));
      dots[k].setAttribute('visibility', 'visible');
    });
    const rows = cfg.tipRows(i);
    tip.innerHTML = `<div class="tip-h">${rows.title}</div>` + rows.rows.map((r) => `<div class="tip-r"><span class="sw" style="background:${r.color}"></span><span>${r.name}</span><b>${r.text}</b></div>`).join('');
    tip.style.display = 'block';
    const tw = tip.offsetWidth;
    let left = sx(i) + 14;
    if (left + tw > W - 4) left = sx(i) - tw - 14;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = m.t + 6 + 'px';
  };
  const hide = () => {
    hover.setAttribute('visibility', 'hidden');
    dots.forEach((d) => d.setAttribute('visibility', 'hidden'));
    tip.style.display = 'none';
  };
  const idx = (ev) => Math.round(((ev.clientX - svg.getBoundingClientRect().left) / (svg.getBoundingClientRect().width / W) - m.l) / iw * (n - 1));
  hit.addEventListener('pointermove', (ev) => show(idx(ev)));
  hit.addEventListener('pointerleave', hide);
  hit.addEventListener('click', (ev) => cfg.onCursor && cfg.onCursor(Math.max(0, Math.min(n - 1, idx(ev)))));
  hit.addEventListener('focus', () => show(kb));
  hit.addEventListener('blur', hide);
  hit.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') (kb = Math.min(n - 1, kb + 1)), show(kb), ev.preventDefault();
    else if (ev.key === 'ArrowLeft') (kb = Math.max(0, kb - 1)), show(kb), ev.preventDefault();
    else if (ev.key === 'Enter' && cfg.onCursor) cfg.onCursor(kb);
  });
  return {
    setCursor(i) {
      if (i == null) return cur.setAttribute('visibility', 'hidden');
      cur.setAttribute('x1', sx(i));
      cur.setAttribute('x2', sx(i));
      cur.setAttribute('visibility', 'visible');
    },
  };
}

// Grouped horizontal bars: one group per category, two bars (captured / logged).
export function groupedBars(cfg) {
  const host = cfg.host;
  host.querySelectorAll('svg').forEach((s) => s.remove());
  const W = host.clientWidth || 520;
  const rowH = 54;
  const m = { l: 92, r: 70, t: 8, b: 26 };
  const H = m.t + m.b + rowH * cfg.cats.length;
  const iw = W - m.l - m.r;
  const max = niceMax(Math.max(...cfg.cats.flatMap((c) => c.values)) * 1.02);
  const sx = (v) => m.l + (v / max) * iw;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': cfg.aria }, host);
  host.insertBefore(svg, host.firstChild);
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    el('line', { x1: sx(v), x2: sx(v), y1: m.t, y2: H - m.b, class: 'grid' }, svg);
    const t = el('text', { x: sx(v), y: H - 8, class: 'axis-label', 'text-anchor': 'middle' }, svg);
    t.textContent = fmt(v, max < 10 ? 1 : 0);
  }
  const tip = tooltipFor(host);
  cfg.cats.forEach((c, i) => {
    const y0 = m.t + i * rowH;
    const t = el('text', { x: m.l - 10, y: y0 + rowH / 2 + 4, class: 'axis-label', 'text-anchor': 'end' }, svg);
    t.textContent = c.label;
    c.values.forEach((v, k) => {
      const bh = 14;
      const y = y0 + 8 + k * (bh + 4);
      const w = Math.max(2, sx(v) - m.l);
      // rounded data-end, square at the baseline
      const r = Math.min(4, w / 2);
      const d = `M${m.l} ${y} H${m.l + w - r} a${r} ${r} 0 0 1 ${r} ${r} V${y + bh - r} a${r} ${r} 0 0 1 ${-r} ${r} H${m.l} Z`;
      const p = el('path', { d, fill: cfg.colors[k], class: 'bar' }, svg);
      const lab = el('text', { x: m.l + w + 6, y: y + bh - 3, class: 'value-label' }, svg);
      lab.textContent = fmt(v, max < 10 ? 1 : 0);
      const hitr = el('rect', { x: m.l, y: y - 2, width: iw, height: bh + 4, fill: 'transparent' }, svg);
      hitr.addEventListener('pointermove', (ev) => {
        const rect = host.getBoundingClientRect();
        tip.innerHTML = `<div class="tip-h">${c.label}</div><div class="tip-r"><span class="sw" style="background:${cfg.colors[k]}"></span><span>${cfg.names[k]}</span><b>${c.tip[k]}</b></div>`;
        tip.style.display = 'block';
        tip.style.left = Math.min(W - tip.offsetWidth - 4, ev.clientX - rect.left + 12) + 'px';
        tip.style.top = ev.clientY - rect.top + 12 + 'px';
      });
      hitr.addEventListener('pointerleave', () => (tip.style.display = 'none'));
    });
  });
}

// Single stacked horizontal bar with gaps (loss tree).
export function stackBar(cfg) {
  const host = cfg.host;
  host.querySelectorAll('svg').forEach((s) => s.remove());
  const W = host.clientWidth || 520;
  const H = 130;
  const m = { l: 6, r: 6, t: 34, b: 8 };
  const iw = W - m.l - m.r;
  const total = cfg.items.reduce((a, b) => a + b.v, 0);
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': cfg.aria });
  host.insertBefore(svg, host.firstChild);
  let x = m.l;
  const bh = 34;
  cfg.items.forEach((it, i) => {
    const w = (it.v / total) * iw;
    const gap = i ? 2 : 0;
    const r = el('rect', { x: x + gap, y: m.t, width: Math.max(1, w - gap), height: bh, rx: i === 0 || i === cfg.items.length - 1 ? 4 : 0, fill: it.color }, svg);
    const t = el('text', { x: x + gap + 2, y: m.t - 8, class: 'axis-label' }, svg);
    t.textContent = it.short;
    const t2 = el('text', { x: x + gap + 2, y: m.t + bh + 22, class: 'value-label' }, svg);
    t2.textContent = `${fmt(it.v)} h`;
    r.addEventListener('pointermove', () => {});
    el('title', {}, r).textContent = `${it.label}: ${fmt(it.v)} h (${((it.v / total) * 100).toFixed(0)}%)`;
    x += w;
  });
}
