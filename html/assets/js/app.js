/* ==========================================================================
   PATELA — SHARED ROLE-AWARE PAGES CONTROLLER (app.js)
   Progressive Disclosure · Clean Hierarchy · Zero Clutter
   ========================================================================== */

(function () {
  /* ========================================================================
     1. PROJECTS PAGE (projects.html)
     ======================================================================== */
  function initProjectsPage() {
    const root = document.getElementById('projects-page-root');
    if (!root) return;

    const role = window.PatelaStore.getRole();
    const subtitleEl = document.getElementById('projects-role-subtitle');
    const ctaContainer = document.getElementById('projects-header-cta');
    const searchInput = document.getElementById('projects-search-input');
    const sortSelect = document.getElementById('projects-sort-select');
    const resetBtn = document.getElementById('projects-reset-btn');
    const tbody = document.getElementById('projects-table-tbody');
    const theadRow = document.getElementById('projects-table-thead-row');

    let currentStatusFilter = 'all';

    if (subtitleEl) {
      subtitleEl.textContent = role === 'worker'
        ? 'Accepted projects, current milestones, deadlines, and escrow status.'
        : 'Posted projects, assigned freelancers, milestone progress, and escrow balances.';
    }

    if (ctaContainer) {
      ctaContainer.innerHTML = role === 'worker'
        ? '<a href="marketplace.html" class="btn btn-primary">Explore jobs</a>'
        : '<a href="post-job.html" class="btn btn-primary">+ Post a job</a>';
    }

    if (theadRow) {
      theadRow.innerHTML = role === 'worker'
        ? '<th>Project</th><th>Client</th><th>Current Milestone</th><th>Deadline</th><th>Status</th><th class="right">Action</th>'
        : '<th>Project</th><th>Freelancer</th><th>Milestone Progress</th><th>Escrow Balance</th><th>Status</th><th class="right">Action</th>';
    }

    function renderProjectsList() {
      const state = window.PatelaStore.getState();
      const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const sortBy = sortSelect ? sortSelect.value : 'recent';

      let list = state.projects.filter(function (p) {
        if (p.roles.indexOf(role) === -1) return false;
        if (currentStatusFilter !== 'all') {
          if (currentStatusFilter === 'active' && p.status === 'Completed') return false;
          if (currentStatusFilter === 'review' && p.status !== 'Awaiting client approval' && p.status !== 'Under AI review') return false;
          if (currentStatusFilter === 'revision' && p.status !== 'Revision requested') return false;
          if (currentStatusFilter === 'completed' && p.status !== 'Completed') return false;
        }
        if (q) {
          const hay = (p.title + ' ' + p.clientName + ' ' + p.workerName + ' ' + p.currentMilestone).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      if (sortBy === 'budget-high') {
        list.sort(function (a, b) { return b.budget - a.budget; });
      } else if (sortBy === 'escrow-high') {
        list.sort(function (a, b) { return b.escrowBalance - a.escrowBalance; });
      }

      if (list.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="6">' +
            '<div class="empty-state">' +
              '<div class="empty-title">No matching projects</div>' +
              '<div class="empty-desc">Try clearing your search or status filter.</div>' +
              '<button type="button" class="btn btn-secondary btn-sm" id="projects-empty-reset" style="margin-top:8px;">Reset filters</button>' +
            '</div>' +
          '</td></tr>';
        const btn = document.getElementById('projects-empty-reset');
        if (btn) btn.addEventListener('click', resetFilters);
        return;
      }

      tbody.innerHTML = list.map(function (p) {
        const doneMs = p.milestones.filter(function (m) { return m.status === 'Released' || m.status === 'Approved'; }).length;
        const dots = p.milestones.map(function (m) {
          const c = (m.status === 'Released' || m.status === 'Approved') ? 'done' : (m.status === 'Not funded' ? '' : 'active');
          return '<span class="m-dot ' + c + '"></span>';
        }).join('');

        if (role === 'worker') {
          return (
            '<tr data-open-proj="' + p.id + '" style="cursor:pointer;">' +
              '<td>' +
                '<span class="cell-title" style="color:var(--gold-light);">' + window.PatelaUI.escapeHtml(p.title) + '</span>' +
                '<span class="cell-sub">Click to open full-screen project workspace</span>' +
              '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.clientName) + '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.currentMilestone) + '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.deadline) + '</td>' +
              '<td><span class="' + window.PatelaUI.badgeClass(p.statusTone) + '">' + window.PatelaUI.escapeHtml(p.status) + '</span></td>' +
              '<td class="right"><button type="button" class="btn btn-ghost btn-sm" data-open-proj="' + p.id + '">Open →</button></td>' +
            '</tr>'
          );
        }

        return (
          '<tr data-open-proj="' + p.id + '" style="cursor:pointer;">' +
            '<td>' +
              '<span class="cell-title" style="color:var(--gold-light);">' + window.PatelaUI.escapeHtml(p.title) + '</span>' +
              '<span class="cell-sub">Click to open full-screen project workspace</span>' +
            '</td>' +
            '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.workerName) + '</td>' +
            '<td>' +
              '<div style="font-size:0.8125rem;color:var(--text-secondary);">' + doneMs + ' of ' + p.milestones.length + ' milestones</div>' +
              '<div class="milestone-dots">' + dots + '</div>' +
            '</td>' +
            '<td><span class="cell-amount">$' + p.escrowBalance.toLocaleString('en-US') + ' ' + p.asset + '</span></td>' +
            '<td><span class="' + window.PatelaUI.badgeClass(p.statusTone) + '">' + window.PatelaUI.escapeHtml(p.status) + '</span></td>' +
            '<td class="right">' +
              '<button type="button" class="btn ' + (p.status === 'Awaiting client approval' ? 'btn-primary' : 'btn-ghost') + ' btn-sm" data-open-proj="' + p.id + '">' +
                (p.status === 'Awaiting client approval' ? 'Review' : 'View →') +
              '</button>' +
            '</td>' +
          '</tr>'
        );
      }).join('');

      tbody.querySelectorAll('[data-open-proj]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          const projId = el.getAttribute('data-open-proj');
          if (window.PatelaDetail) {
            window.PatelaDetail.openProject(projId, { onUpdate: renderProjectsList });
          }
        });
      });
    }

    function resetFilters() {
      currentStatusFilter = 'all';
      if (searchInput) searchInput.value = '';
      if (sortSelect) sortSelect.value = 'recent';
      document.querySelectorAll('[data-proj-tab]').forEach(function (t) {
        t.classList.toggle('active', t.getAttribute('data-proj-tab') === 'all');
      });
      renderProjectsList();
    }

    document.querySelectorAll('[data-proj-tab]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        currentStatusFilter = tab.getAttribute('data-proj-tab');
        document.querySelectorAll('[data-proj-tab]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        renderProjectsList();
      });
    });

    if (searchInput) searchInput.addEventListener('input', renderProjectsList);
    if (sortSelect) sortSelect.addEventListener('change', renderProjectsList);
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    renderProjectsList();
  }

  /* ========================================================================
     2. PROJECT DETAIL WORKSPACE (project-detail.html)
     Progressive Disclosure: Active Milestone Expanded, Others Collapsible
     ======================================================================== */
  function initProjectDetailPage() {
    const root = document.getElementById('project-detail-root');
    if (!root) return;

    const projId = window.PatelaUI.getQueryParam('id') || 'PRJ-201';

    function renderWorkspace() {
      const state = window.PatelaStore.getState();
      const role = window.PatelaStore.getRole();
      const project = state.projects.find(function (p) { return p.id === projId; }) || state.projects[0];

      // 1. Header (Primary: Title, Status, Counterparty, Budget; Tertiary ID understated)
      const headerEl = document.getElementById('pd-header-container');
      if (headerEl) {
        const counterpartyLabel = role === 'worker'
          ? 'Client: <strong style="color:var(--text-primary);font-weight:500;">' + window.PatelaUI.escapeHtml(project.clientName) + '</strong>'
          : 'Freelancer: <strong style="color:var(--text-primary);font-weight:500;">' + window.PatelaUI.escapeHtml(project.workerName) + '</strong>';

        headerEl.innerHTML =
          '<div>' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap;">' +
              '<span class="' + window.PatelaUI.badgeClass(project.statusTone) + '">' + window.PatelaUI.escapeHtml(project.status) + '</span>' +
              '<span class="meta-text">' + project.id + ' · Due ' + project.deadline + '</span>' +
            '</div>' +
            '<h1 class="page-title">' + window.PatelaUI.escapeHtml(project.title) + '</h1>' +
            '<p class="page-subtitle">' + counterpartyLabel + ' · Agreed budget: <span class="text-gold tabular" style="font-weight:500;">$' + project.budget.toLocaleString('en-US') + ' ' + project.asset + '</span></p>' +
          '</div>' +
          '<div class="welcome-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm" id="pd-switch-project-btn">Next project →</button>' +
          '</div>';

        const switchBtn = document.getElementById('pd-switch-project-btn');
        if (switchBtn) {
          switchBtn.addEventListener('click', function () {
            const idx = state.projects.findIndex(function (p) { return p.id === project.id; });
            const nextProj = state.projects[(idx + 1) % state.projects.length];
            window.location.href = 'project-detail.html?id=' + nextProj.id;
          });
        }
      }

      // 1B. Section 4: Project Analytics (Milestone Progress, Financial Progress & 7-Stage Lifecycle Timeline)
      const projAnalyticsEl = document.getElementById('pd-project-analytics-section');
      if (projAnalyticsEl) {
        const totalMs = project.milestones.length;
        const completedMs = project.milestones.filter(function (m) {
          return m.status === 'Released' || m.status === 'Approved';
        }).length;
        const remainingMs = Math.max(0, totalMs - completedMs);
        const completionPct = totalMs > 0 ? Math.round((completedMs / totalMs) * 100) : 0;

        const protocolFee = (Number(project.budget) * 0.015).toFixed(2);
        const releasedPct = project.budget > 0 ? Math.round((project.released / project.budget) * 100) : 0;
        const escrowPct = project.budget > 0 ? Math.round((project.escrowBalance / project.budget) * 100) : 0;

        // Compute realistic 7-Stage Lifecycle where ONLY events that have actually happened are completed
        // Stages: 1. Project created, 2. Agreement accepted, 3. Escrow funded, 4. Work submitted, 5. AI review completed, 6. Milestone approved, 7. Payment released
        let stageStates = [];
        if (project.status === 'Completed') {
          stageStates = [
            { num: '✓', title: '1. Project created', meta: '01 Oct 2026', state: 'completed' },
            { num: '✓', title: '2. Agreement accepted', meta: '02 Oct 2026', state: 'completed' },
            { num: '✓', title: '3. Escrow funded', meta: project.funded.toLocaleString('en-US') + '.00 ' + project.asset, state: 'completed' },
            { num: '✓', title: '4. Work submitted', meta: 'All 3 milestones', state: 'completed' },
            { num: '✓', title: '5. AI review completed', meta: '3/3 checks passed', state: 'completed' },
            { num: '✓', title: '6. Milestone approved', meta: '18 Oct 2026', state: 'completed' },
            { num: '✓', title: '7. Payment released', meta: project.released.toLocaleString('en-US') + '.00 ' + project.asset, state: 'completed' }
          ];
        } else if (project.status === 'Awaiting client approval') {
          stageStates = [
            { num: '✓', title: '1. Project created', meta: '20 Oct 2026', state: 'completed' },
            { num: '✓', title: '2. Agreement accepted', meta: '20 Oct 2026', state: 'completed' },
            { num: '✓', title: '3. Escrow funded', meta: project.funded.toLocaleString('en-US') + '.00 ' + project.asset, state: 'completed' },
            { num: '✓', title: '4. Work submitted', meta: 'Today, 09:42 UTC', state: 'completed' },
            { num: '✓', title: '5. AI review completed', meta: 'Today, 09:44 UTC', state: 'completed' },
            { num: '6', title: '6. Milestone approved', meta: 'Awaiting client decision', state: 'current' },
            { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
          ];
        } else if (project.status === 'Under AI review') {
          stageStates = [
            { num: '✓', title: '1. Project created', meta: '24 Oct 2026', state: 'completed' },
            { num: '✓', title: '2. Agreement accepted', meta: '24 Oct 2026', state: 'completed' },
            { num: '✓', title: '3. Escrow funded', meta: project.funded.toLocaleString('en-US') + '.00 ' + project.asset, state: 'completed' },
            { num: '✓', title: '4. Work submitted', meta: '42 mins ago', state: 'completed' },
            { num: '5', title: '5. AI review completed', meta: 'Verification in progress', state: 'current' },
            { num: '6', title: '6. Milestone approved', meta: 'Upcoming stage', state: 'upcoming' },
            { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
          ];
        } else {
          // 'In progress' or 'Revision requested'
          stageStates = [
            { num: '✓', title: '1. Project created', meta: '21 Oct 2026', state: 'completed' },
            { num: '✓', title: '2. Agreement accepted', meta: '22 Oct 2026', state: 'completed' },
            { num: '✓', title: '3. Escrow funded', meta: project.funded.toLocaleString('en-US') + '.00 ' + project.asset, state: 'completed' },
            { num: '4', title: '4. Work submitted', meta: project.status === 'Revision requested' ? 'Revision in progress' : 'Active milestone work', state: 'current' },
            { num: '5', title: '5. AI review completed', meta: 'Upcoming stage', state: 'upcoming' },
            { num: '6', title: '6. Milestone approved', meta: 'Upcoming stage', state: 'upcoming' },
            { num: '7', title: '7. Payment released', meta: 'Upcoming stage', state: 'upcoming' }
          ];
        }

        projAnalyticsEl.innerHTML =
          '<div class="dashboard-equal" style="margin-bottom:18px;">' +
            '<div class="card">' +
              '<div class="card-header" style="margin-bottom:12px;">' +
                '<div>' +
                  '<h2 class="section-title">Milestone progress</h2>' +
                  '<p class="section-subtitle">Current: ' + window.PatelaUI.escapeHtml(project.currentMilestone) + '</p>' +
                '</div>' +
                '<span class="cell-amount tabular text-gold">' + completionPct + '% complete</span>' +
              '</div>' +
              '<div class="progress-track" style="margin-bottom:14px;">' +
                '<div class="progress-fill" style="width:' + Math.max(8, completionPct) + '%;"></div>' +
              '</div>' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Completed milestones</span><span class="kv-value tabular text-success">' + completedMs + ' of ' + totalMs + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Current milestone</span><span class="kv-value">' + window.PatelaUI.escapeHtml(project.currentMilestone) + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Remaining milestones</span><span class="kv-value tabular">' + remainingMs + ' remaining</span></div>' +
              '</div>' +
            '</div>' +
            '<div class="card">' +
              '<div class="card-header" style="margin-bottom:12px;">' +
                '<div>' +
                  '<h2 class="section-title">Financial progress</h2>' +
                  '<p class="section-subtitle">Escrow custody &amp; settlement breakdown</p>' +
                '</div>' +
                '<span class="badge badge-neutral">' + project.asset + ' · ' + project.network + '</span>' +
              '</div>' +
              '<div class="stacked-bar-track" style="height:8px;padding:0;margin-bottom:14px;">' +
                '<div class="stacked-bar-seg" style="width:' + releasedPct + '%;background:var(--success);" title="Released: ' + project.released + '.00 ' + project.asset + '"></div>' +
                '<div class="stacked-bar-seg" style="width:' + escrowPct + '%;background:var(--gold);" title="Remaining in escrow: ' + project.escrowBalance + '.00 ' + project.asset + '"></div>' +
              '</div>' +
              '<div class="kv-list">' +
                '<div class="kv-row"><span class="kv-label">Total project budget</span><span class="kv-value tabular">' + project.budget.toLocaleString('en-US') + '.00 ' + project.asset + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Deposited into escrow</span><span class="kv-value tabular">' + project.funded.toLocaleString('en-US') + '.00 ' + project.asset + '</span></div>' +
                '<div class="kv-row"><span class="kv-label">Released / Remaining in escrow</span><span class="kv-value tabular"><span class="text-success">' + project.released.toLocaleString('en-US') + '.00</span> / <span class="text-gold">' + project.escrowBalance.toLocaleString('en-US') + '.00 ' + project.asset + '</span></span></div>' +
                '<div class="kv-row"><span class="kv-label">Estimated platform fee (1.5%)</span><span class="kv-value tabular text-secondary">' + protocolFee + ' ' + project.asset + '</span></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="card" style="padding:18px 22px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
              '<h2 class="section-title">Current milestone lifecycle timeline</h2>' +
              '<span class="meta-text">Completed events show timestamps · Future stages appear as upcoming</span>' +
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
          '</div>';
      }

      // 2. Milestones with Progressive Disclosure (<details class="milestone-accordion">)
      const msContainer = document.getElementById('pd-milestones-list');
      if (msContainer) {
        msContainer.innerHTML = project.milestones.map(function (m) {
          const isCurrent = m.status === 'Awaiting client approval' || m.status === 'In progress' || m.status === 'Revision requested' || m.status === 'Under AI review';
          const subsHtml = (m.submissions && m.submissions.length > 0)
            ? '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border-subtle);">' +
                '<div class="meta-text" style="margin-bottom:6px;">Latest submission</div>' +
                m.submissions.slice(0, 1).map(function (s) {
                  return (
                    '<div style="font-size:0.8125rem;color:var(--text-secondary);">' +
                      '<div style="margin-bottom:6px;">"' + window.PatelaUI.escapeHtml(s.note) + '" <span class="meta-text">(' + s.version + ' · ' + s.date + ')</span></div>' +
                      '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                        (s.files || []).map(function (f) { return '<span class="skill-tag mono">' + window.PatelaUI.escapeHtml(f) + '</span>'; }).join('') +
                      '</div>' +
                    '</div>'
                  );
                }).join('') +
              '</div>'
            : '';

          return (
            '<details class="milestone-accordion ' + (isCurrent ? 'active-milestone' : '') + '" ' + (isCurrent ? 'open' : '') + '>' +
              '<summary>' +
                '<div>' +
                  '<div style="font-weight:500;color:var(--text-primary);">' + window.PatelaUI.escapeHtml(m.name) + '</div>' +
                  '<div class="meta-text">Due ' + window.PatelaUI.escapeHtml(m.dueDate) + '</div>' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:12px;">' +
                  '<span class="cell-amount">$' + m.amount.toLocaleString('en-US') + ' ' + project.asset + '</span>' +
                  '<span class="' + window.PatelaUI.badgeClass(m.statusTone) + '">' + window.PatelaUI.escapeHtml(m.status) + '</span>' +
                '</div>' +
              '</summary>' +
              '<div class="milestone-body">' +
                '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:10px;">' + window.PatelaUI.escapeHtml(m.description) + '</p>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                  (m.deliverables || []).map(function (d) { return '<span class="skill-tag">' + window.PatelaUI.escapeHtml(d) + '</span>'; }).join('') +
                '</div>' +
                subsHtml +
                '<div style="display:flex;justify-content:flex-end;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-subtle);">' +
                  '<button type="button" class="btn btn-secondary btn-sm" data-open-ms-fs="' + m.id + '">Open full-screen milestone workspace ↗</button>' +
                '</div>' +
              '</div>' +
            '</details>'
          );
        }).join('');

        msContainer.querySelectorAll('[data-open-ms-fs]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            const mId = btn.getAttribute('data-open-ms-fs');
            if (window.PatelaDetail) {
              window.PatelaDetail.openMilestone(project.id, mId, { onUpdate: renderWorkspace });
            }
          });
        });
      }

      // 3. Escrow Panel (Clean Primary Balances; Tertiary Hash in Modal)
      const escrowEl = document.getElementById('pd-escrow-panel');
      if (escrowEl) {
        escrowEl.innerHTML =
          '<div class="card-header">' +
            '<h2 class="section-title">Escrow custody</h2>' +
            '<span class="meta-text">' + project.network + '</span>' +
          '</div>' +
          '<div class="kv-list">' +
            '<div class="kv-row"><span class="kv-label">Remaining in escrow</span><span class="kv-value tabular text-gold" style="font-size:1rem;">$' + project.escrowBalance.toLocaleString('en-US') + ' ' + project.asset + '</span></div>' +
            '<div class="kv-row"><span class="kv-label">Released to freelancer</span><span class="kv-value tabular text-success">$' + project.released.toLocaleString('en-US') + ' ' + project.asset + '</span></div>' +
            '<div class="kv-row"><span class="kv-label">Total funded</span><span class="kv-value tabular">$' + project.funded.toLocaleString('en-US') + ' ' + project.asset + '</span></div>' +
            '<div class="kv-row"><span class="kv-label">Agreed budget</span><span class="kv-value tabular">$' + project.budget.toLocaleString('en-US') + ' ' + project.asset + '</span></div>' +
          '</div>' +
          '<div class="card-footer">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="pd-view-explorer-btn" style="padding-left:0;">Contract &amp; tx details ↗</button>' +
            (role === 'client' && project.funded < project.budget
              ? '<button type="button" class="btn btn-secondary btn-sm" id="pd-fund-remaining-btn">Fund $' + (project.budget - project.funded) + '</button>'
              : '') +
          '</div>';

        const expBtn = document.getElementById('pd-view-explorer-btn');
        if (expBtn) {
          expBtn.addEventListener('click', function () {
            window.PatelaUI.confirmAction({
              title: 'Escrow Contract Details (Demo)',
              description: 'Tertiary technical metadata and transaction references for ' + project.title + '.',
              meta: {
                'Project ID': project.id,
                'Network': project.network + ' (Demo)',
                'Asset': project.asset,
                'Transaction Reference': project.txRef,
                'Secured in Escrow': '$' + project.escrowBalance.toLocaleString('en-US') + ' ' + project.asset,
                'Released': '$' + project.released.toLocaleString('en-US') + ' ' + project.asset
              },
              confirmLabel: 'Close'
            });
          });
        }
      }

      // 4. Role-Specific Action Section
      const subSection = document.getElementById('pd-role-submission-panel');
      if (subSection) {
        if (role === 'worker') {
          subSection.innerHTML =
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">Submit milestone work</h2>' +
                '<p class="section-subtitle">Upload files and notes for AI verification</p>' +
              '</div>' +
            '</div>' +
            '<form id="worker-submit-deliverable-form" novalidate>' +
              '<div class="form-row">' +
                '<div class="form-group">' +
                  '<label class="form-label" for="worker-sub-milestone">Milestone</label>' +
                  '<select id="worker-sub-milestone" class="select">' +
                    project.milestones.filter(function (m) { return m.status !== 'Released'; }).map(function (m) {
                      return '<option value="' + m.id + '">' + window.PatelaUI.escapeHtml(m.name) + ' ($' + m.amount + ' ' + project.asset + ')</option>';
                    }).join('') +
                  '</select>' +
                '</div>' +
                '<div class="form-group">' +
                  '<label class="form-label" for="worker-sub-file">Deliverable file</label>' +
                  '<input type="file" id="worker-sub-file" class="input" style="padding-top:5px;" />' +
                '</div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label" for="worker-sub-link">Deliverable link</label>' +
                '<input type="url" id="worker-sub-link" class="input" value="https://figma.com/proto/patela-deliverable-v2" />' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label" for="worker-sub-note">Submission note</label>' +
                '<textarea id="worker-sub-note" class="textarea">Completed all responsive frames, exported SVG assets, and design token JSON files.</textarea>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<button type="button" class="btn btn-ghost btn-sm" id="worker-dispute-btn" style="color:var(--error);">Raise dispute</button>' +
                '<button type="submit" class="btn btn-primary">Submit for review</button>' +
              '</div>' +
            '</form>';

          const form = document.getElementById('worker-submit-deliverable-form');
          if (form) {
            form.addEventListener('submit', function (e) {
              e.preventDefault();
              const msId = document.getElementById('worker-sub-milestone').value;
              const fileInput = document.getElementById('worker-sub-file');
              const linkVal = document.getElementById('worker-sub-link').value.trim();
              const noteVal = document.getElementById('worker-sub-note').value.trim();

              if (!noteVal) {
                window.PatelaUI.toast('Note Required', 'Please include a short note describing your submission.');
                return;
              }

              const fileName = (fileInput && fileInput.files && fileInput.files[0])
                ? fileInput.files[0].name
                : 'deliverable-bundle-v2.zip';

              const st = window.PatelaStore.getState();
              const prj = st.projects.find(function (p) { return p.id === project.id; });
              if (prj) {
                const ms = prj.milestones.find(function (m) { return m.id === msId; }) || prj.milestones[1];
                if (ms) {
                  ms.status = 'Awaiting client approval';
                  ms.statusTone = 'gold';
                  ms.submissions = ms.submissions || [];
                  ms.submissions.unshift({
                    version: 'v' + (ms.submissions.length + 1) + '.0',
                    date: 'Just now',
                    author: 'Jordan Blake',
                    files: [fileName],
                    links: linkVal ? [linkVal] : [],
                    note: noteVal,
                    aiResult: 'Verified'
                  });
                }
                prj.status = 'Awaiting client approval';
                prj.statusTone = 'gold';
                prj.aiReport.status = 'Verified';
                prj.aiReport.overallResult = 'All deliverables verified against milestone requirements';
                prj.aiReport.failed = [];
                prj.timeline.unshift({
                  title: 'Jordan Blake submitted ' + (ms ? ms.name : msId),
                  time: 'Just now'
                });
                window.PatelaStore.saveState(st);
              }

              renderWorkspace();
              window.PatelaUI.toast('Milestone Submitted', 'AI verification passed. Client notified.');
            });
          }
        } else {
          const activeMs = project.milestones.find(function (m) {
            return m.status === 'Awaiting client approval' || m.status === 'Under AI review' || m.status === 'Revision requested';
          }) || project.milestones[project.milestones.length - 1];

          const latestSub = (activeMs && activeMs.submissions && activeMs.submissions[0]) || {
            version: 'v1.2',
            date: 'Today',
            author: project.workerName,
            files: ['patela-storefront-ui-v1.2.fig', 'design-tokens-v1.2.json'],
            links: ['https://figma.com/proto/patela-ecommerce-ui-v1-2'],
            note: 'Delivered all 24 high-fidelity desktop and mobile frames and component tokens.'
          };

          const canApprove = activeMs && activeMs.status !== 'Released' && project.escrowBalance >= activeMs.amount;

          subSection.innerHTML =
            '<div class="card-header">' +
              '<div>' +
                '<h2 class="section-title">' + window.PatelaUI.escapeHtml(activeMs.name) + '</h2>' +
                '<p class="section-subtitle">Submitted by ' + window.PatelaUI.escapeHtml(latestSub.author) + ' · ' + latestSub.version + '</p>' +
              '</div>' +
              '<span class="cell-amount text-gold">$' + activeMs.amount + ' ' + project.asset + '</span>' +
            '</div>' +
            '<p style="font-size:0.84375rem;color:var(--text-secondary);margin-bottom:12px;">"' + window.PatelaUI.escapeHtml(latestSub.note) + '"</p>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px;">' +
              (latestSub.files || []).map(function (f) { return '<span class="skill-tag mono">' + window.PatelaUI.escapeHtml(f) + '</span>'; }).join('') +
              (latestSub.links || []).map(function (l) { return '<span class="skill-tag" style="color:var(--blue);">↗ Prototype link</span>'; }).join('') +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--border-subtle);">' +
              '<div style="display:flex;gap:8px;">' +
                '<button type="button" class="btn btn-secondary btn-sm" id="client-request-revision-btn">Request revision</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="client-dispute-btn" style="color:var(--error);">Dispute</button>' +
              '</div>' +
              '<button type="button" class="btn btn-primary" id="client-approve-milestone-btn" ' + (canApprove ? '' : 'disabled') + '>' +
                (canApprove ? 'Approve &amp; release $' + activeMs.amount + ' ' + project.asset : 'Settled') +
              '</button>' +
            '</div>';

          const approveBtn = document.getElementById('client-approve-milestone-btn');
          if (approveBtn && canApprove) {
            approveBtn.addEventListener('click', function () {
              window.PatelaUI.confirmAction({
                title: 'Approve & Release Payment',
                description: 'Release $' + activeMs.amount + ' ' + project.asset + ' from escrow to ' + project.workerName + ' for ' + activeMs.name + '.',
                meta: {
                  'Milestone': activeMs.name,
                  'Amount': '$' + activeMs.amount.toLocaleString('en-US') + ' ' + project.asset,
                  'Recipient': project.workerName
                },
                confirmLabel: 'Release $' + activeMs.amount + ' ' + project.asset,
                onConfirm: function () {
                  const st = window.PatelaStore.getState();
                  const prj = st.projects.find(function (p) { return p.id === project.id; });
                  if (prj) {
                    const ms = prj.milestones.find(function (m) { return m.id === activeMs.id; });
                    if (ms) {
                      ms.status = 'Released';
                      ms.statusTone = 'success';
                      prj.released += ms.amount;
                      prj.escrowBalance = Math.max(0, prj.escrowBalance - ms.amount);
                      st.profiles.client.metrics.totalPaid += ms.amount;
                      st.profiles.client.metrics.awaitingReview = Math.max(0, st.profiles.client.metrics.awaitingReview - 1);
                      st.profiles.worker.metrics.totalEarned += ms.amount;
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
                      title: 'Approved ' + activeMs.name + ' ($' + activeMs.amount + ' ' + prj.asset + ' released)',
                      time: 'Just now'
                    });
                    st.transactions.unshift({
                      id: 'TX-' + Math.floor(9050 + Math.random() * 900),
                      type: 'Milestone Release',
                      roleScope: ['client', 'worker'],
                      projectId: prj.id,
                      project: prj.title + ' (' + activeMs.name + ')',
                      counterpartyClient: prj.clientName,
                      counterpartyWorker: prj.workerName,
                      amount: activeMs.amount,
                      asset: prj.asset,
                      network: prj.network,
                      date: '2026-11-08',
                      displayDate: 'Just now',
                      status: 'Completed',
                      statusTone: 'success',
                      txHash: '0x99f2c10e84d12a77b309e41c8812a40e719c20f4',
                      blockNumber: '18,492,810'
                    });
                    window.PatelaStore.saveState(st);
                  }
                  renderWorkspace();
                  window.PatelaUI.toast('Payment Released', '$' + activeMs.amount + ' ' + project.asset + ' released to ' + project.workerName + '.');
                }
              });
            });
          }

          const revBtn = document.getElementById('client-request-revision-btn');
          if (revBtn) {
            revBtn.addEventListener('click', function () {
              window.PatelaUI.openModal('request-revision-modal');
            });
          }
        }

        const dispBtn = document.getElementById('client-dispute-btn') || document.getElementById('worker-dispute-btn');
        if (dispBtn) {
          dispBtn.addEventListener('click', function () {
            window.PatelaUI.confirmAction({
              title: 'Raise Milestone Dispute',
              description: 'Funds ($' + project.escrowBalance.toLocaleString('en-US') + ' ' + project.asset + ') remain secured in the smart contract while a human reviewer evaluates the submission and AI verification report.',
              variant: 'danger',
              meta: {
                'Project': project.title,
                'Secured in Escrow': '$' + project.escrowBalance.toLocaleString('en-US') + ' ' + project.asset
              },
              confirmLabel: 'Open Dispute',
              onConfirm: function () {
                const st = window.PatelaStore.getState();
                const prj = st.projects.find(function (p) { return p.id === project.id; });
                if (prj) {
                  prj.status = 'Disputed';
                  prj.statusTone = 'error';
                  prj.timeline.unshift({
                    title: 'Dispute opened — funds remain locked in escrow',
                    time: 'Just now'
                  });
                  window.PatelaStore.saveState(st);
                }
                renderWorkspace();
                window.PatelaUI.toast('Dispute Opened', 'Escrow funds remain secured during review.');
              }
            });
          });
        }
      }

      // 5. AI Verification Panel (Concise Checklist + Progressive Disclosure for Notes)
      const aiPanel = document.getElementById('pd-ai-verification-panel');
      if (aiPanel) {
        const rep = project.aiReport;
        aiPanel.innerHTML =
          '<div class="card-header">' +
            '<div>' +
              '<h2 class="section-title">AI verification</h2>' +
              '<p class="section-subtitle">' + window.PatelaUI.escapeHtml(rep.overallResult) + '</p>' +
            '</div>' +
            '<span class="badge ' + (rep.failed && rep.failed.length > 0 ? 'badge-warning' : 'badge-success') + '">' +
              (rep.failed && rep.failed.length > 0 ? 'Action needed' : 'Verified') +
            '</span>' +
          '</div>' +
          '<div class="ai-check-list">' +
            rep.passed.map(function (item) {
              return (
                '<div class="ai-check-row">' +
                  '<span class="ai-check-icon pass">✓</span>' +
                  '<span>' + window.PatelaUI.escapeHtml(item) + '</span>' +
                '</div>'
              );
            }).join('') +
            (rep.failed || []).map(function (item) {
              return (
                '<div class="ai-check-row">' +
                  '<span class="ai-check-icon warn">!</span>' +
                  '<span style="color:var(--warning);">' + window.PatelaUI.escapeHtml(item) + '</span>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
          '<details style="margin-top:12px;">' +
            '<summary class="meta-text" style="cursor:pointer;color:var(--gold-light);">View AI explanation &amp; recommendations ▾</summary>' +
            '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-top:8px;line-height:1.55;">' + window.PatelaUI.escapeHtml(rep.explanation) + '</p>' +
            '<p class="meta-text" style="margin-top:6px;">Next step: ' + window.PatelaUI.escapeHtml(rep.suggestedChanges) + '</p>' +
          '</details>';
      }

      // 6. Activity Timeline (Compact, Max 4 items)
      const timelineEl = document.getElementById('pd-activity-timeline');
      if (timelineEl) {
        timelineEl.innerHTML = (project.timeline || []).slice(0, 4).map(function (ev) {
          return (
            '<div class="activity-row">' +
              '<div class="activity-left">' +
                '<span class="activity-bullet"></span>' +
                '<span class="activity-text">' + window.PatelaUI.escapeHtml(ev.title) + '</span>' +
              '</div>' +
              '<span class="activity-sub">' + window.PatelaUI.escapeHtml(ev.time) + '</span>' +
            '</div>'
          );
        }).join('');
      }
    }

    const revConfirmBtn = document.getElementById('confirm-revision-submit-btn');
    if (revConfirmBtn) {
      revConfirmBtn.addEventListener('click', function () {
        const noteEl = document.getElementById('revision-feedback-textarea');
        const feedback = noteEl ? noteEl.value.trim() : '';
        if (!feedback) {
          window.PatelaUI.toast('Feedback Required', 'Please specify what revision is needed.');
          return;
        }
        const st = window.PatelaStore.getState();
        const prj = st.projects.find(function (p) { return p.id === projId; }) || st.projects[0];
        if (prj) {
          prj.status = 'Revision requested';
          prj.statusTone = 'warning';
          prj.timeline.unshift({
            title: 'Revision requested: "' + feedback + '"',
            time: 'Just now'
          });
          window.PatelaStore.saveState(st);
        }
        window.PatelaUI.closeModal('request-revision-modal');
        renderWorkspace();
        window.PatelaUI.toast('Revision Requested', 'Freelancer notified.');
      });
    }

    renderWorkspace();
  }

  /* ========================================================================
     3. PAYMENTS & EARNINGS PAGE (payments.html)
     Multi-Asset Clarity · Interactive 7-Stage Flow Diagram · Full Filtering
     ======================================================================== */
  function initPaymentsPage() {
    const root = document.getElementById('payments-page-root');
    if (!root) return;

    const role = window.PatelaStore.getRole();
    const state = window.PatelaStore.getState();

    const titleEl = document.getElementById('payments-page-title');
    const subEl = document.getElementById('payments-page-subtitle');
    const metricsEl = document.getElementById('payments-role-metrics');
    const multiAssetEl = document.getElementById('payments-multi-asset-strip');

    if (titleEl) {
      titleEl.textContent = role === 'worker' ? 'Earnings & Escrow Custody' : 'Payments & Escrow Custody';
    }
    if (subEl) {
      subEl.textContent = role === 'worker'
        ? 'Received payouts, available wallet balances by asset, and contract-secured escrow.'
        : 'Escrow deposits, released milestone payments, multi-asset balances, and transaction history.';
    }

    if (metricsEl) {
      if (role === 'worker') {
        metricsEl.innerHTML =
          '<div class="metric-card gold-accent" data-detail-type="metric" data-detail-id="worker-earned">' +
            '<div class="metric-label">Total received (settled)</div>' +
            '<div class="metric-value tabular">5,420.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">Across 26 approved milestones · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card" data-detail-type="metric" data-detail-id="worker-earned">' +
            '<div class="metric-label">Available wallet balance</div>' +
            '<div class="metric-value tabular">3,180.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">Immediately withdrawable · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card" data-detail-type="metric" data-detail-id="worker-escrow">' +
            '<div class="metric-label">Locked in escrow</div>' +
            '<div class="metric-value tabular">1,850.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">Secured · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card" data-detail-type="metric" data-detail-id="worker-pending">' +
            '<div class="metric-label">Pending payouts</div>' +
            '<div class="metric-value tabular">620.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">Approved · Click to expand ↗</div>' +
          '</div>';
      } else {
        metricsEl.innerHTML =
          '<div class="metric-card" data-detail-type="metric" data-detail-id="client-paid">' +
            '<div class="metric-label">Total spent (released)</div>' +
            '<div class="metric-value tabular">8,320.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">17 milestones settled · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card" data-detail-type="metric" data-detail-id="client-paid">' +
            '<div class="metric-label">Available wallet balance</div>' +
            '<div class="metric-value tabular">6,450.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">Ready for escrow funding · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card gold-accent" data-detail-type="metric" data-detail-id="client-escrow">' +
            '<div class="metric-label">Locked in escrow</div>' +
            '<div class="metric-value tabular">2,450.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">2,050.00 active · 400.00 in review · Click to expand ↗</div>' +
          '</div>' +
          '<div class="metric-card" data-detail-type="metric" data-detail-id="client-review">' +
            '<div class="metric-label">Pending approval</div>' +
            '<div class="metric-value tabular">400.00<span class="metric-unit">USDC</span></div>' +
            '<div class="metric-foot">PRJ-201 M2 AI-verified · Click to expand ↗</div>' +
          '</div>';
      }
    }

    if (multiAssetEl) {
      if (role === 'worker') {
        multiAssetEl.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">' +
            '<div>' +
              '<div style="font-size:0.8125rem;font-weight:500;color:var(--text-primary);">Multi-asset wallet &amp; custody separation (Demo)</div>' +
              '<div class="meta-text">Balances are shown by asset without automatic conversion. Escrow funds remain locked until client approval.</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
              '<span class="badge badge-success">Wallet USDC: 3,180.00 USDC</span>' +
              '<span class="badge badge-neutral">Wallet USDT: 450.00 USDT</span>' +
              '<span class="badge badge-gold">Escrow Locked: 1,850.00 USDC</span>' +
              '<span class="badge badge-blue">Protocol Fees Paid: 81.30 USDC</span>' +
            '</div>' +
          '</div>';
      } else {
        multiAssetEl.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">' +
            '<div>' +
              '<div style="font-size:0.8125rem;font-weight:500;color:var(--text-primary);">Multi-asset wallet &amp; escrow custody separation (Demo)</div>' +
              '<div class="meta-text">Balances are separated by custody state and asset. Deposited: 10,970.00 USDC (8,320.00 released + 2,450.00 locked + 200.00 refunded).</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;">' +
              '<span class="badge badge-success">Wallet USDC: 6,450.00 USDC</span>' +
              '<span class="badge badge-neutral">Wallet USDT: 1,200.00 USDT</span>' +
              '<span class="badge badge-gold">Locked Escrow: 2,450.00 USDC</span>' +
              '<span class="badge badge-blue">Refunded: 200.00 USDC</span>' +
            '</div>' +
          '</div>';
      }
    }

    // Section 5: Interactive 7-Stage Financial Flow Diagram
    const flowNodesEl = document.getElementById('patela-flow-nodes');
    const flowInspectorEl = document.getElementById('patela-flow-inspector');

    if (flowNodesEl && flowInspectorEl) {
      const flowStages = [
        {
          id: 1,
          title: '1. Client deposits funds',
          tag: 'Funds deposited',
          tagClass: 'deposited',
          amount: role === 'worker' ? '3,520.00 USDC across 3 contracts' : '10,970.00 USDC deposited all-time',
          desc: 'Client pre-funds the agreed milestone budget in USDC or USDT before work starts. No work begins on unfunded promises.'
        },
        {
          id: 2,
          title: '2. Smart contract locks funds',
          tag: 'Funds locked',
          tagClass: 'locked',
          amount: role === 'worker' ? '1,850.00 USDC currently locked' : '2,050.00 USDC locked in active work',
          desc: 'Funds are isolated inside the project escrow vault. Neither party can unilaterally withdraw locked milestone funds.'
        },
        {
          id: 3,
          title: '3. Worker completes milestone',
          tag: 'Funds locked',
          tagClass: 'locked',
          amount: '3 active milestones in execution',
          desc: 'Freelancer executes the agreed scope knowing 100% of the milestone payout is already secured in the contract.'
        },
        {
          id: 4,
          title: '4. Deliverables submitted',
          tag: 'Funds awaiting review',
          tagClass: 'review',
          amount: '400.00 USDC on PRJ-204 M2',
          desc: 'Worker uploads deliverables, design bundles, or repository links against the milestone acceptance criteria.'
        },
        {
          id: 5,
          title: '5. AI reviews submission',
          tag: 'Funds awaiting review',
          tagClass: 'review',
          amount: '400.00 USDC verified on PRJ-201 M2',
          desc: 'Patela AI verifier inspects deliverables deterministically against the checklist and produces an advisory verification report.'
        },
        {
          id: 6,
          title: '6. Approval or dispute process',
          tag: 'Funds awaiting review',
          tagClass: 'review',
          amount: role === 'worker' ? '620.00 USDC approved (PRJ-205)' : '400.00 USDC ready for client sign-off',
          desc: 'Client approves the verified submission or requests a targeted revision. If disputed, funds remain locked during review.'
        },
        {
          id: 7,
          title: '7. Funds released or stay locked',
          tag: 'Funds released',
          tagClass: 'released',
          amount: role === 'worker' ? '5,420.00 USDC released to wallet' : '8,320.00 USDC released to workers',
          desc: 'Upon approval, the escrow contract releases the exact milestone amount (less 1.5% protocol fee) to the worker wallet.'
        }
      ];

      let activeStageId = 5;

      function renderFlowDiagram() {
        flowNodesEl.innerHTML = flowStages.map(function (st) {
          const isAct = st.id === activeStageId;
          return (
            '<button type="button" class="flow-node ' + (isAct ? 'active' : '') + '" data-flow-stage="' + st.id + '">' +
              '<div>' +
                '<span class="flow-node-stage-tag ' + st.tagClass + '">' + st.tag + '</span>' +
                '<div style="font-size:0.78rem;font-weight:500;color:var(--text-primary);margin-top:8px;line-height:1.35;">' + st.title + '</div>' +
              '</div>' +
              '<div class="meta-text tabular" style="font-size:0.68rem;color:var(--text-secondary);">' + st.amount + '</div>' +
            '</button>'
          );
        }).join('');

        const current = flowStages.find(function (s) { return s.id === activeStageId; }) || flowStages[0];
        flowInspectorEl.innerHTML =
          '<div style="flex:1;min-width:240px;">' +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;flex-wrap:wrap;">' +
              '<span style="font-weight:600;color:var(--gold-light);font-size:0.875rem;">' + current.title + '</span>' +
              '<span class="flow-node-stage-tag ' + current.tagClass + '">' + current.tag + '</span>' +
            '</div>' +
            '<p style="font-size:0.8125rem;color:var(--text-secondary);line-height:1.55;">' + current.desc + '</p>' +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div class="meta-text">Prototype state in this stage</div>' +
            '<div class="cell-amount tabular text-gold" style="font-size:0.95rem;">' + current.amount + '</div>' +
            '<div class="meta-text" style="font-size:0.68rem;">Simulated workflow — no live on-chain tx</div>' +
          '</div>';

        flowNodesEl.querySelectorAll('[data-flow-stage]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeStageId = Number(btn.getAttribute('data-flow-stage'));
            renderFlowDiagram();
          });
        });
      }

      renderFlowDiagram();
    }

    const searchInput = document.getElementById('tx-search-input');
    const typeSelect = document.getElementById('tx-type-filter');
    const statusSelect = document.getElementById('tx-status-filter');
    const assetSelect = document.getElementById('tx-asset-filter');
    const networkSelect = document.getElementById('tx-network-filter');
    const dateSelect = document.getElementById('tx-date-filter');
    const resetBtn = document.getElementById('tx-reset-btn');
    const tbody = document.getElementById('tx-table-tbody');

    function renderTransactions() {
      const st = window.PatelaStore.getState();
      const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const tFilter = typeSelect ? typeSelect.value : 'all';
      const sFilter = statusSelect ? statusSelect.value : 'all';
      const aFilter = assetSelect ? assetSelect.value : 'all';
      const nFilter = networkSelect ? networkSelect.value : 'all';
      const dFilter = dateSelect ? dateSelect.value : 'all';

      // Reference date for prototype is 2026-11-08
      const refTime = new Date('2026-11-08T23:59:59Z').getTime();

      const list = st.transactions.filter(function (tx) {
        if (tx.roleScope.indexOf(role) === -1) return false;
        if (tFilter !== 'all' && tx.type !== tFilter) return false;
        if (sFilter !== 'all' && tx.status !== sFilter) return false;
        if (aFilter !== 'all' && tx.asset !== aFilter) return false;
        if (nFilter !== 'all' && tx.network !== nFilter) return false;
        if (dFilter !== 'all' && tx.date) {
          const txTime = new Date(tx.date + 'T00:00:00Z').getTime();
          const diffDays = (refTime - txTime) / (1000 * 60 * 60 * 24);
          if (dFilter === '7d' && diffDays > 7) return false;
          if (dFilter === '30d' && diffDays > 30) return false;
          if (dFilter === '90d' && diffDays > 90) return false;
        }
        if (q) {
          const hay = (tx.project + ' ' + tx.type + ' ' + tx.network + ' ' + tx.asset + ' ' + tx.txHash + ' ' + tx.id).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        return true;
      });

      if (list.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="8"><div class="empty-state"><div class="empty-title">No transactions match your filters</div><div class="empty-desc">Try clearing the active type, network, or date range filter.</div><button type="button" class="btn btn-secondary btn-sm" id="tx-empty-reset" style="margin-top:8px;">Reset filters</button></div></td></tr>';
        const r = document.getElementById('tx-empty-reset');
        if (r) r.addEventListener('click', resetTxFilters);
        return;
      }

      tbody.innerHTML = list.map(function (tx) {
        const formattedAmt = Number(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + tx.asset;
        return (
          '<tr data-tx-row="' + tx.id + '" style="cursor:pointer;">' +
            '<td>' +
              '<span class="cell-title">' + window.PatelaUI.escapeHtml(tx.type) + '</span>' +
              '<span class="cell-sub mono">' + tx.id + '</span>' +
            '</td>' +
            '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(tx.project) + '</td>' +
            '<td><span class="meta-text">' + tx.displayDate + '</span></td>' +
            '<td><span class="badge badge-neutral">' + tx.asset + '</span></td>' +
            '<td style="color:var(--text-secondary);font-size:0.8125rem;">' + window.PatelaUI.escapeHtml(tx.network) + '</td>' +
            '<td><span class="' + window.PatelaUI.badgeClass(tx.statusTone) + '">' + tx.status + '</span></td>' +
            '<td class="right"><span class="cell-amount tabular">' + formattedAmt + '</span></td>' +
            '<td class="right"><button type="button" class="btn btn-ghost btn-sm" data-open-tx="' + tx.id + '">Details →</button></td>' +
          '</tr>'
        );
      }).join('');

      tbody.querySelectorAll('[data-open-tx], [data-tx-row]').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          const id = el.getAttribute('data-open-tx') || el.getAttribute('data-tx-row');
          if (window.PatelaDetail) {
            window.PatelaDetail.openTransaction(id);
          }
        });
      });
    }

    function resetTxFilters() {
      if (searchInput) searchInput.value = '';
      if (typeSelect) typeSelect.value = 'all';
      if (statusSelect) statusSelect.value = 'all';
      if (assetSelect) assetSelect.value = 'all';
      if (networkSelect) networkSelect.value = 'all';
      if (dateSelect) dateSelect.value = 'all';
      renderTransactions();
    }

    [searchInput, typeSelect, statusSelect, assetSelect, networkSelect, dateSelect].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', renderTransactions);
      el.addEventListener('change', renderTransactions);
    });
    if (resetBtn) resetBtn.addEventListener('click', resetTxFilters);

    renderTransactions();
  }

  /* ========================================================================
     3B. SUBMISSIONS PAGE (submissions.html)
     ======================================================================== */
  function initSubmissionsPage() {
    const root = document.getElementById('submissions-page-root');
    if (!root) return;

    document.querySelectorAll('[data-sub-filter]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        const filterVal = tab.getAttribute('data-sub-filter');
        document.querySelectorAll('[data-sub-filter]').forEach(function (t) {
          t.classList.toggle('active', t === tab);
        });
        document.querySelectorAll('[data-sub-status]').forEach(function (row) {
          const st = row.getAttribute('data-sub-status');
          row.style.display = (filterVal === 'all' || st === filterVal) ? '' : 'none';
        });
      });
    });
  }

  /* ========================================================================
     4. MESSAGES PAGE (messages.html)
     ======================================================================== */
  function initMessagesPage() {
    const root = document.getElementById('messages-page-root');
    if (!root) return;

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();
    let activeThreadId = state.messages[0].id;

    const threadsEl = document.getElementById('msg-threads-list');
    const chatBodyEl = document.getElementById('msg-chat-body');
    const chatHeaderEl = document.getElementById('msg-chat-header');
    const sendForm = document.getElementById('msg-send-form');
    const msgInput = document.getElementById('msg-text-input');

    function renderMessages() {
      const st = window.PatelaStore.getState();
      const activeThread = st.messages.find(function (m) { return m.id === activeThreadId; }) || st.messages[0];

      if (threadsEl) {
        threadsEl.innerHTML = st.messages.map(function (t) {
          const isAct = t.id === activeThread.id;
          return (
            '<button type="button" class="action-item" data-thread-id="' + t.id + '" style="width:100%;text-align:left;background:' + (isAct ? 'rgba(217,189,139,0.06)' : 'transparent') + ';">' +
              '<div>' +
                '<div class="action-title">' + window.PatelaUI.escapeHtml(t.projectTitle) + '</div>' +
                '<div class="action-desc">' + window.PatelaUI.escapeHtml(role === 'worker' ? t.counterpartyClient : t.counterpartyWorker) + '</div>' +
              '</div>' +
              '<span class="meta-text">' + t.updatedAt + '</span>' +
            '</button>'
          );
        }).join('');

        threadsEl.querySelectorAll('[data-thread-id]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            activeThreadId = btn.getAttribute('data-thread-id');
            renderMessages();
          });
        });
      }

      if (chatHeaderEl) {
        chatHeaderEl.innerHTML =
          '<div>' +
            '<div class="card-title">' + window.PatelaUI.escapeHtml(activeThread.projectTitle) + '</div>' +
            '<div class="meta-text">' + activeThread.counterpartyClient + ' &amp; ' + activeThread.counterpartyWorker + '</div>' +
          '</div>' +
          '<a href="project-detail.html?id=' + activeThread.projectId + '" class="btn btn-secondary btn-sm">Open project</a>';
      }

      if (chatBodyEl) {
        chatBodyEl.innerHTML = activeThread.entries.map(function (e) {
          const isMe = e.role === role;
          return (
            '<div style="display:flex;flex-direction:column;align-items:' + (isMe ? 'flex-end' : 'flex-start') + ';margin-bottom:14px;">' +
              '<div style="max-width:75%;padding:11px 14px;border-radius:var(--radius-sm);background:' + (isMe ? 'var(--gold-subtle)' : 'var(--surface-elevated)') + ';border:1px solid ' + (isMe ? 'var(--border-gold)' : 'var(--border-subtle)') + ';">' +
                '<div class="meta-text" style="margin-bottom:4px;">' + window.PatelaUI.escapeHtml(e.sender) + ' · ' + e.time + '</div>' +
                '<div style="font-size:0.84375rem;color:var(--text-primary);">' + window.PatelaUI.escapeHtml(e.text) + '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }
    }

    if (sendForm) {
      sendForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const txt = msgInput ? msgInput.value.trim() : '';
        if (!txt) return;
        const st = window.PatelaStore.getState();
        const th = st.messages.find(function (m) { return m.id === activeThreadId; }) || st.messages[0];
        const senderName = st.profiles[role].name;
        th.entries.push({
          sender: senderName,
          role: role,
          time: 'Just now',
          text: txt
        });
        th.updatedAt = 'Just now';
        window.PatelaStore.saveState(st);
        msgInput.value = '';
        renderMessages();
      });
    }

    renderMessages();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initProjectsPage();
    initProjectDetailPage();
    initPaymentsPage();
    initSubmissionsPage();
    initMessagesPage();
  });
})();
