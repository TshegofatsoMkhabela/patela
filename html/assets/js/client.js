/* ==========================================================================
   PATELA — CLIENT OVERVIEW & POST-JOB WIZARD (client.js)
   Refined Hierarchy · Reduced Density · Progressive Disclosure
   ========================================================================== */

(function () {
  let previewEmptyAttention = false;

  function initClientDashboard() {
    const root = document.getElementById('client-dashboard-root');
    if (!root) return;

    const state = window.PatelaStore.getState();
    const clientProjects = state.projects.filter(function (p) {
      return p.roles.indexOf('client') !== -1;
    });

    const activeList = clientProjects.filter(function (p) { return p.status !== 'Completed'; });
    const totalEscrow = activeList.reduce(function (sum, p) { return sum + (Number(p.escrowBalance) || 0); }, 0);

    const elActive = document.getElementById('metric-client-active');
    const elEscrow = document.getElementById('metric-client-escrow');
    const elReview = document.getElementById('metric-client-review');
    const elPaid = document.getElementById('metric-client-paid');

    if (elActive) {
      elActive.setAttribute('data-count-target', String(activeList.length));
      elActive.textContent = String(activeList.length);
    }
    if (elEscrow) {
      elEscrow.setAttribute('data-count-target', String(totalEscrow));
      elEscrow.setAttribute('data-count-prefix', '$');
      elEscrow.setAttribute('data-count-unit', 'USDC');
      elEscrow.innerHTML = '$' + totalEscrow.toLocaleString('en-US') + '<span class="metric-unit">USDC</span>';
    }
    if (elReview) {
      elReview.setAttribute('data-count-target', String(state.profiles.client.metrics.awaitingReview));
      elReview.textContent = String(state.profiles.client.metrics.awaitingReview);
    }
    if (elPaid) {
      elPaid.setAttribute('data-count-target', String(state.profiles.client.metrics.totalPaid));
      elPaid.setAttribute('data-count-prefix', '$');
      elPaid.setAttribute('data-count-unit', 'USDC');
      elPaid.innerHTML = '$' + state.profiles.client.metrics.totalPaid.toLocaleString('en-US') + '<span class="metric-unit">USDC</span>';
    }

    window.PatelaUI.animateMetricsOnce('client_overview');

    renderClientActions(state);

    // D. Active Projects (Max 5 — Only Project, Freelancer, Current Milestone, Status, View Action)
    const tbody = document.getElementById('client-overview-projects-tbody');
    if (tbody) {
      const topFive = clientProjects.slice(0, 5);
      if (topFive.length === 0) {
        tbody.innerHTML =
          '<tr><td colspan="5">' +
            '<div class="empty-state">' +
              '<div class="empty-title">No active projects</div>' +
              '<div class="empty-desc">Post a job to start your first escrow-protected engagement.</div>' +
            '</div>' +
          '</td></tr>';
      } else {
        tbody.innerHTML = topFive.map(function (p) {
          const badgeCls = window.PatelaUI.badgeClass(p.statusTone);
          return (
            '<tr data-open-proj="' + p.id + '" style="cursor:pointer;">' +
              '<td>' +
                '<span class="cell-title" style="color:var(--gold-light);">' + window.PatelaUI.escapeHtml(p.title) + '</span>' +
                '<span class="cell-sub">Click to open full-screen project workspace</span>' +
              '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.workerName) + '</td>' +
              '<td style="color:var(--text-secondary);">' + window.PatelaUI.escapeHtml(p.currentMilestone) + '</td>' +
              '<td><span class="' + badgeCls + '">' + window.PatelaUI.escapeHtml(p.status) + '</span></td>' +
              '<td class="right">' +
                '<button type="button" class="btn btn-ghost btn-sm" data-open-proj="' + p.id + '">' +
                  (p.status === 'Awaiting client approval' ? 'Review →' : 'View →') +
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
              window.PatelaDetail.openProject(projId, { onUpdate: initClientDashboard });
            }
          });
        });
      }
    }

    const toggleEmptyBtn = document.getElementById('toggle-client-empty-attention');
    if (toggleEmptyBtn && !toggleEmptyBtn.dataset.bound) {
      toggleEmptyBtn.dataset.bound = '1';
      toggleEmptyBtn.addEventListener('click', function () {
        previewEmptyAttention = !previewEmptyAttention;
        renderClientActions(window.PatelaStore.getState());
      });
    }
  }

  function renderClientActions(state) {
    const listEl = document.getElementById('client-action-required-list');
    if (!listEl) return;

    const p201 = state.projects.find(function (p) { return p.id === 'PRJ-201'; });
    const p202 = state.projects.find(function (p) { return p.id === 'PRJ-202'; });
    const p203 = state.projects.find(function (p) { return p.id === 'PRJ-203'; });

    const actions = [];

    if (!previewEmptyAttention) {
      if (p201 && p201.status === 'Awaiting client approval') {
        actions.push({
          project: 'E-commerce Website Redesign',
          desc: 'Milestone 2 submission ($400 USDC) verified by AI and ready for your approval',
          btnText: 'Review submission',
          primary: true,
          openMilestone: { projectId: 'PRJ-201', milestoneId: 'M2' }
        });
      }

      if (p202) {
        const m3 = p202.milestones.find(function (m) { return m.id === 'M3'; });
        if (m3 && m3.status === 'Not funded') {
          actions.push({
            project: 'Smart Contract Integration',
            desc: 'Fund Milestone 3 ($400 USDC) before final deployment',
            btnText: 'Fund milestone',
            fundAction: true,
            openMilestone: { projectId: 'PRJ-202', milestoneId: 'M3' }
          });
        }
      }

      if (p203 && p203.status === 'Revision requested') {
        actions.push({
          project: 'Mobile Banking UI',
          desc: 'Revision decision requested on Milestone 2 deliverables',
          btnText: 'Open project',
          openProject: 'PRJ-203'
        });
      }
    }

    if (actions.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state" style="padding:28px 20px;">' +
          '<div class="empty-title">Nothing needs your attention.</div>' +
          '<div class="empty-desc">You\'re all caught up.</div>' +
        '</div>';
      return;
    }

    listEl.innerHTML = actions.map(function (a, idx) {
      return (
        '<div class="action-item selectable-card" data-action-idx="' + idx + '" style="cursor:pointer;">' +
          '<div class="action-item-left">' +
            '<span class="action-dot"></span>' +
            '<div>' +
              '<div class="action-title">' + window.PatelaUI.escapeHtml(a.project) + '</div>' +
              '<div class="action-desc">' + window.PatelaUI.escapeHtml(a.desc) + '</div>' +
            '</div>' +
          '</div>' +
          (a.fundAction
            ? '<button type="button" class="btn btn-secondary btn-sm" id="quick-fund-m3-btn">' + a.btnText + '</button>'
            : '<button type="button" class="btn ' + (a.primary ? 'btn-primary' : 'btn-secondary') + ' btn-sm" data-action-btn="' + idx + '">' + a.btnText + '</button>') +
        '</div>'
      );
    }).join('');

    listEl.querySelectorAll('[data-action-idx]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target && e.target.id === 'quick-fund-m3-btn') return;
        const idx = Number(row.getAttribute('data-action-idx'));
        const item = actions[idx];
        if (!item || !window.PatelaDetail) return;
        if (item.openMilestone) {
          window.PatelaDetail.openMilestone(item.openMilestone.projectId, item.openMilestone.milestoneId, { onUpdate: initClientDashboard });
        } else if (item.openProject) {
          window.PatelaDetail.openProject(item.openProject, { onUpdate: initClientDashboard });
        }
      });
    });

    const fundBtn = document.getElementById('quick-fund-m3-btn');
    if (fundBtn) {
      fundBtn.addEventListener('click', function () {
        window.PatelaUI.confirmAction({
          title: 'Fund Milestone 3 in Escrow',
          description: 'Deposit $400 USDC into the smart-contract escrow for Smart Contract Integration (Milestone 3).',
          meta: {
            'Project': 'Smart Contract Integration',
            'Milestone': 'M3: Mainnet Deployment ($400 USDC)',
            'Asset & Network': 'USDC · Base (Demo)'
          },
          confirmLabel: 'Confirm $400 USDC Deposit',
          onConfirm: function () {
            const st = window.PatelaStore.getState();
            const proj = st.projects.find(function (p) { return p.id === 'PRJ-202'; });
            if (proj) {
              proj.funded += 400;
              proj.escrowBalance += 400;
              const m3 = proj.milestones.find(function (m) { return m.id === 'M3'; });
              if (m3) {
                m3.status = 'Funded';
                m3.statusTone = 'blue';
              }
            }
            window.PatelaStore.saveState(st);
            initClientDashboard();
            window.PatelaUI.toast('Milestone 3 Funded', '$400 USDC added to project escrow.');
          }
        });
      });
    }
  }

  /* ========================================================================
     5-STEP POST A JOB WIZARD (post-job.html)
     ======================================================================== */
  function initPostJobWizard() {
    const wizardRoot = document.getElementById('post-job-wizard-root');
    if (!wizardRoot) return;

    const state = window.PatelaStore.getState();
    let draft = state.postJobDraft || {};
    let currentStep = Number(draft.step) || 1;

    function saveDraft() {
      const st = window.PatelaStore.getState();
      draft.step = currentStep;
      st.postJobDraft = draft;
      window.PatelaStore.saveState(st);
    }

    function setVal(id, val) {
      const el = document.getElementById(id);
      if (el && val !== undefined) el.value = val;
    }

    function syncInputsFromDraft() {
      setVal('job-title-input', draft.title);
      setVal('job-category-input', draft.category);
      setVal('job-desc-input', draft.description);
      setVal('job-skills-input', draft.skills);
      setVal('job-deadline-input', draft.deadline);
      setVal('job-budget-input', draft.budget);
      setVal('job-asset-input', draft.asset);
      setVal('job-network-input', draft.network);
      setVal('job-subreq-input', draft.submissionReq);
      setVal('job-revexp-input', draft.reviewExpectation);
      renderDeliverablesList();
      renderMilestonesList();
      renderReviewSummary();
    }

    function readInputsIntoDraft() {
      const titleEl = document.getElementById('job-title-input');
      if (titleEl) draft.title = titleEl.value.trim();
      const catEl = document.getElementById('job-category-input');
      if (catEl) draft.category = catEl.value;
      const descEl = document.getElementById('job-desc-input');
      if (descEl) draft.description = descEl.value.trim();
      const skillsEl = document.getElementById('job-skills-input');
      if (skillsEl) draft.skills = skillsEl.value.trim();
      const dlEl = document.getElementById('job-deadline-input');
      if (dlEl) draft.deadline = dlEl.value;
      const budgetEl = document.getElementById('job-budget-input');
      if (budgetEl) draft.budget = Number(budgetEl.value) || 0;
      const assetEl = document.getElementById('job-asset-input');
      if (assetEl) draft.asset = assetEl.value;
      const netEl = document.getElementById('job-network-input');
      if (netEl) draft.network = netEl.value;
      const subReqEl = document.getElementById('job-subreq-input');
      if (subReqEl) draft.submissionReq = subReqEl.value.trim();
      const revExpEl = document.getElementById('job-revexp-input');
      if (revExpEl) draft.reviewExpectation = revExpEl.value.trim();

      const delivRows = document.querySelectorAll('[data-deliv-row]');
      if (delivRows.length > 0) {
        draft.deliverables = Array.from(delivRows).map(function (r) {
          return {
            title: r.querySelector('[data-deliv-title]').value.trim(),
            criteria: r.querySelector('[data-deliv-criteria]').value.trim()
          };
        });
      }

      const msRows = document.querySelectorAll('[data-ms-row]');
      if (msRows.length > 0) {
        draft.milestones = Array.from(msRows).map(function (r) {
          return {
            name: r.querySelector('[data-ms-name]').value.trim(),
            amount: Number(r.querySelector('[data-ms-amount]').value) || 0,
            due: r.querySelector('[data-ms-due]').value
          };
        });
      }

      saveDraft();
    }

    function renderDeliverablesList() {
      const container = document.getElementById('wizard-deliverables-list');
      if (!container) return;
      container.innerHTML = (draft.deliverables || []).map(function (d, idx) {
        return (
          '<div class="card-elevated" data-deliv-row style="margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span class="meta-text" style="color:var(--gold-light);font-weight:500;">Deliverable ' + (idx + 1) + '</span>' +
              (draft.deliverables.length > 1
                ? '<button type="button" class="btn-ghost btn-sm" data-remove-deliv="' + idx + '" style="color:var(--error);">Remove</button>'
                : '') +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group" style="margin-bottom:0;">' +
                '<label class="form-label">Deliverable</label>' +
                '<input type="text" class="input" data-deliv-title value="' + window.PatelaUI.escapeHtml(d.title) + '" />' +
              '</div>' +
              '<div class="form-group" style="margin-bottom:0;">' +
                '<label class="form-label">Acceptance criteria</label>' +
                '<input type="text" class="input" data-deliv-criteria value="' + window.PatelaUI.escapeHtml(d.criteria) + '" />' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      container.querySelectorAll('[data-remove-deliv]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          readInputsIntoDraft();
          const i = Number(btn.getAttribute('data-remove-deliv'));
          draft.deliverables.splice(i, 1);
          saveDraft();
          renderDeliverablesList();
        });
      });
    }

    function renderMilestonesList() {
      const container = document.getElementById('wizard-milestones-list');
      if (!container) return;
      container.innerHTML = (draft.milestones || []).map(function (m, idx) {
        return (
          '<div class="card-elevated" data-ms-row style="margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
              '<span class="meta-text" style="color:var(--blue);font-weight:500;">Milestone ' + (idx + 1) + '</span>' +
              (draft.milestones.length > 1
                ? '<button type="button" class="btn-ghost btn-sm" data-remove-ms="' + idx + '" style="color:var(--error);">Remove</button>'
                : '') +
            '</div>' +
            '<div class="three-col-grid" style="margin-bottom:0;gap:12px;">' +
              '<div class="form-group" style="margin-bottom:0;">' +
                '<label class="form-label">Title</label>' +
                '<input type="text" class="input" data-ms-name value="' + window.PatelaUI.escapeHtml(m.name) + '" />' +
              '</div>' +
              '<div class="form-group" style="margin-bottom:0;">' +
                '<label class="form-label">Amount (USD)</label>' +
                '<input type="number" class="input tabular" data-ms-amount value="' + m.amount + '" min="10" />' +
              '</div>' +
              '<div class="form-group" style="margin-bottom:0;">' +
                '<label class="form-label">Due date</label>' +
                '<input type="date" class="input" data-ms-due value="' + (m.due || '2026-12-01') + '" />' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');

      updateMilestoneSumIndicator();

      container.querySelectorAll('input').forEach(function (inp) {
        inp.addEventListener('input', function () {
          readInputsIntoDraft();
          updateMilestoneSumIndicator();
        });
      });

      container.querySelectorAll('[data-remove-ms]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          readInputsIntoDraft();
          const i = Number(btn.getAttribute('data-remove-ms'));
          draft.milestones.splice(i, 1);
          saveDraft();
          renderMilestonesList();
        });
      });
    }

    function updateMilestoneSumIndicator() {
      const sumEl = document.getElementById('wizard-ms-sum-banner');
      if (!sumEl) return;
      const msTotal = (draft.milestones || []).reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
      const targetBudget = Number(draft.budget) || 0;
      const matches = msTotal === targetBudget && targetBudget > 0;
      sumEl.innerHTML =
        '<span>Milestones: <strong class="tabular">$' + msTotal.toLocaleString('en-US') + '</strong> / Budget: <strong class="tabular">$' + targetBudget.toLocaleString('en-US') + ' ' + draft.asset + '</strong></span>' +
        '<span class="badge ' + (matches ? 'badge-success' : 'badge-warning') + '">' +
          (matches ? 'Balanced' : 'Adjust amounts') +
        '</span>';
    }

    function renderReviewSummary() {
      const summaryEl = document.getElementById('wizard-review-summary');
      if (!summaryEl) return;
      const msTotal = (draft.milestones || []).reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
      summaryEl.innerHTML =
        '<div class="kv-list">' +
          '<div class="kv-row"><span class="kv-label">Job Title</span><span class="kv-value">' + window.PatelaUI.escapeHtml(draft.title) + '</span></div>' +
          '<div class="kv-row"><span class="kv-label">Category</span><span class="kv-value">' + window.PatelaUI.escapeHtml(draft.category) + '</span></div>' +
          '<div class="kv-row"><span class="kv-label">Total Budget</span><span class="kv-value text-gold tabular">$' + msTotal.toLocaleString('en-US') + ' ' + window.PatelaUI.escapeHtml(draft.asset) + '</span></div>' +
          '<div class="kv-row"><span class="kv-label">Network</span><span class="kv-value">' + window.PatelaUI.escapeHtml(draft.network) + '</span></div>' +
          '<div class="kv-row"><span class="kv-label">Deliverables &amp; Milestones</span><span class="kv-value">' + (draft.deliverables ? draft.deliverables.length : 0) + ' deliverables · ' + (draft.milestones ? draft.milestones.length : 0) + ' milestones</span></div>' +
        '</div>';
    }

    function showStep(stepNum) {
      readInputsIntoDraft();
      currentStep = Math.max(1, Math.min(5, stepNum));
      saveDraft();

      document.querySelectorAll('[data-wizard-panel]').forEach(function (panel) {
        const pStep = Number(panel.getAttribute('data-wizard-panel'));
        panel.style.display = pStep === currentStep ? 'block' : 'none';
      });

      document.querySelectorAll('[data-wizard-pill]').forEach(function (pill) {
        const s = Number(pill.getAttribute('data-wizard-pill'));
        pill.classList.remove('active', 'done');
        if (s === currentStep) pill.classList.add('active');
        else if (s < currentStep) pill.classList.add('done');
      });

      if (currentStep === 3) updateMilestoneSumIndicator();
      if (currentStep === 5) renderReviewSummary();
    }

    function validateCurrentStep() {
      readInputsIntoDraft();
      if (currentStep === 1 && (!draft.title || !draft.description || !draft.skills)) {
        window.PatelaUI.toast('Required Fields Missing', 'Please provide a job title, description, and required skills.');
        return false;
      }
      if (currentStep === 2) {
        const invalidDeliv = (draft.deliverables || []).some(function (d) { return !d.title || !d.criteria; });
        if (invalidDeliv) {
          window.PatelaUI.toast('Complete Deliverables', 'Each deliverable requires a title and acceptance criteria.');
          return false;
        }
      }
      if (currentStep === 3) {
        const msTotal = (draft.milestones || []).reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
        if (msTotal !== Number(draft.budget) || msTotal <= 0) {
          window.PatelaUI.toast('Budget Mismatch', 'Milestone amounts ($' + msTotal + ') must match total budget ($' + draft.budget + ').');
          return false;
        }
      }
      return true;
    }

    document.querySelectorAll('[data-wizard-pill]').forEach(function (pill) {
      pill.addEventListener('click', function () {
        const target = Number(pill.getAttribute('data-wizard-pill'));
        if (target > currentStep && !validateCurrentStep()) return;
        showStep(target);
      });
    });

    document.querySelectorAll('[data-wizard-next]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!validateCurrentStep()) return;
        showStep(currentStep + 1);
      });
    });

    document.querySelectorAll('[data-wizard-prev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showStep(currentStep - 1);
      });
    });

    const addDelivBtn = document.getElementById('add-deliverable-btn');
    if (addDelivBtn) {
      addDelivBtn.addEventListener('click', function () {
        readInputsIntoDraft();
        draft.deliverables.push({ title: '', criteria: '' });
        saveDraft();
        renderDeliverablesList();
      });
    }

    const addMsBtn = document.getElementById('add-milestone-btn');
    if (addMsBtn) {
      addMsBtn.addEventListener('click', function () {
        readInputsIntoDraft();
        draft.milestones.push({
          name: 'Milestone ' + (draft.milestones.length + 1),
          amount: 200,
          due: draft.deadline || '2026-12-10'
        });
        saveDraft();
        renderMilestonesList();
      });
    }

    const matchBudgetBtn = document.getElementById('auto-balance-budget-btn');
    if (matchBudgetBtn) {
      matchBudgetBtn.addEventListener('click', function () {
        readInputsIntoDraft();
        const msTotal = (draft.milestones || []).reduce(function (acc, m) { return acc + (Number(m.amount) || 0); }, 0);
        draft.budget = msTotal;
        setVal('job-budget-input', msTotal);
        saveDraft();
        updateMilestoneSumIndicator();
        window.PatelaUI.toast('Budget Synced', 'Total budget updated to $' + msTotal.toLocaleString('en-US') + ' ' + draft.asset + '.');
      });
    }

    const publishBtn = document.getElementById('publish-job-final-btn');
    if (publishBtn) {
      publishBtn.addEventListener('click', function () {
        if (!validateCurrentStep()) return;
        window.PatelaUI.confirmAction({
          title: 'Publish Job',
          description: 'Publish this job brief and milestone schedule to the Patela Marketplace.',
          meta: {
            'Job Title': draft.title,
            'Total Budget': '$' + draft.budget.toLocaleString('en-US') + ' ' + draft.asset,
            'Network': draft.network,
            'Milestones': draft.milestones.length + ' milestones'
          },
          confirmLabel: 'Publish Job',
          onConfirm: function () {
            const st = window.PatelaStore.getState();
            const newJobId = 'JOB-' + (406 + st.marketplaceJobs.length);
            st.marketplaceJobs.unshift({
              id: newJobId,
              title: draft.title,
              category: draft.category,
              budget: Number(draft.budget),
              asset: draft.asset,
              network: draft.network,
              duration: '2–3 weeks',
              experience: 'Senior',
              clientName: 'Alex Morgan',
              clientHandle: '@alex_morgan',
              clientVerified: true,
              clientTotalPaid: '$8,320 USDC',
              escrowStatus: 'Escrow pre-funded ($' + Number(draft.budget).toLocaleString('en-US') + ' ' + draft.asset + ')',
              proposals: 0,
              postedAt: 'Just now',
              deadline: draft.deadline || '10 Dec 2026',
              skills: draft.skills.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
              description: draft.description,
              deliverables: draft.deliverables.map(function (d) { return d.title + ' — ' + d.criteria; }),
              milestones: draft.milestones.map(function (m) { return { name: m.name, amount: m.amount }; }),
              applied: false
            });
            st.postJobDraft.step = 1;
            window.PatelaStore.saveState(st);

            const publishedBanner = document.getElementById('wizard-published-confirmation');
            const formCard = document.getElementById('wizard-form-card');
            if (publishedBanner && formCard) {
              formCard.style.display = 'none';
              publishedBanner.style.display = 'block';
              const idSpan = document.getElementById('published-job-id');
              if (idSpan) idSpan.textContent = draft.title;
            }
            window.PatelaUI.toast('Job Published', draft.title + ' is now live in the Marketplace.');
          }
        });
      });
    }

    syncInputsFromDraft();
    showStep(currentStep);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initClientDashboard();
    initPostJobWizard();
  });
})();
