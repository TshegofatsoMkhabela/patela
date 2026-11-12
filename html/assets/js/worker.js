/* ==========================================================================
   PATELA — WORKER OVERVIEW & MARKETPLACE (worker.js)
   Refined Hierarchy · Reduced Density · Progressive Disclosure
   ========================================================================== */

(function () {
  function initWorkerDashboard() {
    const root = document.getElementById('worker-dashboard-root');
    if (!root) return;

    const state = window.PatelaStore.getState();
    const workerProjects = state.projects.filter(function (p) {
      return p.roles.indexOf('worker') !== -1;
    });

    window.PatelaUI.animateMetricsOnce('worker_overview');

    // D. Active Projects (Max 5 — Only Project Name, Client, Current Milestone, Deadline, Status)
    const projTbody = document.getElementById('worker-overview-projects-tbody');
    if (projTbody) {
      if (workerProjects.length === 0) {
        projTbody.innerHTML =
          '<tr><td colspan="6">' +
            '<div class="empty-state">' +
              '<div class="empty-title">No active projects</div>' +
              '<div class="empty-desc">Explore the marketplace to apply for escrow-backed work.</div>' +
            '</div>' +
          '</td></tr>';
      } else {
        projTbody.innerHTML = workerProjects.slice(0, 5).map(function (p) {
          return (
            '<tr data-open-proj="' + p.id + '" style="cursor:pointer;">' +
              '<td><span class="cell-title">' + window.PatelaUI.escapeHtml(p.title) + '</span></td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.clientName) + '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.currentMilestone) + '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.deadline) + '</td>' +
              '<td><span class="' + window.PatelaUI.badgeClass(p.statusTone) + '">' + window.PatelaUI.escapeHtml(p.status) + '</span></td>' +
              '<td class="right">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-open-proj="' + p.id + '">Open →</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('');

        projTbody.querySelectorAll('[data-open-proj]').forEach(function (el) {
          el.addEventListener('click', function (e) {
            e.stopPropagation();
            window.PatelaDetail.openProject(el.getAttribute('data-open-proj'), { onUpdate: initWorkerDashboard });
          });
        });
      }
    }

    // E. Recommended Opportunities (Max 3 — Selectable Full-Screen Cards)
    const recGrid = document.getElementById('worker-recommended-jobs-grid');
    if (recGrid) {
      const topThree = state.marketplaceJobs.slice(0, 3);
      if (topThree.length === 0) {
        recGrid.innerHTML =
          '<div class="card empty-state" style="grid-column:1 / -1;">' +
            '<div class="empty-title">No recommended jobs right now</div>' +
            '<div class="empty-desc">Check back soon for new opportunities.</div>' +
          '</div>';
      } else {
        recGrid.innerHTML = topThree.map(function (j) {
          return (
            '<article class="card selectable-card" data-open-rec-job="' + j.id + '" style="display:flex;flex-direction:column;justify-content:space-between;gap:16px;">' +
              '<div>' +
                '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px;">' +
                  '<span class="cell-amount" style="color:var(--gold-light);">$' + j.budget.toLocaleString('en-US') + ' ' + j.asset + '</span>' +
                  '<span class="meta-text">' + j.duration + '</span>' +
                '</div>' +
                '<h3 class="card-title" style="margin-bottom:6px;">' + window.PatelaUI.escapeHtml(j.title) + '</h3>' +
                '<div class="meta-text" style="margin-bottom:12px;">' + window.PatelaUI.escapeHtml(j.clientName) + '</div>' +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                  j.skills.slice(0, 3).map(function (s) { return '<span class="skill-tag">' + window.PatelaUI.escapeHtml(s) + '</span>'; }).join('') +
                '</div>' +
              '</div>' +
              '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border-subtle);">' +
                '<span class="meta-text">' + j.proposals + ' proposals</span>' +
                '<span class="card-expand-hint">' + (j.applied ? 'Applied ✓ · View' : 'Open workspace →') + '</span>' +
              '</div>' +
            '</article>'
          );
        }).join('');

        recGrid.querySelectorAll('[data-open-rec-job]').forEach(function (card) {
          card.addEventListener('click', function () {
            window.PatelaDetail.openJob(card.getAttribute('data-open-rec-job'), { onUpdate: initWorkerDashboard });
          });
        });
      }
    }
  }

  /* ========================================================================
     MARKETPLACE JOB DISCOVERY & PROPOSAL SUBMISSION (marketplace.html)
     ======================================================================== */
  function initMarketplace() {
    const mpRoot = document.getElementById('marketplace-root');
    if (!mpRoot) return;

    const searchInput = document.getElementById('mp-search-input');
    const categorySelect = document.getElementById('mp-category-filter');
    const budgetSelect = document.getElementById('mp-budget-filter');
    const assetSelect = document.getElementById('mp-asset-filter');
    const expSelect = document.getElementById('mp-exp-filter');
    const sortSelect = document.getElementById('mp-sort-select');
    const resetBtn = document.getElementById('mp-reset-filters-btn');
    const jobsContainer = document.getElementById('mp-jobs-grid');
    const countLabel = document.getElementById('mp-results-count');

    let selectedJobId = null;

    function filterAndRender() {
      const state = window.PatelaStore.getState();
      const q = (searchInput ? searchInput.value : '').toLowerCase().trim();
      const cat = categorySelect ? categorySelect.value : 'all';
      const bud = budgetSelect ? budgetSelect.value : 'all';
      const ast = assetSelect ? assetSelect.value : 'all';
      const exp = expSelect ? expSelect.value : 'all';
      const sortBy = sortSelect ? sortSelect.value : 'newest';

      let list = state.marketplaceJobs.filter(function (j) {
        if (q) {
          const hay = (j.title + ' ' + j.description + ' ' + j.skills.join(' ') + ' ' + j.clientName).toLowerCase();
          if (hay.indexOf(q) === -1) return false;
        }
        if (cat !== 'all' && j.category !== cat) return false;
        if (ast !== 'all' && j.asset !== ast) return false;
        if (exp !== 'all' && j.experience !== exp) return false;
        if (bud === 'under-1500' && j.budget >= 1500) return false;
        if (bud === '1500-2500' && (j.budget < 1500 || j.budget > 2500)) return false;
        if (bud === 'over-2500' && j.budget <= 2500) return false;
        return true;
      });

      if (sortBy === 'budget-high') {
        list.sort(function (a, b) { return b.budget - a.budget; });
      } else if (sortBy === 'budget-low') {
        list.sort(function (a, b) { return a.budget - b.budget; });
      } else if (sortBy === 'proposals') {
        list.sort(function (a, b) { return a.proposals - b.proposals; });
      }

      if (countLabel) {
        countLabel.textContent = list.length + ' ' + (list.length === 1 ? 'opportunity' : 'opportunities');
      }

      if (list.length === 0) {
        jobsContainer.innerHTML =
          '<div class="card empty-state" style="grid-column:1 / -1;">' +
            '<div class="empty-title">No matching jobs</div>' +
            '<div class="empty-desc">Try adjusting your search or clearing the active filters.</div>' +
            '<button type="button" class="btn btn-secondary btn-sm" id="mp-empty-reset-btn" style="margin-top:8px;">Reset filters</button>' +
          '</div>';
        const emptyReset = document.getElementById('mp-empty-reset-btn');
        if (emptyReset) emptyReset.addEventListener('click', resetAllFilters);
        return;
      }

      jobsContainer.innerHTML = list.map(function (j) {
        return (
          '<article class="card selectable-card" data-open-job="' + j.id + '" style="display:flex;flex-direction:column;justify-content:space-between;gap:18px;">' +
            '<div>' +
              '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px;">' +
                '<span class="cell-amount" style="font-size:1.05rem;color:var(--gold-light);">$' + j.budget.toLocaleString('en-US') + ' ' + j.asset + '</span>' +
                '<span class="meta-text">' + j.duration + ' · ' + j.experience + '</span>' +
              '</div>' +
              '<h2 class="card-title" style="font-size:1rem;margin-bottom:6px;">' +
                window.PatelaUI.escapeHtml(j.title) +
              '</h2>' +
              '<p style="font-size:0.8125rem;color:var(--text-secondary);margin-bottom:14px;">' +
                window.PatelaUI.escapeHtml(j.description) +
              '</p>' +
              '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
                j.skills.map(function (s) { return '<span class="skill-tag">' + window.PatelaUI.escapeHtml(s) + '</span>'; }).join('') +
              '</div>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid var(--border-subtle);gap:10px;">' +
              '<span class="meta-text">' + window.PatelaUI.escapeHtml(j.clientName) + ' · ' + j.proposals + ' proposals</span>' +
              '<span class="card-expand-hint">' +
                (j.applied ? 'Applied ✓ · Open workspace →' : 'Open full-screen workspace →') +
              '</span>' +
            '</div>' +
          '</article>'
        );
      }).join('');

      jobsContainer.querySelectorAll('[data-open-job]').forEach(function (el) {
        el.addEventListener('click', function () {
          openJobDetailModal(el.getAttribute('data-open-job'));
        });
      });
    }

    function openJobDetailModal(jobId) {
      window.PatelaDetail.openJob(jobId, { onUpdate: filterAndRender });
    }

    const submitProposalBtn = document.getElementById('job-modal-submit-proposal-btn');
    if (submitProposalBtn) {
      submitProposalBtn.addEventListener('click', function () {
        const noteEl = document.getElementById('proposal-note-input');
        if (noteEl && !noteEl.value.trim()) {
          window.PatelaUI.toast('Proposal Note Required', 'Please include a short cover note.');
          return;
        }
        const st = window.PatelaStore.getState();
        const job = st.marketplaceJobs.find(function (j) { return j.id === selectedJobId; });
        if (job) {
          if (!job.applied) job.proposals += 1;
          job.applied = true;
          window.PatelaStore.saveState(st);
        }
        window.PatelaUI.closeModal('job-detail-modal');
        filterAndRender();
        window.PatelaUI.toast('Proposal Sent', 'Submitted for ' + (job ? job.title : selectedJobId) + '.');
      });
    }

    function resetAllFilters() {
      if (searchInput) searchInput.value = '';
      if (categorySelect) categorySelect.value = 'all';
      if (budgetSelect) budgetSelect.value = 'all';
      if (assetSelect) assetSelect.value = 'all';
      if (expSelect) expSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'newest';
      filterAndRender();
    }

    [searchInput, categorySelect, budgetSelect, assetSelect, expSelect, sortSelect].forEach(function (el) {
      if (!el) return;
      el.addEventListener('input', filterAndRender);
      el.addEventListener('change', filterAndRender);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', resetAllFilters);
    }

    filterAndRender();

    const urlJob = window.PatelaUI.getQueryParam('job');
    if (urlJob) {
      openJobDetailModal(urlJob);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initWorkerDashboard();
    initMarketplace();
  });
})();
