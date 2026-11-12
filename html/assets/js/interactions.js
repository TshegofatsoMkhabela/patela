/* ==========================================================================
   PATELA — FULL-SCREEN IMMERSIVE DETAIL VIEW SYSTEM & UI HELPERS (interactions.js)
   Full-Viewport Workspaces for Jobs, Projects, Milestones, Transactions & Metrics
   Preserves Previous Page Scroll, Filters & State on Back / Close
   ========================================================================== */

(function () {
  let savedScrollY = 0;
  let navigationStack = [];
  let onCloseCallback = null;

  function ensureToastContainer() {
    let container = document.getElementById('patela-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'patela-toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function toast(title, message) {
    const container = ensureToastContainer();
    const item = document.createElement('div');
    item.className = 'toast';
    item.innerHTML =
      '<div>' +
        '<div class="toast-title">' + escapeHtml(title) + '</div>' +
        (message ? '<div class="toast-msg">' + escapeHtml(message) + '</div>' : '') +
      '</div>' +
      '<button type="button" class="btn-ghost btn-sm" aria-label="Dismiss notification" style="padding:2px 6px;height:auto;">✕</button>';

    function dismiss() {
      item.style.opacity = '0';
      item.style.transform = 'translateY(4px)';
      item.style.transition = 'opacity 160ms ease, transform 160ms ease';
      setTimeout(function () {
        if (item.parentNode) item.remove();
      }, 160);
    }

    item.querySelector('button').addEventListener('click', dismiss);
    container.appendChild(item);
    setTimeout(dismiss, 4200);
  }

  function badgeClass(tone) {
    switch (tone) {
      case 'success': return 'badge badge-success';
      case 'warning': return 'badge badge-warning';
      case 'error': return 'badge badge-error';
      case 'blue': return 'badge badge-blue';
      case 'gold': return 'badge badge-gold';
      default: return 'badge badge-neutral';
    }
  }

  function formatUSD(amount, asset) {
    const num = Number(amount) || 0;
    const formatted = '$' + num.toLocaleString('en-US');
    return asset ? formatted + ' ' + asset : formatted;
  }

  function formatAsset(amount, asset) {
    const num = Number(amount) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + (asset || 'USDC');
  }

  function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPageContextName() {
    const crumb = document.body ? document.body.getAttribute('data-breadcrumb') : null;
    return crumb || 'Dashboard';
  }

  /* ========================================================================
     FULL-SCREEN DETAIL OVERLAY SHELL
     ======================================================================== */
  function ensureFullScreenOverlay() {
    let overlay = document.getElementById('patela-fullscreen-detail');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'patela-fullscreen-detail';
      overlay.className = 'fullscreen-detail-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      document.body.appendChild(overlay);
    }
    return overlay;
  }

  function openFullScreenShell(config) {
    const overlay = ensureFullScreenOverlay();
    const isAlreadyOpen = overlay.classList.contains('open');

    if (!isAlreadyOpen) {
      savedScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.classList.add('fs-detail-locked');
    }

    if (config.onClose) {
      onCloseCallback = config.onClose;
    }

    const backLabel = navigationStack.length > 1
      ? 'Back to previous view'
      : 'Back to ' + (config.backContext || getPageContextName());

    overlay.innerHTML =
      '<header class="fs-detail-topbar">' +
        '<div class="fs-topbar-left">' +
          '<button type="button" class="fs-back-btn" id="fs-detail-back-btn">' +
            '<span>← ' + escapeHtml(backLabel) + '</span>' +
            '<span class="fs-kbd-pill">Esc</span>' +
          '</button>' +
          '<nav class="breadcrumbs" aria-label="Detail view breadcrumb">' +
            '<span>' + escapeHtml(config.categoryLabel || 'Workspace') + '</span>' +
            '<span class="crumb-sep">/</span>' +
            '<span class="crumb-current">' + escapeHtml(config.crumbTitle || '') + '</span>' +
          '</nav>' +
        '</div>' +
        '<div class="fs-topbar-right">' +
          (config.topbarRightHtml || '') +
        '</div>' +
      '</header>' +
      '<div class="fs-detail-container" id="fs-detail-body">' +
        (config.bodyHtml || '') +
      '</div>';

    overlay.scrollTop = 0;
    void overlay.offsetWidth;
    overlay.classList.add('open');

    const backBtn = document.getElementById('fs-detail-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (navigationStack.length > 1) {
          navigationStack.pop();
          const prev = navigationStack.pop();
          if (prev && typeof prev === 'function') prev();
        } else {
          closeFullScreenDetail();
        }
      });
    }

    if (typeof config.onMount === 'function') {
      config.onMount(overlay);
    }
  }

  function closeFullScreenDetail() {
    const overlay = document.getElementById('patela-fullscreen-detail');
    if (!overlay || !overlay.classList.contains('open')) return;
    overlay.classList.remove('open');
    document.body.classList.remove('fs-detail-locked');
    navigationStack = [];
    window.scrollTo(0, savedScrollY);
    if (typeof onCloseCallback === 'function') {
      const cb = onCloseCallback;
      onCloseCallback = null;
      cb();
    }
  }

  /* ========================================================================
     MINI INTERACTIVE SVG BAR CHART HELPER FOR FULL-SCREEN WORKSPACES
     ======================================================================== */
  function buildSvgBarChart(items, asset) {
    const width = 640;
    const height = 190;
    const padL = 48;
    const padR = 16;
    const padT = 16;
    const padB = 34;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const maxVal = Math.max(500, Math.ceil(Math.max.apply(null, items.map(function (i) { return Number(i.value) || 0; })) / 250) * 250);
    const slotW = plotW / Math.max(1, items.length);
    const barW = Math.min(46, Math.max(20, slotW * 0.55));

    const grid = [0, 0.5, 1].map(function (step) {
      const val = Math.round(maxVal * (1 - step));
      const y = Math.round(padT + step * plotH);
      return (
        '<line x1="' + padL + '" y1="' + y + '" x2="' + (width - padR) + '" y2="' + y + '" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3 3" />' +
        '<text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end" fill="#647084" font-size="10" font-family="JetBrains Mono, monospace">$' + val.toLocaleString('en-US') + '</text>'
      );
    }).join('');

    const bars = items.map(function (it, idx) {
      const bx = padL + idx * slotW + (slotW - barW) / 2;
      const ratio = maxVal > 0 ? (Number(it.value) || 0) / maxVal : 0;
      const bh = Math.max(4, ratio * plotH);
      const by = padT + plotH - bh;
      const fill = it.tone === 'success' ? '#55C995' : (it.tone === 'blue' ? '#8CC7F5' : '#D9BD8B');
      return (
        '<g>' +
          '<rect class="chart-bar-animated" x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="' + fill + '" />' +
          '<text x="' + (bx + barW / 2).toFixed(1) + '" y="' + (by - 6).toFixed(1) + '" text-anchor="middle" fill="#F2D9A9" font-size="10" font-family="JetBrains Mono, monospace">$' + Number(it.value).toLocaleString('en-US') + '</text>' +
          '<text x="' + (bx + barW / 2).toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle" fill="#9CA6B8" font-size="10">' + escapeHtml(it.label) + '</text>' +
        '</g>'
      );
    }).join('');

    return (
      '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;display:block;" role="img" aria-label="Financial breakdown chart">' +
        grid +
        bars +
      '</svg>'
    );
  }

  /* ========================================================================
     1. FULL-SCREEN JOB OPPORTUNITY WORKSPACE
     ======================================================================== */
  function openJobWorkspace(jobId, opts) {
    opts = opts || {};
    if (!opts.fromStack) {
      navigationStack.push(function () { openJobWorkspace(jobId, { fromStack: true, onUpdate: opts.onUpdate }); });
    }

    const state = window.PatelaStore.getState();
    const job = state.marketplaceJobs.find(function (j) { return j.id === jobId; }) || state.marketplaceJobs[0];
    if (!job) return;

    const msChartItems = (job.milestones || []).map(function (m, idx) {
      return {
        label: 'M' + (idx + 1),
        value: m.amount,
        tone: idx === 0 ? 'gold' : 'blue'
      };
    });

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="badge badge-gold">' + escapeHtml(job.category) + '</span>' +
            '<span class="badge badge-success">' + escapeHtml(job.escrowStatus) + '</span>' +
            '<span class="meta-text">' + escapeHtml(job.id) + ' · Posted ' + escapeHtml(job.postedAt) + ' · Due ' + escapeHtml(job.deadline) + '</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(job.title) + '</h1>' +
          '<p class="fs-hero-subtitle">' + escapeHtml(job.description) + '</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          '<a href="#fs-job-proposal-section" class="btn btn-primary btn-lg">' +
            (job.applied ? 'Update Submitted Proposal' : 'Apply &amp; Submit Proposal') +
          '</a>' +
        '</div>' +
      '</section>' +

      '<section class="metrics-grid">' +
        '<div class="metric-card gold-accent">' +
          '<span class="metric-label">Pre-funded escrow budget</span>' +
          '<div class="metric-value tabular">$' + job.budget.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(job.asset) + '</span></div>' +
          '<span class="metric-foot">100% locked prior to kickoff</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Settlement network</span>' +
          '<div class="metric-value" style="font-size:1.3rem;">' + escapeHtml(job.network) + '</div>' +
          '<span class="metric-foot">Asset: ' + escapeHtml(job.asset) + ' (1.5% protocol fee)</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Timeline &amp; seniority</span>' +
          '<div class="metric-value" style="font-size:1.3rem;">' + escapeHtml(job.duration) + '</div>' +
          '<span class="metric-foot">' + escapeHtml(job.experience) + ' level · Due ' + escapeHtml(job.deadline) + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Active proposals</span>' +
          '<div class="metric-value tabular">' + job.proposals + '</div>' +
          '<span class="metric-foot">' + (job.applied ? 'Your proposal is active ✓' : 'Open for applications') + '</span>' +
        '</div>' +
      '</section>' +

      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">Milestone payment schedule &amp; allocation</h2>' +
                '<p class="section-subtitle">Each milestone unlocks sequentially upon AI deliverable verification and client approval</p>' +
              '</div>' +
              '<span class="badge badge-gold">' + job.milestones.length + ' milestones</span>' +
            '</div>' +
            '<div style="margin-bottom:20px;">' +
              buildSvgBarChart(msChartItems, job.asset) +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px;">' +
              job.milestones.map(function (m, i) {
                const pct = Math.round((m.amount / job.budget) * 100);
                return (
                  '<div class="card-elevated" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">' +
                    '<div>' +
                      '<div style="font-weight:500;color:var(--text-primary);">' + escapeHtml(m.name) + '</div>' +
                      '<div class="meta-text">Stage ' + (i + 1) + ' of ' + job.milestones.length + ' · ' + pct + '% of total escrow budget</div>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                      '<span class="cell-amount tabular text-gold">' + formatAsset(m.amount, job.asset) + '</span>' +
                      '<span class="badge badge-success">Pre-funded</span>' +
                    '</div>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">Required deliverables &amp; verification criteria</h2>' +
                '<p class="section-subtitle">Submissions are checked deterministically against these acceptance rules</p>' +
              '</div>' +
            '</div>' +
            '<div class="ai-check-list" style="margin-bottom:16px;">' +
              (job.deliverables || []).map(function (d) {
                return (
                  '<div class="ai-check-row">' +
                    '<span class="ai-check-icon pass">✓</span>' +
                    '<span style="color:var(--text-primary);">' + escapeHtml(d) + '</span>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
            '<div>' +
              '<div class="meta-text" style="margin-bottom:8px;">Required technical skills</div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                (job.skills || []).map(function (s) { return '<span class="skill-tag">' + escapeHtml(s) + '</span>'; }).join('') +
              '</div>' +
            '</div>' +
          '</section>' +

          '<section class="card card-gold" id="fs-job-proposal-section">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">' + (job.applied ? 'Update your proposal' : 'Submit proposal for this engagement') + '</h2>' +
                '<p class="section-subtitle">Your bid will be matched against the pre-funded milestone schedule</p>' +
              '</div>' +
              (job.applied ? '<span class="badge badge-success">Applied ✓</span>' : '') +
            '</div>' +
            '<form id="fs-job-proposal-form" novalidate>' +
              '<div class="form-row">' +
                '<div class="form-group">' +
                  '<label class="form-label" for="fs-prop-bid">Proposed total bid (' + escapeHtml(job.asset) + ')</label>' +
                  '<input type="number" id="fs-prop-bid" class="input tabular" value="' + job.budget + '" min="50" />' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="fs-prop-duration">Estimated delivery timeline</label>' +
                  '<input type="text" id="fs-prop-duration" class="input" value="' + escapeHtml(job.duration) + '" />' +
                '</div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label" for="fs-prop-note">Execution approach &amp; relevant portfolio links</label>' +
                '<textarea id="fs-prop-note" class="textarea" rows="4">Hi ' + escapeHtml(job.clientName.split(' ')[0]) + ', I have reviewed the milestone breakdown and acceptance criteria for ' + escapeHtml(job.title) + '. I can deliver all verified artifacts within ' + escapeHtml(job.duration) + '.</textarea>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<span class="meta-text">Net payout after 1.5% protocol fee: <strong class="tabular text-gold">' + formatAsset(job.budget * 0.985, job.asset) + '</strong></span>' +
                '<button type="submit" class="btn btn-primary btn-lg">' + (job.applied ? 'Save Updated Proposal' : 'Submit Proposal →') + '</button>' +
              '</div>' +
            '</form>' +
          '</section>' +
        '</div>' +

        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<h2 class="section-title">Client profile &amp; payment history</h2>' +
              '<span class="badge badge-success">Verified Client</span>' +
            '</div>' +
            '<div class="kv-list" style="margin-bottom:18px;">' +
              '<div class="kv-row"><span class="kv-label">Client</span><span class="kv-value">' + escapeHtml(job.clientName) + ' (' + escapeHtml(job.clientHandle) + ')</span></div>' +
              '<div class="kv-row"><span class="kv-label">Total released on Patela</span><span class="kv-value tabular text-gold">' + escapeHtml(job.clientTotalPaid) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Escrow funding status</span><span class="kv-value text-success">100% Pre-funded</span></div>' +
              '<div class="kv-row"><span class="kv-label">Milestone approval rate</span><span class="kv-value tabular">98.5% (0 disputes)</span></div>' +
              '<div class="kv-row"><span class="kv-label">Avg. release turnaround</span><span class="kv-value tabular">4.2 hours after AI check</span></div>' +
            '</div>' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;margin-bottom:6px;">' +
                '<span class="meta-text">On-time milestone settlement</span>' +
                '<span class="meta-text text-success tabular">98.5%</span>' +
              '</div>' +
              '<div class="progress-track"><div class="progress-fill success" style="width:98.5%;"></div></div>' +
            '</div>' +
          '</section>' +

          '<details class="fs-expandable-tech" open>' +
            '<summary>' +
              '<span>Smart-contract escrow &amp; verification specification</span>' +
              '<span class="meta-text">▾</span>' +
            '</summary>' +
            '<div class="fs-expandable-body">' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Opportunity ID</span><span class="kv-value mono">' + escapeHtml(job.id) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Escrow Vault (Simulated)</span><span class="kv-value mono">0x88E1…4C90</span></div>' +
                '<div class="kv-row"><span class="kv-label">Settlement Asset</span><span class="kv-value">' + escapeHtml(job.asset) + ' on ' + escapeHtml(job.network) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">AI Verification Mode</span><span class="kv-value">Deterministic Deliverable Check (Advisory)</span></div>' +
                '<div class="kv-row"><span class="kv-label">Environment</span><span class="kv-value">Interactive HTML Prototype (Demo)</span></div>' +
              '</div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Marketplace Opportunity',
      crumbTitle: job.title,
      topbarRightHtml:
        '<span class="badge badge-gold">$' + job.budget.toLocaleString('en-US') + ' ' + escapeHtml(job.asset) + '</span>',
      bodyHtml: bodyHtml,
      onMount: function () {
        const form = document.getElementById('fs-job-proposal-form');
        if (form) {
          form.addEventListener('submit', function (e) {
            e.preventDefault();
            const noteEl = document.getElementById('fs-prop-note');
            if (noteEl && !noteEl.value.trim()) {
              toast('Proposal Note Required', 'Please include a short execution approach.');
              return;
            }
            const st = window.PatelaStore.getState();
            const targetJob = st.marketplaceJobs.find(function (j) { return j.id === job.id; });
            if (targetJob) {
              if (!targetJob.applied) targetJob.proposals += 1;
              targetJob.applied = true;
              window.PatelaStore.saveState(st);
            }
            toast('Proposal Submitted', 'Your proposal for ' + job.title + ' is now active.');
            if (typeof opts.onUpdate === 'function') opts.onUpdate();
            openJobWorkspace(job.id, { fromStack: true, onUpdate: opts.onUpdate });
          });
        }
      }
    });
  }

  /* ========================================================================
     2. FULL-SCREEN PROJECT WORKSPACE
     ======================================================================== */
  function openProjectWorkspace(projectId, opts) {
    opts = opts || {};
    if (!opts.fromStack) {
      navigationStack.push(function () { openProjectWorkspace(projectId, { fromStack: true, onUpdate: opts.onUpdate }); });
    }

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();
    const project = state.projects.find(function (p) { return p.id === projectId; }) || state.projects[0];
    if (!project) return;

    const totalMs = project.milestones.length;
    const completedMs = project.milestones.filter(function (m) {
      return m.status === 'Released' || m.status === 'Approved';
    }).length;
    const completionPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;
    const releasedPct = project.budget > 0 ? Math.round((project.released / project.budget) * 100) : 0;
    const escrowPct = project.budget > 0 ? Math.round((project.escrowBalance / project.budget) * 100) : 0;
    const protocolFee = (project.budget * 0.015).toFixed(2);

    const msChartItems = project.milestones.map(function (m) {
      return {
        label: m.id,
        value: m.amount,
        tone: m.status === 'Released' ? 'success' : (m.status === 'Awaiting client approval' ? 'gold' : 'blue')
      };
    });

    // 7-stage lifecycle where only events that have happened are marked completed
    let stageStates = [];
    if (project.status === 'Completed') {
      stageStates = [
        { num: '✓', title: '1. Project created', meta: '01 Oct 2026', state: 'completed' },
        { num: '✓', title: '2. Agreement accepted', meta: '02 Oct 2026', state: 'completed' },
        { num: '✓', title: '3. Escrow funded', meta: formatAsset(project.funded, project.asset), state: 'completed' },
        { num: '✓', title: '4. Work submitted', meta: 'All milestones', state: 'completed' },
        { num: '✓', title: '5. AI review completed', meta: 'Verified', state: 'completed' },
        { num: '✓', title: '6. Milestone approved', meta: '18 Oct 2026', state: 'completed' },
        { num: '✓', title: '7. Payment released', meta: formatAsset(project.released, project.asset), state: 'completed' }
      ];
    } else if (project.status === 'Awaiting client approval') {
      stageStates = [
        { num: '✓', title: '1. Project created', meta: '20 Oct 2026', state: 'completed' },
        { num: '✓', title: '2. Agreement accepted', meta: '20 Oct 2026', state: 'completed' },
        { num: '✓', title: '3. Escrow funded', meta: formatAsset(project.funded, project.asset), state: 'completed' },
        { num: '✓', title: '4. Work submitted', meta: 'Today, 09:42 UTC', state: 'completed' },
        { num: '✓', title: '5. AI review completed', meta: 'Today, 09:44 UTC', state: 'completed' },
        { num: '6', title: '6. Milestone approved', meta: 'Awaiting decision', state: 'current' },
        { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
      ];
    } else if (project.status === 'Under AI review') {
      stageStates = [
        { num: '✓', title: '1. Project created', meta: '24 Oct 2026', state: 'completed' },
        { num: '✓', title: '2. Agreement accepted', meta: '24 Oct 2026', state: 'completed' },
        { num: '✓', title: '3. Escrow funded', meta: formatAsset(project.funded, project.asset), state: 'completed' },
        { num: '✓', title: '4. Work submitted', meta: '42 mins ago', state: 'completed' },
        { num: '5', title: '5. AI review completed', meta: 'In progress', state: 'current' },
        { num: '6', title: '6. Milestone approved', meta: 'Upcoming stage', state: 'upcoming' },
        { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
      ];
    } else {
      stageStates = [
        { num: '✓', title: '1. Project created', meta: '21 Oct 2026', state: 'completed' },
        { num: '✓', title: '2. Agreement accepted', meta: '22 Oct 2026', state: 'completed' },
        { num: '✓', title: '3. Escrow funded', meta: formatAsset(project.funded, project.asset), state: 'completed' },
        { num: '4', title: '4. Work submitted', meta: project.status === 'Revision requested' ? 'Revision needed' : 'In execution', state: 'current' },
        { num: '5', title: '5. AI review completed', meta: 'Upcoming stage', state: 'upcoming' },
        { num: '6', title: '6. Milestone approved', meta: 'Upcoming stage', state: 'upcoming' },
        { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
      ];
    }

    const activeMs = project.milestones.find(function (m) {
      return m.status !== 'Released';
    }) || project.milestones[project.milestones.length - 1];

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="' + badgeClass(project.statusTone) + '">' + escapeHtml(project.status) + '</span>' +
            '<span class="badge badge-neutral">' + escapeHtml(project.category) + '</span>' +
            '<span class="meta-text">' + escapeHtml(project.id) + ' · Client: ' + escapeHtml(project.clientName) + ' · Freelancer: ' + escapeHtml(project.workerName) + ' · Due ' + escapeHtml(project.deadline) + '</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(project.title) + '</h1>' +
          '<p class="fs-hero-subtitle">' + escapeHtml(project.summary) + '</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          '<button type="button" class="btn btn-primary btn-lg" id="fs-proj-open-active-ms">' +
            (role === 'client' && project.status === 'Awaiting client approval'
              ? 'Review &amp; Approve ' + escapeHtml(activeMs.id) + ' ($' + activeMs.amount + ')'
              : 'Inspect Active Milestone (' + escapeHtml(activeMs.id) + ') →') +
          '</button>' +
        '</div>' +
      '</section>' +

      '<section class="metrics-grid">' +
        '<div class="metric-card">' +
          '<span class="metric-label">Total project budget</span>' +
          '<div class="metric-value tabular">$' + project.budget.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">Est. 1.5% fee: ' + protocolFee + ' ' + escapeHtml(project.asset) + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Deposited in escrow</span>' +
          '<div class="metric-value tabular">$' + project.funded.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">' + escapeHtml(project.network) + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Released to worker</span>' +
          '<div class="metric-value tabular text-success">$' + project.released.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">' + completedMs + ' of ' + totalMs + ' milestones settled</span>' +
        '</div>' +
        '<div class="metric-card gold-accent">' +
          '<span class="metric-label">Remaining escrow balance</span>' +
          '<div class="metric-value tabular">$' + project.escrowBalance.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">Contract-secured</span>' +
        '</div>' +
      '</section>' +

      '<section class="card section-block">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
          '<div>' +
            '<h2 class="section-title">Project lifecycle &amp; escrow progression</h2>' +
            '<p class="section-subtitle">Overall milestone completion: ' + completionPct + '% (' + completedMs + ' of ' + totalMs + ' milestones)</p>' +
          '</div>' +
          '<span class="meta-text">Released: ' + releasedPct + '% · Locked in escrow: ' + escrowPct + '%</span>' +
        '</div>' +
        '<div class="stacked-bar-track" style="height:10px;padding:0;margin-bottom:18px;">' +
          '<div class="stacked-bar-seg" style="width:' + releasedPct + '%;background:var(--success);"></div>' +
          '<div class="stacked-bar-seg" style="width:' + escrowPct + '%;background:var(--gold);"></div>' +
        '</div>' +
        '<div class="lifecycle-stepper">' +
          stageStates.map(function (st) {
            return (
              '<div class="lifecycle-step ' + st.state + '">' +
                '<span class="lifecycle-badge-num">' + st.num + '</span>' +
                '<div style="font-size:0.78rem;font-weight:500;color:var(--text-primary);line-height:1.3;">' + st.title + '</div>' +
                '<div class="meta-text" style="font-size:0.68rem;">' + st.meta + '</div>' +
              '</div>'
            );
          }).join('') +
        '</div>' +
      '</section>' +

      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">Milestone breakdown &amp; financial chart</h2>' +
                '<p class="section-subtitle">Click any milestone card below to open its full-screen deliverable &amp; verification view</p>' +
              '</div>' +
            '</div>' +
            '<div style="margin-bottom:20px;">' +
              buildSvgBarChart(msChartItems, project.asset) +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
              project.milestones.map(function (m) {
                return (
                  '<div class="card-elevated selectable-card" data-open-ms-fs="' + m.id + '" style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">' +
                    '<div style="flex:1;min-width:220px;">' +
                      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
                        '<span style="font-weight:500;color:var(--text-primary);">' + escapeHtml(m.name) + '</span>' +
                        '<span class="' + badgeClass(m.statusTone) + '">' + escapeHtml(m.status) + '</span>' +
                      '</div>' +
                      '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:6px;">' + escapeHtml(m.description) + '</p>' +
                      '<span class="meta-text">Due ' + escapeHtml(m.dueDate) + ' · ' + (m.deliverables ? m.deliverables.length : 0) + ' deliverables</span>' +
                    '</div>' +
                    '<div style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:6px;">' +
                      '<span class="cell-amount tabular text-gold">' + formatAsset(m.amount, project.asset) + '</span>' +
                      '<span class="card-expand-hint">Inspect milestone →</span>' +
                    '</div>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
          '</section>' +
        '</div>' +

        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">AI delivery verification</h2>' +
                '<p class="section-subtitle">' + escapeHtml(project.aiReport.overallResult) + '</p>' +
              '</div>' +
              '<span class="badge ' + (project.aiReport.failed && project.aiReport.failed.length > 0 ? 'badge-warning' : 'badge-success') + '">' +
                (project.aiReport.failed && project.aiReport.failed.length > 0 ? 'Revision needed' : 'Verified') +
              '</span>' +
            '</div>' +
            '<div class="ai-check-list">' +
              (project.aiReport.passed || []).map(function (item) {
                return '<div class="ai-check-row"><span class="ai-check-icon pass">✓</span><span>' + escapeHtml(item) + '</span></div>';
              }).join('') +
              (project.aiReport.failed || []).map(function (item) {
                return '<div class="ai-check-row"><span class="ai-check-icon warn">!</span><span style="color:var(--warning);">' + escapeHtml(item) + '</span></div>';
              }).join('') +
            '</div>' +
            '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-top:10px;line-height:1.55;">' + escapeHtml(project.aiReport.explanation) + '</p>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-header" style="margin-bottom:10px;">' +
              '<h2 class="section-title">Activity history</h2>' +
            '</div>' +
            '<div class="activity-list">' +
              (project.timeline || []).map(function (ev) {
                return (
                  '<div class="activity-row">' +
                    '<div class="activity-left"><span class="activity-bullet"></span><span class="activity-text">' + escapeHtml(ev.title) + '</span></div>' +
                    '<span class="activity-sub">' + escapeHtml(ev.time) + '</span>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
          '</section>' +

          '<details class="fs-expandable-tech">' +
            '<summary>' +
              '<span>Technical contract &amp; escrow metadata</span>' +
              '<span class="meta-text">▾</span>' +
            '</summary>' +
            '<div class="fs-expandable-body">' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Project ID</span><span class="kv-value mono">' + escapeHtml(project.id) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Contract Reference</span><span class="kv-value mono">' + escapeHtml(project.txRef) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Settlement Network</span><span class="kv-value">' + escapeHtml(project.network) + ' (Demo)</span></div>' +
                '<div class="kv-row"><span class="kv-label">Payment Asset</span><span class="kv-value">' + escapeHtml(project.asset) + '</span></div>' +
              '</div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Project Workspace',
      crumbTitle: project.title,
      topbarRightHtml:
        '<a href="project-detail.html?id=' + encodeURIComponent(project.id) + '" class="btn btn-secondary btn-sm">Open standalone page ↗</a>',
      bodyHtml: bodyHtml,
      onMount: function (overlay) {
        const openActiveBtn = document.getElementById('fs-proj-open-active-ms');
        if (openActiveBtn && activeMs) {
          openActiveBtn.addEventListener('click', function () {
            openMilestoneWorkspace(project.id, activeMs.id, { onUpdate: opts.onUpdate });
          });
        }
        overlay.querySelectorAll('[data-open-ms-fs]').forEach(function (card) {
          card.addEventListener('click', function () {
            const msId = card.getAttribute('data-open-ms-fs');
            openMilestoneWorkspace(project.id, msId, { onUpdate: opts.onUpdate });
          });
        });
      }
    });
  }

  /* ========================================================================
     3. FULL-SCREEN MILESTONE & SUBMISSION WORKSPACE
     ======================================================================== */
  function openMilestoneWorkspace(projectId, milestoneId, opts) {
    opts = opts || {};
    if (!opts.fromStack) {
      navigationStack.push(function () { openMilestoneWorkspace(projectId, milestoneId, { fromStack: true, onUpdate: opts.onUpdate }); });
    }

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();
    const project = state.projects.find(function (p) { return p.id === projectId; }) || state.projects[0];
    if (!project) return;
    const ms = project.milestones.find(function (m) { return m.id === milestoneId; }) || project.milestones[0];
    if (!ms) return;

    const latestSub = (ms.submissions && ms.submissions[0]) || {
      version: 'v1.0',
      date: project.lastActivity || 'Recent',
      author: project.workerName,
      files: ['deliverable-package-' + ms.id.toLowerCase() + '.zip (8.4 MB)'],
      links: ['https://figma.com/proto/patela-' + project.id.toLowerCase()],
      note: 'Completed deliverables according to the milestone specification.',
      aiResult: 'Verified against specification'
    };

    const netPayout = (ms.amount * 0.985).toFixed(2);
    const canApprove = role === 'client' && ms.status !== 'Released' && project.escrowBalance >= ms.amount;

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="' + badgeClass(ms.statusTone) + '">' + escapeHtml(ms.status) + '</span>' +
            '<span class="badge badge-neutral">' + escapeHtml(project.title) + '</span>' +
            '<span class="meta-text">Due ' + escapeHtml(ms.dueDate) + ' · Freelancer: ' + escapeHtml(project.workerName) + '</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(ms.name) + '</h1>' +
          '<p class="fs-hero-subtitle">' + escapeHtml(ms.description) + '</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          (canApprove
            ? '<button type="button" class="btn btn-primary btn-lg" id="fs-ms-approve-btn">Approve &amp; Release ' + formatAsset(ms.amount, project.asset) + '</button>'
            : '<button type="button" class="btn btn-secondary btn-sm" id="fs-ms-open-proj-btn">Open Parent Project (' + escapeHtml(project.id) + ')</button>') +
        '</div>' +
      '</section>' +

      '<section class="metrics-grid">' +
        '<div class="metric-card gold-accent">' +
          '<span class="metric-label">Milestone escrow amount</span>' +
          '<div class="metric-value tabular">$' + ms.amount.toLocaleString('en-US') + '.00<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">Custody: ' + escapeHtml(ms.status) + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Net freelancer payout</span>' +
          '<div class="metric-value tabular">$' + Number(netPayout).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '<span class="metric-unit">' + escapeHtml(project.asset) + '</span></div>' +
          '<span class="metric-foot">After 1.5% protocol settlement fee</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">AI verification status</span>' +
          '<div class="metric-value" style="font-size:1.25rem;color:var(--success);">' +
            (project.aiReport.failed && project.aiReport.failed.length > 0 ? '3/4 Checks (75%)' : '4/4 Checks (98%)') +
          '</div>' +
          '<span class="metric-foot">' + escapeHtml(latestSub.aiResult || 'Deterministic inspection') + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Submission version</span>' +
          '<div class="metric-value tabular">' + escapeHtml(latestSub.version) + '</div>' +
          '<span class="metric-foot">Submitted ' + escapeHtml(latestSub.date) + '</span>' +
        '</div>' +
      '</section>' +

      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">Submitted deliverables &amp; evidence</h2>' +
                '<p class="section-subtitle">Uploaded by ' + escapeHtml(latestSub.author) + ' (' + escapeHtml(latestSub.version) + ' · ' + escapeHtml(latestSub.date) + ')</p>' +
              '</div>' +
              '<span class="badge badge-gold">' + escapeHtml(latestSub.version) + '</span>' +
            '</div>' +
            '<p style="font-size:0.875rem;color:var(--text-primary);background:rgba(255,255,255,0.02);padding:14px 16px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);margin-bottom:16px;">"' +
              escapeHtml(latestSub.note) +
            '"</p>' +
            '<div style="margin-bottom:16px;">' +
              '<div class="meta-text" style="margin-bottom:8px;">Attached files &amp; links</div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                (latestSub.files || []).map(function (f) {
                  return '<button type="button" class="skill-tag mono" data-sim-download="' + escapeHtml(f) + '" style="cursor:pointer;">⬇ ' + escapeHtml(f) + '</button>';
                }).join('') +
                (latestSub.links || []).map(function (l) {
                  return '<button type="button" class="skill-tag" data-sim-download="' + escapeHtml(l) + '" style="color:var(--blue);cursor:pointer;">↗ ' + escapeHtml(l) + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<div>' +
              '<div class="meta-text" style="margin-bottom:8px;">Agreed milestone deliverables</div>' +
              '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                (ms.deliverables || []).map(function (d) { return '<span class="skill-tag">' + escapeHtml(d) + '</span>'; }).join('') +
              '</div>' +
            '</div>' +
          '</section>' +

          '<section class="card card-gold">' +
            (role === 'worker'
              ? '<div class="card-header">' +
                  '<div>' +
                    '<h2 class="section-title">Submit new deliverable version</h2>' +
                    '<p class="section-subtitle">Upload updated files and notes to trigger instant AI re-verification</p>' +
                  '</div>' +
                '</div>' +
                '<form id="fs-worker-sub-form" novalidate>' +
                  '<div class="form-row">' +
                    '<div class="form-group">' +
                      '<label class="form-label" for="fs-worker-link">Deliverable prototype / repo URL</label>' +
                      '<input type="url" id="fs-worker-link" class="input" value="https://figma.com/proto/patela-deliverable-v2" />' +
                    '</div>' +
                    '<div class="form-group">' +
                      '<label class="form-label" for="fs-worker-file">Bundle archive name</label>' +
                      '<input type="text" id="fs-worker-file" class="input mono" value="deliverables-' + escapeHtml(ms.id.toLowerCase()) + '-v2.zip (14.2 MB)" />' +
                    '</div>' +
                  '</div>' +
                  '<div class="form-group">' +
                    '<label class="form-label" for="fs-worker-note">Submission release notes</label>' +
                    '<textarea id="fs-worker-note" class="textarea">Completed all responsive frames, exported standalone SVG icon archive, and verified W3C token schema.</textarea>' +
                  '</div>' +
                  '<div style="display:flex;justify-content:flex-end;">' +
                    '<button type="submit" class="btn btn-primary">Submit for AI &amp; Client Review →</button>' +
                  '</div>' +
                '</form>'
              : '<div class="card-header">' +
                  '<div>' +
                    '<h2 class="section-title">Client review &amp; escrow release controls</h2>' +
                    '<p class="section-subtitle">Approving releases ' + formatAsset(ms.amount, project.asset) + ' from the smart-contract escrow to ' + escapeHtml(project.workerName) + '</p>' +
                  '</div>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="fs-client-rev-note">Revision instructions (if requesting changes)</label>' +
                  '<textarea id="fs-client-rev-note" class="textarea" rows="2" placeholder="Specify any missing deliverables or adjustments required…">Please attach the standalone exported 32-icon SVG zip archive alongside the updated mobile checkout frame.</textarea>' +
                '</div>' +
                '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
                  '<button type="button" class="btn btn-secondary" id="fs-ms-req-rev-btn">Request Revision</button>' +
                  '<button type="button" class="btn btn-primary" id="fs-ms-approve-bottom-btn" ' + (canApprove ? '' : 'disabled') + '>' +
                    (canApprove ? 'Approve &amp; Release ' + formatAsset(ms.amount, project.asset) : 'Milestone Settled') +
                  '</button>' +
                '</div>') +
          '</section>' +
        '</div>' +

        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">AI verification report (Demo)</h2>' +
                '<p class="section-subtitle">' + escapeHtml(project.aiReport.overallResult) + '</p>' +
              '</div>' +
              '<span class="badge badge-success">Advisory</span>' +
            '</div>' +
            '<div class="ai-check-list">' +
              (project.aiReport.passed || []).map(function (item) {
                return '<div class="ai-check-row"><span class="ai-check-icon pass">✓</span><span>' + escapeHtml(item) + '</span></div>';
              }).join('') +
              (project.aiReport.failed || []).map(function (item) {
                return '<div class="ai-check-row"><span class="ai-check-icon warn">!</span><span style="color:var(--warning);">' + escapeHtml(item) + '</span></div>';
              }).join('') +
            '</div>' +
            '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-top:10px;line-height:1.55;">' + escapeHtml(project.aiReport.explanation) + '</p>' +
            '<p class="meta-text" style="margin-top:8px;color:var(--gold-light);">Recommendation: ' + escapeHtml(project.aiReport.suggestedChanges) + '</p>' +
          '</section>' +

          '<details class="fs-expandable-tech" open>' +
            '<summary>' +
              '<span>Milestone technical &amp; custody parameters</span>' +
              '<span class="meta-text">▾</span>' +
            '</summary>' +
            '<div class="fs-expandable-body">' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Project / Milestone ID</span><span class="kv-value mono">' + escapeHtml(project.id) + ' · ' + escapeHtml(ms.id) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Locked Amount</span><span class="kv-value tabular">' + formatAsset(ms.amount, project.asset) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Protocol Fee (1.5%)</span><span class="kv-value tabular">' + formatAsset(ms.amount * 0.015, project.asset) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Net Settlement</span><span class="kv-value tabular text-gold">' + formatAsset(ms.amount * 0.985, project.asset) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Contract Reference</span><span class="kv-value mono">' + escapeHtml(project.txRef) + '</span></div>' +
              '</div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Milestone & AI Verification',
      crumbTitle: project.title + ' — ' + ms.name,
      topbarRightHtml:
        '<button type="button" class="btn btn-secondary btn-sm" id="fs-top-open-proj">Project Workspace →</button>',
      bodyHtml: bodyHtml,
      onMount: function (overlay) {
        overlay.querySelectorAll('[data-sim-download]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            toast('Artifact Preview (Demo)', 'Opened ' + btn.getAttribute('data-sim-download') + ' in sandbox viewer.');
          });
        });

        const openProjBtns = [
          document.getElementById('fs-top-open-proj'),
          document.getElementById('fs-ms-open-proj-btn')
        ];
        openProjBtns.forEach(function (b) {
          if (b) {
            b.addEventListener('click', function () {
              openProjectWorkspace(project.id, { onUpdate: opts.onUpdate });
            });
          }
        });

        function handleApproveRelease() {
          const st = window.PatelaStore.getState();
          const prj = st.projects.find(function (p) { return p.id === project.id; });
          if (prj) {
            const targetMs = prj.milestones.find(function (m) { return m.id === ms.id; });
            if (targetMs && targetMs.status !== 'Released') {
              targetMs.status = 'Released';
              targetMs.statusTone = 'success';
              prj.released += targetMs.amount;
              prj.escrowBalance = Math.max(0, prj.escrowBalance - targetMs.amount);
              st.profiles.client.metrics.totalPaid += targetMs.amount;
              st.profiles.client.metrics.awaitingReview = Math.max(0, st.profiles.client.metrics.awaitingReview - 1);
              st.profiles.worker.metrics.totalEarned += targetMs.amount;
            }
            const nextMs = prj.milestones.find(function (m) { return m.status !== 'Released'; });
            if (nextMs) {
              prj.status = 'In progress';
              prj.statusTone = 'blue';
              prj.currentMilestone = nextMs.id + ': ' + nextMs.name.replace(/^Milestone \d+:\s*/, '') + ' ($' + nextMs.amount + ')';
            } else {
              prj.status = 'Completed';
              prj.statusTone = 'success';
              prj.currentMilestone = 'All milestones completed';
            }
            prj.timeline.unshift({
              title: 'Approved ' + ms.name + ' ($' + ms.amount + ' ' + prj.asset + ' released)',
              time: 'Just now'
            });
            st.transactions.unshift({
              id: 'TX-' + Math.floor(9050 + Math.random() * 900),
              type: 'Milestone Release',
              roleScope: ['client', 'worker'],
              projectId: prj.id,
              project: prj.title + ' (' + ms.name + ')',
              counterpartyClient: prj.clientName,
              counterpartyWorker: prj.workerName,
              amount: ms.amount,
              fee: Number((ms.amount * 0.015).toFixed(2)),
              asset: prj.asset,
              network: prj.network,
              date: '2026-11-08',
              timeUtc: 'Just now (08 Nov 2026)',
              displayDate: 'Just now',
              status: 'Completed',
              statusTone: 'success',
              txHash: '0x99f2c10e84d12a77b309e41c8812a40e719c20f4',
              blockNumber: '18,492,810'
            });
            window.PatelaStore.saveState(st);
          }
          toast('Payment Released', formatAsset(ms.amount, project.asset) + ' released to ' + project.workerName + '.');
          if (typeof opts.onUpdate === 'function') opts.onUpdate();
          openMilestoneWorkspace(project.id, ms.id, { fromStack: true, onUpdate: opts.onUpdate });
        }

        const approveTop = document.getElementById('fs-ms-approve-btn');
        const approveBot = document.getElementById('fs-ms-approve-bottom-btn');
        if (approveTop) approveTop.addEventListener('click', handleApproveRelease);
        if (approveBot && canApprove) approveBot.addEventListener('click', handleApproveRelease);

        const revBtn = document.getElementById('fs-ms-req-rev-btn');
        if (revBtn) {
          revBtn.addEventListener('click', function () {
            const noteEl = document.getElementById('fs-client-rev-note');
            const feedback = noteEl ? noteEl.value.trim() : '';
            if (!feedback) {
              toast('Revision Note Required', 'Please provide feedback for the freelancer.');
              return;
            }
            const st = window.PatelaStore.getState();
            const prj = st.projects.find(function (p) { return p.id === project.id; });
            if (prj) {
              const targetMs = prj.milestones.find(function (m) { return m.id === ms.id; });
              if (targetMs) {
                targetMs.status = 'Revision requested';
                targetMs.statusTone = 'warning';
              }
              prj.status = 'Revision requested';
              prj.statusTone = 'warning';
              prj.timeline.unshift({
                title: 'Revision requested on ' + ms.id + ': "' + feedback + '"',
                time: 'Just now'
              });
              window.PatelaStore.saveState(st);
            }
            toast('Revision Requested', 'Freelancer notified with your revision notes.');
            if (typeof opts.onUpdate === 'function') opts.onUpdate();
            openMilestoneWorkspace(project.id, ms.id, { fromStack: true, onUpdate: opts.onUpdate });
          });
        }

        const workerForm = document.getElementById('fs-worker-sub-form');
        if (workerForm) {
          workerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const fileVal = document.getElementById('fs-worker-file').value.trim() || 'deliverable-v2.zip';
            const linkVal = document.getElementById('fs-worker-link').value.trim();
            const noteVal = document.getElementById('fs-worker-note').value.trim();
            if (!noteVal) {
              toast('Note Required', 'Please include a short submission note.');
              return;
            }
            const st = window.PatelaStore.getState();
            const prj = st.projects.find(function (p) { return p.id === project.id; });
            if (prj) {
              const targetMs = prj.milestones.find(function (m) { return m.id === ms.id; });
              if (targetMs) {
                targetMs.status = 'Awaiting client approval';
                targetMs.statusTone = 'gold';
                targetMs.submissions = targetMs.submissions || [];
                targetMs.submissions.unshift({
                  version: 'v' + (targetMs.submissions.length + 1) + '.0',
                  date: 'Just now',
                  author: 'Jordan Blake',
                  files: [fileVal],
                  links: linkVal ? [linkVal] : [],
                  note: noteVal,
                  aiResult: 'Verified · 4 of 4 checks passed'
                });
              }
              prj.status = 'Awaiting client approval';
              prj.statusTone = 'gold';
              prj.aiReport.failed = [];
              prj.aiReport.overallResult = 'All deliverables verified against specification';
              prj.timeline.unshift({
                title: 'Jordan Blake submitted ' + ms.name,
                time: 'Just now'
              });
              window.PatelaStore.saveState(st);
            }
            toast('Deliverable Submitted', 'AI verification passed. Client notified.');
            if (typeof opts.onUpdate === 'function') opts.onUpdate();
            openMilestoneWorkspace(project.id, ms.id, { fromStack: true, onUpdate: opts.onUpdate });
          });
        }
      }
    });
  }

  /* ========================================================================
     4. FULL-SCREEN TRANSACTION & ESCROW SETTLEMENT WORKSPACE
     ======================================================================== */
  function openTransactionWorkspace(txId, opts) {
    opts = opts || {};
    if (!opts.fromStack) {
      navigationStack.push(function () { openTransactionWorkspace(txId, { fromStack: true }); });
    }

    const state = window.PatelaStore.getState();
    const tx = state.transactions.find(function (t) { return t.id === txId; }) || state.transactions[0];
    if (!tx) return;

    const relatedProject = state.projects.find(function (p) { return p.id === tx.projectId; }) || state.projects[0];
    const gross = Number(tx.amount) || 0;
    const fee = tx.fee !== undefined ? Number(tx.fee) : (tx.type === 'Milestone Release' ? gross * 0.015 : 0);
    const net = Math.max(0, gross - fee);

    const isDeposit = tx.type === 'Escrow Deposit';
    const isRefund = tx.type === 'Refund Processed';

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="' + badgeClass(tx.statusTone) + '">' + escapeHtml(tx.status) + '</span>' +
            '<span class="badge badge-gold">' + escapeHtml(tx.type) + '</span>' +
            '<span class="meta-text mono">' + escapeHtml(tx.id) + ' · ' + escapeHtml(tx.timeUtc || tx.displayDate) + '</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(tx.project) + '</h1>' +
          '<p class="fs-hero-subtitle">Settlement record between ' + escapeHtml(tx.counterpartyClient) + ' (Client) and ' + escapeHtml(tx.counterpartyWorker) + ' on ' + escapeHtml(tx.network) + '.</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          '<button type="button" class="btn btn-secondary" id="fs-tx-copy-hash-btn">Copy Tx Hash</button>' +
          '<button type="button" class="btn btn-primary" id="fs-tx-explorer-btn">Verify on Explorer (Demo) ↗</button>' +
        '</div>' +
      '</section>' +

      '<section class="metrics-grid">' +
        '<div class="metric-card gold-accent">' +
          '<span class="metric-label">Gross transaction amount</span>' +
          '<div class="metric-value tabular">' + formatAsset(gross, tx.asset) + '</div>' +
          '<span class="metric-foot">Type: ' + escapeHtml(tx.type) + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Protocol settlement fee</span>' +
          '<div class="metric-value tabular">' + formatAsset(fee, tx.asset) + '</div>' +
          '<span class="metric-foot">' + (fee > 0 ? '1.5% milestone settlement fee' : '0% fee on deposits & refunds') + '</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Net settled value</span>' +
          '<div class="metric-value tabular text-success">' + formatAsset(net, tx.asset) + '</div>' +
          '<span class="metric-foot">Asset: ' + escapeHtml(tx.asset) + ' (No auto-conversion)</span>' +
        '</div>' +
        '<div class="metric-card">' +
          '<span class="metric-label">Network &amp; finality</span>' +
          '<div class="metric-value" style="font-size:1.25rem;">' + escapeHtml(tx.network) + '</div>' +
          '<span class="metric-foot">Block: ' + escapeHtml(tx.blockNumber) + '</span>' +
        '</div>' +
      '</section>' +

      '<section class="card section-block">' +
        '<div class="card-header" style="margin-bottom:10px;">' +
          '<div>' +
            '<h2 class="section-title">Smart-contract custody &amp; settlement flow</h2>' +
            '<p class="section-subtitle">Visual trace of how funds moved for transaction ' + escapeHtml(tx.id) + '</p>' +
          '</div>' +
          '<span class="badge badge-neutral">Simulated On-Chain Custody</span>' +
        '</div>' +
        '<div class="tx-custody-flow">' +
          '<div class="tx-custody-box ' + (isDeposit || isRefund ? 'highlight' : '') + '">' +
            '<div class="meta-text">1. Client Wallet</div>' +
            '<div style="font-weight:500;color:var(--text-primary);margin-top:2px;">' + escapeHtml(tx.counterpartyClient) + '</div>' +
            '<div class="mono" style="margin-top:4px;">0x71C4…9A2E</div>' +
            '<div class="meta-text" style="margin-top:6px;color:var(--blue);">' + (isRefund ? 'Refund recipient (+' + formatAsset(gross, tx.asset) + ')' : 'Originator (' + formatAsset(gross, tx.asset) + ')') + '</div>' +
          '</div>' +
          '<div class="tx-custody-arrow">→</div>' +
          '<div class="tx-custody-box highlight">' +
            '<div class="meta-text">2. Patela Escrow Vault</div>' +
            '<div style="font-weight:500;color:var(--gold-light);margin-top:2px;">Contract · ' + escapeHtml(tx.projectId || 'PRJ-201') + '</div>' +
            '<div class="mono" style="margin-top:4px;">' + escapeHtml(tx.txHash.slice(0, 10) + '…' + tx.txHash.slice(-6)) + '</div>' +
            '<div class="meta-text" style="margin-top:6px;color:var(--gold);">AI-Verified Milestone Vault</div>' +
          '</div>' +
          '<div class="tx-custody-arrow">→</div>' +
          '<div class="tx-custody-box ' + (!isDeposit && !isRefund ? 'highlight' : '') + '">' +
            '<div class="meta-text">3. Recipient Wallet</div>' +
            '<div style="font-weight:500;color:var(--text-primary);margin-top:2px;">' + escapeHtml(tx.counterpartyWorker) + '</div>' +
            '<div class="mono" style="margin-top:4px;">0x94B8…3E1F</div>' +
            '<div class="meta-text" style="margin-top:6px;color:var(--success);">' + (isDeposit ? 'Unlocks on milestone approval' : 'Net received: ' + formatAsset(net, tx.asset)) + '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<h2 class="section-title">Financial reconciliation &amp; audit details</h2>' +
              '<span class="' + badgeClass(tx.statusTone) + '">' + escapeHtml(tx.status) + '</span>' +
            '</div>' +
            '<div class="kv-list">' +
              '<div class="kv-row"><span class="kv-label">Reference ID</span><span class="kv-value mono">' + escapeHtml(tx.id) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Transaction Type</span><span class="kv-value">' + escapeHtml(tx.type) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Description</span><span class="kv-value">' + escapeHtml(tx.project) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Gross Amount</span><span class="kv-value tabular">' + formatAsset(gross, tx.asset) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Protocol Fee (1.5%)</span><span class="kv-value tabular">' + formatAsset(fee, tx.asset) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Net Settlement</span><span class="kv-value tabular text-gold">' + formatAsset(net, tx.asset) + '</span></div>' +
              '<div class="kv-row"><span class="kv-label">Timestamp</span><span class="kv-value">' + escapeHtml(tx.timeUtc || tx.displayDate) + '</span></div>' +
            '</div>' +
          '</section>' +

          (relatedProject
            ? '<section class="card selectable-card" id="fs-tx-open-related-proj">' +
                '<div class="card-header" style="margin-bottom:8px;">' +
                  '<div>' +
                    '<h2 class="section-title">Related project: ' + escapeHtml(relatedProject.title) + '</h2>' +
                    '<p class="section-subtitle">' + escapeHtml(relatedProject.id) + ' · Current milestone: ' + escapeHtml(relatedProject.currentMilestone) + '</p>' +
                  '</div>' +
                  '<span class="card-expand-hint">Open project workspace →</span>' +
                '</div>' +
                '<div class="kv-list">' +
                  '<div class="kv-row"><span class="kv-label">Project Budget</span><span class="kv-value tabular">' + formatAsset(relatedProject.budget, relatedProject.asset) + '</span></div>' +
                  '<div class="kv-row"><span class="kv-label">Remaining in Escrow</span><span class="kv-value tabular text-gold">' + formatAsset(relatedProject.escrowBalance, relatedProject.asset) + '</span></div>' +
                '</div>' +
              '</section>'
            : '') +
        '</div>' +

        '<div class="fs-column-stack">' +
          '<details class="fs-expandable-tech" open>' +
            '<summary>' +
              '<span>On-chain technical telemetry (Simulated)</span>' +
              '<span class="meta-text">▾</span>' +
            '</summary>' +
            '<div class="fs-expandable-body">' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Transaction Hash</span><span class="kv-value mono" style="word-break:break-all;">' + escapeHtml(tx.txHash) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Network</span><span class="kv-value">' + escapeHtml(tx.network) + ' (Demo)</span></div>' +
                '<div class="kv-row"><span class="kv-label">Token Contract</span><span class="kv-value mono">' + escapeHtml(tx.asset) + ' (ERC-20 Permit)</span></div>' +
                '<div class="kv-row"><span class="kv-label">Block Number</span><span class="kv-value mono">' + escapeHtml(tx.blockNumber) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Simulation Note</span><span class="kv-value">Demo receipt — no live blockchain call</span></div>' +
              '</div>' +
            '</div>' +
          '</details>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Transaction & Escrow Settlement',
      crumbTitle: tx.id + ' · ' + tx.type,
      bodyHtml: bodyHtml,
      onMount: function () {
        const copyBtn = document.getElementById('fs-tx-copy-hash-btn');
        if (copyBtn) {
          copyBtn.addEventListener('click', function () {
            toast('Transaction Hash Copied', tx.txHash);
          });
        }
        const expBtn = document.getElementById('fs-tx-explorer-btn');
        if (expBtn) {
          expBtn.addEventListener('click', function () {
            toast('Simulated Block Explorer', 'Verified ' + tx.txHash.slice(0, 14) + '… on ' + tx.network + ' (Simulated Demo).');
          });
        }
        const relProjCard = document.getElementById('fs-tx-open-related-proj');
        if (relProjCard && relatedProject) {
          relProjCard.addEventListener('click', function () {
            openProjectWorkspace(relatedProject.id);
          });
        }
      }
    });
  }

  /* ========================================================================
     5. FULL-SCREEN FINANCIAL METRIC & PORTFOLIO INSIGHT WORKSPACE
     ======================================================================== */
  function openMetricWorkspace(metricKey) {
    navigationStack.push(function () { openMetricWorkspace(metricKey); });

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();
    const roleProjects = state.projects.filter(function (p) { return p.roles.indexOf(role) !== -1; });
    const roleTxs = state.transactions.filter(function (t) { return t.roleScope.indexOf(role) !== -1; });

    const titleMap = {
      'client-active': 'Active Escrow Projects Portfolio (4 Active)',
      'client-escrow': 'Escrow Custody Breakdown ($2,450.00 USDC Locked)',
      'client-review': 'Submissions Awaiting Review (2 Milestones)',
      'client-paid': 'Cumulative Released Spending ($8,320.00 USDC)',
      'worker-active': 'Active Freelance Contracts (3 Active)',
      'worker-escrow': 'Contract-Secured Escrow Funds ($1,850.00 USDC)',
      'worker-pending': 'Approved Pending Payouts ($620.00 USDC)',
      'worker-earned': 'Total Settled Earnings ($5,420.00 USDC)'
    };

    const chartItems = roleProjects.map(function (p) {
      return {
        label: p.id,
        value: metricKey && metricKey.indexOf('escrow') !== -1 ? p.escrowBalance : p.budget,
        tone: p.status === 'Completed' ? 'success' : 'gold'
      };
    });

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="badge badge-gold">Financial &amp; Portfolio Deep-Dive</span>' +
            '<span class="meta-text">' + (role === 'worker' ? 'Worker Workspace · Jordan Blake' : 'Client Workspace · Alex Morgan') + '</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(titleMap[metricKey] || 'Portfolio Financial Breakdown') + '</h1>' +
          '<p class="fs-hero-subtitle">Select any project or transaction below to pivot directly into its full-screen workspace.</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          '<a href="analytics.html" class="btn btn-primary">Open Full Analytics Page →</a>' +
        '</div>' +
      '</section>' +

      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<h2 class="section-title">Allocation by project contract</h2>' +
              '<span class="meta-text">Click any project below to inspect milestones</span>' +
            '</div>' +
            '<div style="margin-bottom:20px;">' +
              buildSvgBarChart(chartItems, 'USDC') +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px;">' +
              roleProjects.map(function (p) {
                return (
                  '<div class="card-elevated selectable-card" data-metric-proj="' + p.id + '" style="display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;">' +
                    '<div>' +
                      '<div style="font-weight:500;color:var(--text-primary);">' + escapeHtml(p.title) + '</div>' +
                      '<div class="meta-text">' + escapeHtml(p.currentMilestone) + ' · Due ' + escapeHtml(p.deadline) + '</div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                      '<div class="cell-amount tabular text-gold">' + formatAsset(p.escrowBalance, p.asset) + ' in escrow</div>' +
                      '<span class="card-expand-hint">Open workspace →</span>' +
                    '</div>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
          '</section>' +
        '</div>' +

        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<h2 class="section-title">Recent related transactions</h2>' +
              '<a href="payments.html" class="meta-text" style="color:var(--gold-light);">All transactions →</a>' +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:10px;">' +
              roleTxs.slice(0, 5).map(function (t) {
                return (
                  '<div class="card-elevated selectable-card" data-metric-tx="' + t.id + '" style="display:flex;justify-content:space-between;align-items:center;gap:12px;">' +
                    '<div>' +
                      '<div style="font-weight:500;color:var(--text-primary);">' + escapeHtml(t.type) + '</div>' +
                      '<div class="meta-text">' + escapeHtml(t.project) + ' · ' + escapeHtml(t.displayDate) + '</div>' +
                    '</div>' +
                    '<div style="text-align:right;">' +
                      '<div class="cell-amount tabular">' + formatAsset(t.amount, t.asset) + '</div>' +
                      '<span class="card-expand-hint">Inspect tx →</span>' +
                    '</div>' +
                  '</div>'
                );
              }).join('') +
            '</div>' +
          '</section>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Financial Breakdown',
      crumbTitle: titleMap[metricKey] || 'Portfolio Insight',
      bodyHtml: bodyHtml,
      onMount: function (overlay) {
        overlay.querySelectorAll('[data-metric-proj]').forEach(function (el) {
          el.addEventListener('click', function () {
            openProjectWorkspace(el.getAttribute('data-metric-proj'));
          });
        });
        overlay.querySelectorAll('[data-metric-tx]').forEach(function (el) {
          el.addEventListener('click', function () {
            openTransactionWorkspace(el.getAttribute('data-metric-tx'));
          });
        });
      }
    });
  }

  /* ========================================================================
     6. FULL-SCREEN ACTION / CONFIRMATION WORKSPACE (Replaces small popups)
     ======================================================================== */
  function confirmAction(opts) {
    opts = opts || {};
    const btnClass = opts.variant === 'danger' ? 'btn-danger' : 'btn-primary';
    const metaRows = opts.meta
      ? Object.keys(opts.meta).map(function (k) {
          return '<div class="kv-row"><span class="kv-label">' + escapeHtml(k) + '</span><span class="kv-value">' + escapeHtml(opts.meta[k]) + '</span></div>';
        }).join('')
      : '';

    const bodyHtml =
      '<section class="fs-hero">' +
        '<div>' +
          '<div class="fs-hero-meta">' +
            '<span class="badge ' + (opts.variant === 'danger' ? 'badge-error' : 'badge-gold') + '">Escrow Contract Action</span>' +
            '<span class="meta-text">Interactive Prototype · Simulated Execution</span>' +
          '</div>' +
          '<h1 class="fs-hero-title">' + escapeHtml(opts.title || 'Review & Confirm Action') + '</h1>' +
          '<p class="fs-hero-subtitle">' + escapeHtml(opts.description || '') + '</p>' +
        '</div>' +
        '<div class="fs-hero-actions">' +
          '<button type="button" class="btn btn-secondary btn-lg" id="fs-confirm-cancel">← Return without changes</button>' +
          '<button type="button" class="btn ' + btnClass + ' btn-lg" id="fs-confirm-proceed">' + escapeHtml(opts.confirmLabel || 'Confirm') + '</button>' +
        '</div>' +
      '</section>' +
      '<div class="fs-workspace-grid">' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header">' +
              '<h2 class="section-title">Transaction &amp; contract parameters</h2>' +
              '<span class="badge badge-neutral">Verified Parameters</span>' +
            '</div>' +
            '<div class="kv-list">' + metaRows + '</div>' +
          '</section>' +
        '</div>' +
        '<div class="fs-column-stack">' +
          '<section class="card">' +
            '<div class="card-header"><h2 class="section-title">Custody &amp; safety guarantee</h2></div>' +
            '<p style="font-size:0.84375rem;color:var(--text-secondary);line-height:1.6;">All financial actions in this prototype update the local state store deterministically without broadcasting live blockchain transactions.</p>' +
          '</section>' +
        '</div>' +
      '</div>';

    openFullScreenShell({
      categoryLabel: 'Action Review',
      crumbTitle: opts.title || 'Confirm Action',
      bodyHtml: bodyHtml,
      onMount: function () {
        const cancelBtn = document.getElementById('fs-confirm-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', closeFullScreenDetail);
        const proceedBtn = document.getElementById('fs-confirm-proceed');
        if (proceedBtn) {
          proceedBtn.addEventListener('click', function () {
            closeFullScreenDetail();
            if (typeof opts.onConfirm === 'function') opts.onConfirm();
          });
        }
      }
    });
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
  }

  function closeModal(id) {
    if (id) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('open');
      return;
    }
    document.querySelectorAll('.modal-backdrop.open').forEach(function (m) {
      m.classList.remove('open');
    });
    closeFullScreenDetail();
  }

  // Subtle one-time count-up animation for metric cards (respects prefers-reduced-motion)
  function animateMetricsOnce(scopeKey) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    try {
      const flag = 'patela_anim_' + scopeKey;
      if (sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, '1');
    } catch (e) {}

    document.querySelectorAll('[data-count-target]').forEach(function (el) {
      const target = Number(el.getAttribute('data-count-target')) || 0;
      const prefix = el.getAttribute('data-count-prefix') || '';
      const unit = el.getAttribute('data-count-unit') || '';
      const duration = 520;
      const start = performance.now();

      function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.round(target * eased);
        el.innerHTML =
          prefix +
          current.toLocaleString('en-US') +
          (unit ? '<span class="metric-unit">' + unit + '</span>' : '');
        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
    });
  }

  // Global Delegated Click Handler for Selectable Cards & Rows ([data-detail-type])
  document.addEventListener('click', function (e) {
    const trigger = e.target.closest('[data-detail-type]');
    if (trigger) {
      // Do not intercept if clicking an explicit external link that isn't meant to open the detail view
      if (e.target.closest('[data-no-fullscreen]')) return;
      e.preventDefault();
      const type = trigger.getAttribute('data-detail-type');
      const id = trigger.getAttribute('data-detail-id');
      const subId = trigger.getAttribute('data-detail-subid');
      if (type === 'job') {
        openJobWorkspace(id);
      } else if (type === 'project') {
        openProjectWorkspace(id);
      } else if (type === 'milestone') {
        openMilestoneWorkspace(id, subId);
      } else if (type === 'transaction') {
        openTransactionWorkspace(id);
      } else if (type === 'metric') {
        openMetricWorkspace(id);
      }
      return;
    }

    const openTrigger = e.target.closest('[data-modal-open]');
    if (openTrigger) {
      e.preventDefault();
      openModal(openTrigger.getAttribute('data-modal-open'));
      return;
    }

    const closeTrigger = e.target.closest('[data-modal-close]');
    if (closeTrigger) {
      e.preventDefault();
      const backdrop = closeTrigger.closest('.modal-backdrop');
      if (backdrop) backdrop.classList.remove('open');
      return;
    }

    if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
      e.target.classList.remove('open');
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeFullScreenDetail();
      closeModal();
      document.querySelectorAll('.popover-menu.open').forEach(function (p) {
        p.classList.remove('open');
      });
    }
  });

  window.PatelaUI = {
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirmAction: confirmAction,
    badgeClass: badgeClass,
    formatUSD: formatUSD,
    formatAsset: formatAsset,
    getQueryParam: getQueryParam,
    escapeHtml: escapeHtml,
    animateMetricsOnce: animateMetricsOnce
  };

  window.PatelaDetail = {
    openJob: openJobWorkspace,
    openProject: openProjectWorkspace,
    openMilestone: openMilestoneWorkspace,
    openTransaction: openTransactionWorkspace,
    openMetric: openMetricWorkspace,
    close: closeFullScreenDetail
  };
})();
