/* ==========================================================================
   PATELA — INTERACTIVE FINANCIAL CHARTS & ANALYTICS ENGINE (analytics.js)
   SVG Line, Bar & Donut Charts · Interactive Tooltips · Role-Aware Analytics
   ========================================================================== */

(function () {
  let tooltipEl = null;

  function ensureTooltip() {
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'patela-chart-tooltip';
      tooltipEl.className = 'chart-tooltip';
      document.body.appendChild(tooltipEl);
    }
    return tooltipEl;
  }

  function showTooltip(evt, data) {
    const el = ensureTooltip();
    el.innerHTML =
      '<div class="chart-tooltip-label">' + window.PatelaUI.escapeHtml(data.title || '') + '</div>' +
      '<div class="chart-tooltip-val">' + window.PatelaUI.escapeHtml(data.value || '') + '</div>' +
      (data.sub ? '<div class="chart-tooltip-meta">' + window.PatelaUI.escapeHtml(data.sub) + '</div>' : '') +
      (data.extra ? '<div class="chart-tooltip-meta" style="color:var(--gold);margin-top:2px;">' + window.PatelaUI.escapeHtml(data.extra) + '</div>' : '');
    el.classList.add('visible');
    moveTooltip(evt);
  }

  function moveTooltip(evt) {
    if (!tooltipEl || !tooltipEl.classList.contains('visible')) return;
    const pad = 14;
    let x = evt.clientX + pad;
    let y = evt.clientY - 24;
    const rect = tooltipEl.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 12) {
      x = evt.clientX - rect.width - pad;
    }
    if (y < 12) {
      y = evt.clientY + pad;
    }
    tooltipEl.style.left = x + 'px';
    tooltipEl.style.top = y + 'px';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.classList.remove('visible');
  }

  function formatAssetAmount(num, asset) {
    const n = Number(num) || 0;
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (asset || 'USDC');
  }

  /* ========================================================================
     REUSABLE SVG LINE / BAR TIME-SERIES CHART
     ======================================================================== */
  function renderTimeSeriesChart(container, points, opts) {
    if (!container) return;
    opts = opts || {};
    const mode = opts.mode || 'line'; // 'line' | 'bar'
    const asset = opts.asset || 'USDC';
    const primaryColor = opts.color || '#D9BD8B';

    if (!points || points.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-title">No financial data for this range</div>' +
          '<div class="empty-desc">Select another time range to inspect historical activity.</div>' +
        '</div>';
      return;
    }

    const width = 760;
    const height = 240;
    const padLeft = 58;
    const padRight = 24;
    const padTop = 20;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxValRaw = Math.max.apply(null, points.map(function (p) { return Number(p.amount) || 0; }));
    const maxVal = maxValRaw > 0 ? Math.ceil(maxValRaw / 500) * 500 : 1000;

    // 4 horizontal grid lines
    const gridSteps = [0, 0.333, 0.666, 1];
    const gridHtml = gridSteps.map(function (step) {
      const val = Math.round(maxVal * (1 - step));
      const y = Math.round(padTop + step * plotH);
      return (
        '<g>' +
          '<line x1="' + padLeft + '" y1="' + y + '" x2="' + (width - padRight) + '" y2="' + y + '" stroke="rgba(255,255,255,0.055)" stroke-dasharray="3 3" />' +
          '<text x="' + (padLeft - 10) + '" y="' + (y + 4) + '" text-anchor="end" fill="#647084" font-size="11" font-family="JetBrains Mono, monospace">' +
            '$' + val.toLocaleString('en-US') +
          '</text>' +
        '</g>'
      );
    }).join('');

    const coords = points.map(function (pt, idx) {
      const x = points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (points.length - 1)) * plotW;
      const ratio = maxVal > 0 ? (Number(pt.amount) || 0) / maxVal : 0;
      const y = padTop + plotH - ratio * plotH;
      return { x: x, y: y, pt: pt, idx: idx };
    });

    let visualBody = '';

    if (mode === 'bar') {
      const slotW = plotW / points.length;
      const barW = Math.min(44, Math.max(18, slotW * 0.56));
      visualBody = coords.map(function (c, i) {
        const bx = padLeft + i * slotW + (slotW - barW) / 2;
        const barH = Math.max(4, padTop + plotH - c.y);
        const by = padTop + plotH - barH;
        const isZero = (Number(c.pt.amount) || 0) === 0;
        return (
          '<g class="chart-bar-group" data-pt-idx="' + i + '" style="cursor:pointer;">' +
            '<rect x="' + (padLeft + i * slotW) + '" y="' + padTop + '" width="' + slotW + '" height="' + plotH + '" fill="transparent" />' +
            '<rect class="chart-bar-animated" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + barH.toFixed(1) + '" rx="4" fill="' + (isZero ? 'rgba(255,255,255,0.08)' : 'url(#patelaBarGrad)') + '" />' +
            '<text x="' + (bx + barW / 2).toFixed(1) + '" y="' + (height - 12) + '" text-anchor="middle" fill="#9CA6B8" font-size="11">' +
              window.PatelaUI.escapeHtml(c.pt.label) +
            '</text>' +
          '</g>'
        );
      }).join('');
    } else {
      // Smooth line + area gradient
      const linePoints = coords.map(function (c) { return c.x.toFixed(1) + ',' + c.y.toFixed(1); }).join(' ');
      const areaPoints =
        coords[0].x.toFixed(1) + ',' + (padTop + plotH) + ' ' +
        linePoints + ' ' +
        coords[coords.length - 1].x.toFixed(1) + ',' + (padTop + plotH);

      const dotsAndLabels = coords.map(function (c, i) {
        return (
          '<g class="chart-point-group" data-pt-idx="' + i + '" style="cursor:pointer;">' +
            '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="16" fill="transparent" />' +
            '<circle class="chart-point-hit" cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) + '" r="4.5" fill="#0E1520" stroke="' + primaryColor + '" stroke-width="2.2" />' +
            '<text x="' + c.x.toFixed(1) + '" y="' + (height - 12) + '" text-anchor="middle" fill="#9CA6B8" font-size="11">' +
              window.PatelaUI.escapeHtml(c.pt.label) +
            '</text>' +
          '</g>'
        );
      }).join('');

      visualBody =
        '<polygon points="' + areaPoints + '" fill="url(#patelaAreaGrad)" />' +
        '<polyline class="chart-line-animated" fill="none" stroke="' + primaryColor + '" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="' + linePoints + '" />' +
        dotsAndLabels;
    }

    container.innerHTML =
      '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Financial performance chart">' +
        '<defs>' +
          '<linearGradient id="patelaAreaGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="' + primaryColor + '" stop-opacity="0.24" />' +
            '<stop offset="100%" stop-color="' + primaryColor + '" stop-opacity="0.0" />' +
          '</linearGradient>' +
          '<linearGradient id="patelaBarGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="#F2D9A9" />' +
            '<stop offset="100%" stop-color="#D9BD8B" stop-opacity="0.72" />' +
          '</linearGradient>' +
        '</defs>' +
        gridHtml +
        visualBody +
      '</svg>';

    container.querySelectorAll('[data-pt-idx]').forEach(function (el) {
      const idx = Number(el.getAttribute('data-pt-idx'));
      const pt = points[idx];
      if (!pt) return;
      function triggerPtTooltip(e) {
        const countLabel = pt.payments !== undefined
          ? pt.payments + (pt.payments === 1 ? ' payment' : ' payments')
          : (pt.txCount !== undefined ? pt.txCount + (pt.txCount === 1 ? ' transaction' : ' transactions') : '');
        const evtObj = (e.touches && e.touches[0]) ? e.touches[0] : e;
        showTooltip(evtObj, {
          title: pt.label,
          value: formatAssetAmount(pt.amount, asset),
          sub: (countLabel ? countLabel + ' · ' : '') + (pt.note || ''),
          extra: pt.prevDiff || ''
        });
      }
      el.addEventListener('mouseenter', triggerPtTooltip);
      el.addEventListener('click', triggerPtTooltip);
      el.addEventListener('mousemove', moveTooltip);
      el.addEventListener('mouseleave', hideTooltip);
    });
  }

  /* ========================================================================
     INTERACTIVE DONUT CHART WITH CLICKABLE DRILLDOWN
     ======================================================================== */
  function renderInteractiveDonut(svgContainer, legendContainer, drilldownContainer, categories, totalLabel) {
    if (!svgContainer || !legendContainer) return;

    const total = categories.reduce(function (acc, c) { return acc + (Number(c.amount) || 0); }, 0);
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let activeCatId = categories[0] ? categories[0].id : null;

    function draw() {
      let cumulativePercent = 0;
      const slicesSvg = categories.map(function (cat) {
        const pct = total > 0 ? cat.amount / total : 0;
        const dash = pct * circumference;
        const gap = Math.max(0, circumference - dash);
        const offset = -cumulativePercent * circumference;
        cumulativePercent += pct;
        const isAct = cat.id === activeCatId;
        return (
          '<circle class="donut-slice ' + (isAct ? 'active' : '') + '" ' +
            'data-cat-id="' + cat.id + '" ' +
            'cx="95" cy="95" r="' + radius + '" ' +
            'fill="transparent" ' +
            'stroke="' + cat.color + '" ' +
            'stroke-width="' + (isAct ? '23' : '18') + '" ' +
            'stroke-dasharray="' + dash.toFixed(2) + ' ' + gap.toFixed(2) + '" ' +
            'stroke-dashoffset="' + offset.toFixed(2) + '" ' +
            'transform="rotate(-90 95 95)" />'
        );
      }).join('');

      const activeCat = categories.find(function (c) { return c.id === activeCatId; }) || categories[0];

      svgContainer.innerHTML =
        '<svg viewBox="0 0 190 190" width="190" height="190" aria-label="Spending breakdown donut chart">' +
          '<circle cx="95" cy="95" r="' + radius + '" fill="transparent" stroke="rgba(255,255,255,0.04)" stroke-width="18" />' +
          slicesSvg +
        '</svg>' +
        '<div class="donut-center-label">' +
          '<span class="meta-text" style="font-size:0.68rem;">' + window.PatelaUI.escapeHtml(activeCat ? activeCat.name : totalLabel) + '</span>' +
          '<span class="tabular" style="font-family:var(--font-display);font-size:1rem;font-weight:600;color:var(--text-primary);margin-top:2px;">$' +
            (activeCat ? activeCat.amount.toLocaleString('en-US') : total.toLocaleString('en-US')) +
          '</span>' +
          '<span class="meta-text" style="color:var(--gold-light);font-size:0.7rem;">' +
            (activeCat ? activeCat.percent + '% of total' : 'USDC') +
          '</span>' +
        '</div>';

      legendContainer.innerHTML = categories.map(function (cat) {
        const isAct = cat.id === activeCatId;
        return (
          '<button type="button" class="donut-legend-item ' + (isAct ? 'active' : '') + '" data-cat-id="' + cat.id + '">' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<span class="legend-swatch" style="background:' + cat.color + ';"></span>' +
              '<span style="font-size:0.8125rem;font-weight:500;color:var(--text-primary);">' + window.PatelaUI.escapeHtml(cat.name) + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
              '<span class="tabular" style="font-size:0.8125rem;color:var(--text-primary);">$' + cat.amount.toLocaleString('en-US') + ' USDC</span>' +
              '<span class="badge badge-neutral" style="min-width:48px;justify-content:center;">' + cat.percent + '%</span>' +
            '</div>' +
          '</button>'
        );
      }).join('');

      if (drilldownContainer && activeCat) {
        drilldownContainer.innerHTML =
          '<div class="card-elevated" style="margin-top:14px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span class="meta-text" style="color:var(--gold-light);font-weight:500;">' + window.PatelaUI.escapeHtml(activeCat.name) + ' — Allocated Projects</span>' +
              '<span class="meta-text tabular">' + formatAssetAmount(activeCat.amount, 'USDC') + ' (' + activeCat.percent + '%)</span>' +
            '</div>' +
            '<ul style="display:flex;flex-direction:column;gap:5px;font-size:0.8125rem;color:var(--text-secondary);">' +
              (activeCat.projects || []).map(function (p) {
                return '<li>• ' + window.PatelaUI.escapeHtml(p) + '</li>';
              }).join('') +
            '</ul>' +
          '</div>';
      }

      svgContainer.querySelectorAll('[data-cat-id]').forEach(function (slice) {
        slice.addEventListener('click', function () {
          activeCatId = slice.getAttribute('data-cat-id');
          draw();
        });
        slice.addEventListener('mouseenter', function (e) {
          const c = categories.find(function (item) { return item.id === slice.getAttribute('data-cat-id'); });
          if (!c) return;
          showTooltip(e, {
            title: c.name,
            value: formatAssetAmount(c.amount, 'USDC'),
            sub: c.percent + '% of $' + total.toLocaleString('en-US') + ' total spending',
            extra: 'Click to inspect projects'
          });
        });
        slice.addEventListener('mousemove', moveTooltip);
        slice.addEventListener('mouseleave', hideTooltip);
      });

      legendContainer.querySelectorAll('[data-cat-id]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          activeCatId = btn.getAttribute('data-cat-id');
          draw();
        });
      });
    }

    draw();
  }

  /* ========================================================================
     DEDICATED ANALYTICS PAGE CONTROLLER (analytics.html)
     ======================================================================== */
  function initAnalyticsPage() {
    const root = document.getElementById('analytics-page-root');
    if (!root) return;

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();

    const titleEl = document.getElementById('analytics-page-title');
    const subEl = document.getElementById('analytics-page-subtitle');
    const clientView = document.getElementById('client-analytics-view');
    const workerView = document.getElementById('worker-analytics-view');

    if (role === 'worker') {
      if (titleEl) titleEl.textContent = 'Earnings & Performance Analytics';
      if (subEl) subEl.textContent = 'Track your settled earnings, contract-secured escrow balances, payout history, and milestone delivery performance.';
      if (clientView) clientView.style.display = 'none';
      if (workerView) workerView.style.display = 'block';
      initWorkerAnalytics(state);
    } else {
      if (titleEl) titleEl.textContent = 'Financial & Project Analytics';
      if (subEl) subEl.textContent = 'Monitor total spending over time, category allocation, non-overlapping escrow custody, and project performance.';
      if (workerView) workerView.style.display = 'none';
      if (clientView) clientView.style.display = 'block';
      initClientAnalytics(state);
    }
  }

  /* ------------------------------------------------------------------------
     CLIENT ANALYTICS INITIALISATION
     ------------------------------------------------------------------------ */
  function initClientAnalytics(state) {
    let activeRange = '6m';
    let chartMode = 'line';

    const seriesMap = state.analytics.client.spendingSeries;
    const chartContainer = document.getElementById('client-spending-svg-wrap');
    const rangeTotalEl = document.getElementById('client-chart-period-total');
    const rangeAvgEl = document.getElementById('client-chart-monthly-avg');
    const rangeCompEl = document.getElementById('client-chart-comparison');

    function updateSpendingChart() {
      const current = seriesMap[activeRange] || seriesMap['6m'];
      if (rangeTotalEl) rangeTotalEl.textContent = current.total;
      if (rangeAvgEl) rangeAvgEl.textContent = current.monthlyAvg;
      if (rangeCompEl) rangeCompEl.textContent = current.comparison;

      renderTimeSeriesChart(chartContainer, current.points, {
        mode: chartMode,
        asset: 'USDC',
        color: '#D9BD8B'
      });
    }

    document.querySelectorAll('[data-client-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeRange = btn.getAttribute('data-client-range');
        document.querySelectorAll('[data-client-range]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        updateSpendingChart();
      });
    });

    document.querySelectorAll('[data-client-chart-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        chartMode = btn.getAttribute('data-client-chart-mode');
        document.querySelectorAll('[data-client-chart-mode]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        updateSpendingChart();
      });
    });

    updateSpendingChart();

    // B. Spending Breakdown Donut
    renderInteractiveDonut(
      document.getElementById('client-donut-svg'),
      document.getElementById('client-donut-legend'),
      document.getElementById('client-donut-drilldown'),
      state.analytics.client.categories,
      'Total Allocated'
    );

    // C. Escrow Allocation Stacked Bar Tooltips
    document.querySelectorAll('[data-escrow-seg]').forEach(function (seg) {
      seg.addEventListener('mouseenter', function (e) {
        showTooltip(e, {
          title: seg.getAttribute('data-escrow-title'),
          value: seg.getAttribute('data-escrow-val'),
          sub: seg.getAttribute('data-escrow-desc')
        });
      });
      seg.addEventListener('mousemove', moveTooltip);
      seg.addEventListener('mouseleave', hideTooltip);
    });

    // Progressive Tabs on Client Analytics
    document.querySelectorAll('[data-client-analytics-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = tab.getAttribute('data-client-analytics-tab');
        document.querySelectorAll('[data-client-analytics-tab]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        document.querySelectorAll('[data-client-analytics-panel]').forEach(function (panel) {
          const pName = panel.getAttribute('data-client-analytics-panel');
          panel.style.display = (target === 'all' || pName === target) ? 'block' : 'none';
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     WORKER ANALYTICS INITIALISATION
     ------------------------------------------------------------------------ */
  function initWorkerAnalytics(state) {
    let activeRange = '6m';
    let granularity = 'monthly'; // 'daily' | 'weekly' | 'monthly'

    const seriesMap = state.analytics.worker.earningsSeries;
    const chartContainer = document.getElementById('worker-earnings-svg-wrap');
    const periodTotalEl = document.getElementById('worker-chart-period-total');
    const compEl = document.getElementById('worker-chart-comparison');

    function updateEarningsChart() {
      const current = seriesMap[activeRange] || seriesMap['6m'];
      if (periodTotalEl) periodTotalEl.textContent = current.total;
      if (compEl) compEl.textContent = current.comparison;

      const pts = current[granularity] || current.monthly;
      renderTimeSeriesChart(chartContainer, pts, {
        mode: 'line',
        asset: 'USDC',
        color: '#D9BD8B'
      });
    }

    document.querySelectorAll('[data-worker-range]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeRange = btn.getAttribute('data-worker-range');
        document.querySelectorAll('[data-worker-range]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        updateEarningsChart();
      });
    });

    document.querySelectorAll('[data-worker-granularity]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        granularity = btn.getAttribute('data-worker-granularity');
        document.querySelectorAll('[data-worker-granularity]').forEach(function (b) {
          b.classList.toggle('active', b === btn);
        });
        updateEarningsChart();
      });
    });

    updateEarningsChart();

    // Stacked bar tooltips for Worker Earnings Breakdown
    document.querySelectorAll('[data-worker-seg]').forEach(function (seg) {
      seg.addEventListener('mouseenter', function (e) {
        showTooltip(e, {
          title: seg.getAttribute('data-worker-title'),
          value: seg.getAttribute('data-worker-val'),
          sub: seg.getAttribute('data-worker-desc')
        });
      });
      seg.addEventListener('mousemove', moveTooltip);
      seg.addEventListener('mouseleave', hideTooltip);
    });

    // Payout History Row Clicks -> Full-Screen Transaction Workspace
    document.querySelectorAll('[data-payout-tx]').forEach(function (row) {
      row.addEventListener('click', function () {
        const txId = row.getAttribute('data-payout-tx');
        if (window.PatelaDetail) {
          window.PatelaDetail.openTransaction(txId);
        }
      });
    });

    // Progressive Tabs on Worker Analytics
    document.querySelectorAll('[data-worker-analytics-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = tab.getAttribute('data-worker-analytics-tab');
        document.querySelectorAll('[data-worker-analytics-tab]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        document.querySelectorAll('[data-worker-analytics-panel]').forEach(function (panel) {
          const pName = panel.getAttribute('data-worker-analytics-panel');
          panel.style.display = (target === 'all' || pName === target) ? 'block' : 'none';
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initAnalyticsPage);

  window.PatelaAnalytics = {
    showTooltip: showTooltip,
    moveTooltip: moveTooltip,
    hideTooltip: hideTooltip,
    renderTimeSeriesChart: renderTimeSeriesChart,
    renderInteractiveDonut: renderInteractiveDonut,
    formatAssetAmount: formatAssetAmount
  };
})();

