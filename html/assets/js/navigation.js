/* ==========================================================================
   PATELA — UNDERSTATED ROLE-AWARE NAVIGATION SHELL (navigation.js)
   Clean Sidebar · Minimal Topbar · Smooth iOS Transitions & Site Bridge
   ========================================================================== */

(function () {
  const AMBIENT_VIDEO =
    'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104303_0c6d60b2-9353-408e-9449-585108a22fb5.mp4';
  const AMBIENT_POSTER =
    'https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/130837c4-0244-4f37-9c61-8d801d93fd29.jpg';

  const ICONS = {
    logo: '<svg viewBox="0 0 23 17" aria-hidden="true"><path d="M8.15 0.9 L4.55 0.9 L0.5 9.3 L4.1 9.3 Z"/><path d="M17.0 0 L13.4 0 L6.15 16.4 L9.75 16.4 Z"/><path d="M22.9 0 L19.3 0 L15.0 7.6 L18.6 7.6 Z"/><path d="M22.6 6.9 L19.0 6.9 L14.05 16.4 L17.65 16.4 Z"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    overview: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
    projects: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>',
    postJob: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
    findWork: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    submissions: '<svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
    analytics: '<svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m7 14 4-4 4 3 5-6"/></svg>',
    payments: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>',
    messages: '<svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    bell: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    menu: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.8" fill="none"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.8" fill="none"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    sidebarToggle: '<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="1.75" fill="none"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none"><path d="m15 18-6-6 6-6"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="1.8" fill="none"><path d="m9 18 6-6-6-6"/></svg>',
    orders: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    route: '<svg viewBox="0 0 24 24"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>',
    custody: '<svg viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    paymentPlan: '<svg viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    guestHandoff: '<svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="m10 13 2 2 4-4"/></svg>',
    tender: '<svg viewBox="0 0 24 24"><path d="m14 13-7.5 7.5a2.12 2.12 0 1 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/></svg>',
    dispute: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    partners: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>',
    documents: '<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M12 18v-6"/><path d="m9 15 3 3 3-3"/></svg>',
    auditor: '<svg viewBox="0 0 24 24"><path d="M2 12h20"/><path d="M20 12v8H4v-8"/><path d="m4 4 8-2 8 2v4H4z"/><line x1="10" y1="12" x2="10" y2="20"/><line x1="14" y1="12" x2="14" y2="20"/></svg>',
    operations: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M3 12h4m10 0h4M12 3v4m0 10v4"/></svg>',
    blueprint: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>'
  };

  const SIDEBAR_PREF_KEY = 'patela_sidebar_collapsed';

  /** Resolves links to the main Next.js site when hosted under /html/, or local fallback when opened directly */
  function resolveSiteHref(route) {
    const isHostedInNext =
      window.location.protocol.indexOf('http') === 0 &&
      window.location.pathname.indexOf('/html/') === 0;
    if (isHostedInNext) {
      return route;
    }
    if (route === '/') return 'index.html';
    if (route === '/marketplace') return 'marketplace.html';
    if (route === '/post-job') return 'post-job.html';
    if (route === '/how-it-works') return 'index.html';
    return route;
  }

  /** Injects the shared ambient video and frosted glass veil to match the Landing Page */
  function ensureAmbientBackground() {
    if (document.querySelector('.patela-bgv')) return;
    const video = document.createElement('video');
    video.className = 'patela-bgv';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    video.poster = AMBIENT_POSTER;
    video.src = AMBIENT_VIDEO;

    const frost = document.createElement('div');
    frost.className = 'patela-frost';
    frost.setAttribute('aria-hidden', 'true');

    document.body.insertBefore(frost, document.body.firstChild);
    document.body.insertBefore(video, document.body.firstChild);
  }

  function isSidebarCollapsed() {
    try {
      return localStorage.getItem(SIDEBAR_PREF_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setSidebarCollapsed(collapsed) {
    try {
      localStorage.setItem(SIDEBAR_PREF_KEY, collapsed ? '1' : '0');
    } catch (e) {}
    document.body.classList.toggle('sidebar-collapsed', Boolean(collapsed));
  }

  function toggleSidebarCollapsed() {
    const next = !document.body.classList.contains('sidebar-collapsed');
    setSidebarCollapsed(next);
    const topBtn = document.getElementById('topbar-sidebar-toggle');
    if (topBtn) {
      topBtn.setAttribute('aria-expanded', String(!next));
      topBtn.setAttribute('title', next ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)');
    }
    const railBtn = document.getElementById('sidebar-rail-toggle-btn');
    if (railBtn) {
      railBtn.setAttribute('data-tooltip', next ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar');
      const labelSpan = railBtn.querySelector('.rail-toggle-label');
      if (labelSpan) labelSpan.textContent = next ? 'Expand sidebar' : 'Collapse sidebar';
      const iconWrap = railBtn.querySelector('.rail-toggle-icon');
      if (iconWrap) iconWrap.innerHTML = next ? ICONS.chevronRight : ICONS.chevronLeft;
    }
  }

  function getBlueprintNavItems() {
    return [
      { id: 'orders', label: 'Orders & RFQ', href: 'orders.html', icon: ICONS.orders },
      { id: 'route-builder', label: 'Route Builder', href: 'route-builder.html', icon: ICONS.route },
      { id: 'shipment-overview', label: 'Shipment Custody', href: 'shipment-overview.html', icon: ICONS.custody },
      { id: 'payment-builder', label: 'Payment Plan', href: 'payment-builder.html', icon: ICONS.paymentPlan },
      { id: 'escrow-funding', label: 'Escrow Funding', href: 'escrow-funding.html', icon: ICONS.payments },
      { id: 'guest-handoff', label: 'Guest Handoff', href: 'guest-handoff.html', icon: ICONS.guestHandoff, dot: true },
      { id: 'tender-trail', label: 'Tender Trail', href: 'tender-trail.html', icon: ICONS.tender },
      { id: 'dispute-centre', label: 'Dispute Centre', href: 'dispute-centre.html', icon: ICONS.dispute },
      { id: 'partner-directory', label: 'Partner Directory', href: 'partner-directory.html', icon: ICONS.partners },
      { id: 'documents-evidence', label: 'Documents & Proof', href: 'documents-evidence.html', icon: ICONS.documents },
      { id: 'auditor-trail', label: 'Auditor Trail', href: 'auditor-trail.html', icon: ICONS.auditor },
      { id: 'operations-console', label: 'Operations Console', href: 'operations-console.html', icon: ICONS.operations }
    ];
  }

  function getNavItems(role) {
    if (role === 'worker') {
      return [
        { id: 'overview', label: 'Overview', href: 'worker-dashboard.html', icon: ICONS.overview },
        { id: 'marketplace', label: 'Find Work', href: 'marketplace.html', icon: ICONS.findWork },
        { id: 'projects', label: 'My Projects', href: 'projects.html', icon: ICONS.projects },
        { id: 'submissions', label: 'Submissions', href: 'submissions.html', icon: ICONS.submissions, dot: true },
        { id: 'analytics', label: 'Analytics', href: 'analytics.html', icon: ICONS.analytics },
        { id: 'payments', label: 'Earnings', href: 'payments.html', icon: ICONS.payments },
        { id: 'messages', label: 'Messages', href: 'messages.html', icon: ICONS.messages },
        { id: 'settings', label: 'Settings', href: 'settings.html', icon: ICONS.settings }
      ];
    }
    return [
      { id: 'overview', label: 'Overview', href: 'client-dashboard.html', icon: ICONS.overview },
      { id: 'projects', label: 'My Projects', href: 'projects.html', icon: ICONS.projects },
      { id: 'post-job', label: 'Post a Job', href: 'post-job.html', icon: ICONS.postJob },
      { id: 'submissions', label: 'Submissions', href: 'submissions.html', icon: ICONS.submissions, dot: true },
      { id: 'analytics', label: 'Analytics', href: 'analytics.html', icon: ICONS.analytics },
      { id: 'payments', label: 'Payments', href: 'payments.html', icon: ICONS.payments },
      { id: 'messages', label: 'Messages', href: 'messages.html', icon: ICONS.messages },
      { id: 'settings', label: 'Settings', href: 'settings.html', icon: ICONS.settings }
    ];
  }

  function renderShell() {
    ensureAmbientBackground();

    const sidebarEl = document.getElementById('app-sidebar');
    const topbarEl = document.getElementById('app-topbar');
    if (!sidebarEl || !topbarEl) return;

    const state = window.PatelaStore.getState();
    const role = window.PatelaStore.getRole();
    const profile = state.profiles[role];
    const activePage = document.body.getAttribute('data-page') || 'overview';
    const navItems = getNavItems(role);
    const bpItems = getBlueprintNavItems();
    const collapsed = isSidebarCollapsed();
    const homeHref = resolveSiteHref('/');
    const publicMpHref = resolveSiteHref('/marketplace');

    document.body.classList.toggle('sidebar-collapsed', collapsed);

    sidebarEl.innerHTML =
      '<div class="sidebar-brand">' +
        '<a href="' + homeHref + '" class="brand-link" title="Patela Home" data-tooltip="Patela · Back to Home">' +
          ICONS.logo +
          '<span class="brand-wordmark">PATELA</span>' +
        '</a>' +
        '<div class="sidebar-brand-actions">' +
          '<span class="role-pill-header">' + (role === 'worker' ? 'Worker' : 'Client') + '</span>' +
          '<button type="button" class="sidebar-collapse-btn" id="sidebar-header-collapse-btn" title="Collapse sidebar (Ctrl+B)" aria-label="Collapse sidebar">' +
            ICONS.chevronLeft +
          '</button>' +
          '<button type="button" class="sidebar-mobile-close" id="sidebar-mobile-close-btn" aria-label="Close navigation">' +
            ICONS.close +
          '</button>' +
        '</div>' +
      '</div>' +
      '<nav class="sidebar-nav" aria-label="Main Navigation">' +
        '<div class="sidebar-section-title" style="padding:8px 14px 4px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:600;">Workspace</div>' +
        navItems.map(function (item) {
          const isActive = item.id === activePage;
          return (
            '<a href="' + item.href + '" class="nav-item ' + (isActive ? 'active' : '') + '" data-tooltip="' + item.label + '">' +
              '<span class="nav-item-left">' +
                item.icon +
                '<span>' + item.label + '</span>' +
              '</span>' +
              (item.dot ? '<span class="nav-badge" title="Pending review"></span>' : '') +
            '</a>'
          );
        }).join('') +
        '<div class="sidebar-section-title" style="padding:14px 14px 4px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--gold);font-weight:600;">Supply Chain &amp; Escrow</div>' +
        bpItems.map(function (item) {
          const isActive = item.id === activePage;
          return (
            '<a href="' + item.href + '" class="nav-item ' + (isActive ? 'active' : '') + '" data-tooltip="' + item.label + '">' +
              '<span class="nav-item-left">' +
                item.icon +
                '<span>' + item.label + '</span>' +
              '</span>' +
              (item.dot ? '<span class="nav-badge" title="Action needed"></span>' : '') +
            '</a>'
          );
        }).join('') +
      '</nav>' +
      '<div class="sidebar-footer">' +
        '<a href="' + homeHref + '" class="nav-item" data-tooltip="Landing Page">' +
          '<span class="nav-item-left">' + ICONS.home + '<span>Landing page</span></span>' +
        '</a>' +
        '<button type="button" class="nav-item" id="sidebar-rail-toggle-btn" style="width:100%;" data-tooltip="' + (collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar') + '">' +
          '<span class="nav-item-left">' +
            '<span class="rail-toggle-icon" style="display:inline-flex;align-items:center;">' + (collapsed ? ICONS.chevronRight : ICONS.chevronLeft) + '</span>' +
            '<span class="rail-toggle-label">' + (collapsed ? 'Expand sidebar' : 'Collapse sidebar') + '</span>' +
          '</span>' +
        '</button>' +
        '<button type="button" class="nav-item" id="sidebar-help-btn" style="width:100%;" data-tooltip="Help & support">' +
          '<span class="nav-item-left">' + ICONS.help + '<span>Help &amp; support</span></span>' +
        '</button>' +
        '<div class="sidebar-wallet-box" data-tooltip="' + (state.walletConnected ? 'Base Sepolia: ' + profile.wallet : 'Wallet offline') + '">' +
          '<div class="wallet-status-left">' +
            '<span class="wallet-dot ' + (state.walletConnected ? '' : 'disconnected') + '"></span>' +
            '<div class="wallet-text-wrap" style="min-width:0;">' +
              '<div class="mono" style="font-size:0.72rem;color:var(--text-primary);">' +
                (state.walletConnected ? profile.wallet : 'Wallet offline') +
              '</div>' +
              '<div class="meta-text" style="font-size:0.68rem;">Base · Demo</div>' +
            '</div>' +
          '</div>' +
          '<button type="button" class="btn-ghost btn-sm" id="sidebar-wallet-toggle" style="padding:0 6px;height:24px;font-size:0.68rem;">' +
            (state.walletConnected ? 'Disconnect' : 'Connect') +
          '</button>' +
        '</div>' +
        '<a href="settings.html" class="sidebar-user-btn" title="Account Settings" data-tooltip="' + profile.name + ' · Settings">' +
          '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
            '<div class="avatar">' + profile.initials + '</div>' +
            '<div class="user-text-wrap" style="min-width:0;">' +
              '<div style="font-size:0.8125rem;font-weight:500;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + profile.name + '</div>' +
              '<div class="meta-text" style="font-size:0.7rem;">' + (role === 'worker' ? 'Worker account' : 'Client account') + '</div>' +
            '</div>' +
          '</div>' +
        '</a>' +
      '</div>';

    let scrim = document.getElementById('sidebar-scrim');
    if (!scrim) {
      scrim = document.createElement('div');
      scrim.id = 'sidebar-scrim';
      scrim.className = 'sidebar-scrim';
      document.body.appendChild(scrim);
      scrim.addEventListener('click', function () {
        sidebarEl.classList.remove('mobile-open');
        scrim.classList.remove('open');
      });
    }

    // Mobile Bottom Navigation Bar (<= 768px)
    let mobileBottomNav = document.getElementById('mobile-bottom-nav');
    if (!mobileBottomNav) {
      mobileBottomNav = document.createElement('nav');
      mobileBottomNav.id = 'mobile-bottom-nav';
      mobileBottomNav.className = 'mobile-bottom-nav';
      mobileBottomNav.setAttribute('aria-label', 'Mobile quick navigation');
      document.body.appendChild(mobileBottomNav);
    }
    const mobileItems = role === 'worker'
      ? [
          { id: 'overview', label: 'Overview', href: 'worker-dashboard.html', icon: ICONS.overview },
          { id: 'marketplace', label: 'Jobs', href: 'marketplace.html', icon: ICONS.findWork },
          { id: 'projects', label: 'Projects', href: 'projects.html', icon: ICONS.projects },
          { id: 'analytics', label: 'Analytics', href: 'analytics.html', icon: ICONS.analytics },
          { id: 'payments', label: 'Earnings', href: 'payments.html', icon: ICONS.payments }
        ]
      : [
          { id: 'overview', label: 'Overview', href: 'client-dashboard.html', icon: ICONS.overview },
          { id: 'projects', label: 'Projects', href: 'projects.html', icon: ICONS.projects },
          { id: 'post-job', label: 'Post Job', href: 'post-job.html', icon: ICONS.postJob },
          { id: 'analytics', label: 'Analytics', href: 'analytics.html', icon: ICONS.analytics },
          { id: 'payments', label: 'Payments', href: 'payments.html', icon: ICONS.payments }
        ];
    mobileBottomNav.innerHTML = mobileItems.map(function (m) {
      const isAct = m.id === activePage;
      return (
        '<a href="' + m.href + '" class="mobile-bottom-item ' + (isAct ? 'active' : '') + '">' +
          m.icon +
          '<span>' + m.label + '</span>' +
        '</a>'
      );
    }).join('');

    const crumbAttr = document.body.getAttribute('data-breadcrumb') || 'Overview';
    const overviewHref = role === 'worker' ? 'worker-dashboard.html' : 'client-dashboard.html';
    const roleNotifs = state.notifications.filter(function (n) { return n.role === role; });
    const unreadCount = roleNotifs.filter(function (n) { return n.unread; }).length;

    topbarEl.innerHTML =
      '<div class="topbar-left">' +
        '<button type="button" class="mobile-menu-trigger" id="mobile-nav-open" aria-label="Open navigation">' +
          ICONS.menu +
        '</button>' +
        '<button type="button" class="topbar-sidebar-toggle" id="topbar-sidebar-toggle" aria-label="Toggle sidebar" aria-expanded="' + String(!collapsed) + '" title="' + (collapsed ? 'Expand sidebar (Ctrl+B)' : 'Collapse sidebar (Ctrl+B)') + '">' +
          ICONS.sidebarToggle +
        '</button>' +
        '<nav class="breadcrumbs" aria-label="Breadcrumb">' +
          '<a href="' + homeHref + '">Patela</a>' +
          '<span class="crumb-sep">/</span>' +
          '<a href="' + overviewHref + '">' + (role === 'worker' ? 'Worker' : 'Client') + '</a>' +
          '<span class="crumb-sep">/</span>' +
          '<span class="crumb-current">' + crumbAttr + '</span>' +
        '</nav>' +
      '</div>' +
      '<div class="topbar-right">' +
        '<div class="topbar-site-links">' +
          '<a href="orders.html" class="topbar-site-pill" title="Supply Chain Orders">Orders</a>' +
          '<a href="guest-handoff.html" class="topbar-site-pill" style="border-color:var(--border-gold);color:var(--gold-light);" title="Driver / Warehouse Guest Handoff">Guest Handoff ⚡</a>' +
          '<a href="index.html" class="topbar-site-pill" title="Blueprint Overview Hub">Blueprint Hub ↗</a>' +
        '</div>' +
        '<div class="role-switcher" role="group" aria-label="Switch Role">' +
          '<button type="button" class="role-switch-btn ' + (role === 'client' ? 'active' : '') + '" data-switch-role="client">Client</button>' +
          '<button type="button" class="role-switch-btn ' + (role === 'worker' ? 'active' : '') + '" data-switch-role="worker">Worker</button>' +
        '</div>' +
        '<div class="popover-wrap">' +
          '<button type="button" class="icon-btn" id="topbar-notif-btn" aria-label="Notifications">' +
            ICONS.bell +
            (unreadCount > 0 ? '<span class="notif-indicator"></span>' : '') +
          '</button>' +
          '<div class="popover-menu" id="topbar-notif-menu">' +
            '<div class="popover-header">' +
              '<span>Notifications</span>' +
              (unreadCount > 0 ? '<button type="button" class="btn-ghost btn-sm" id="mark-all-read-btn" style="height:22px;padding:0 6px;">Mark all read</button>' : '<span class="meta-text">All caught up</span>') +
            '</div>' +
            '<div id="notif-list-body">' +
              (roleNotifs.length === 0
                ? '<div class="empty-state" style="padding:28px 16px;"><div class="empty-title">No notifications</div><div class="empty-desc">You\'re all caught up.</div></div>'
                : roleNotifs.map(function (n) {
                    return (
                      '<a href="' + n.href + '" class="notif-item ' + (n.unread ? 'unread' : '') + '">' +
                        (n.unread ? '<span class="notif-dot"></span>' : '<span style="width:6px;flex-shrink:0;"></span>') +
                        '<div style="flex:1;min-width:0;">' +
                          '<div style="font-size:0.8125rem;font-weight:500;color:var(--text-primary);">' + n.title + '</div>' +
                          '<div style="font-size:0.75rem;color:var(--text-secondary);margin-top:2px;">' + n.desc + '</div>' +
                          '<div class="meta-text" style="margin-top:4px;">' + n.time + '</div>' +
                        '</div>' +
                      '</a>'
                    );
                  }).join('')) +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="popover-wrap">' +
          '<button type="button" class="icon-btn" id="topbar-account-btn" aria-label="Account menu" style="border:none;width:auto;padding:0 4px;">' +
            '<span class="avatar">' + profile.initials + '</span>' +
          '</button>' +
          '<div class="popover-menu" id="topbar-account-menu" style="width:230px;">' +
            '<div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);">' +
              '<div style="font-weight:500;color:var(--text-primary);">' + profile.name + '</div>' +
              '<div class="meta-text">' + profile.handle + '</div>' +
            '</div>' +
            '<div style="padding:6px;display:flex;flex-direction:column;gap:2px;">' +
              '<a href="' + homeHref + '" class="nav-item"><span>← Landing Page</span></a>' +
              '<a href="index.html" class="nav-item"><span>Workspace Selector</span></a>' +
              '<a href="settings.html" class="nav-item"><span>Settings</span></a>' +
              '<button type="button" class="nav-item" id="reset-demo-data-btn" style="width:100%;color:var(--text-muted);"><span>Reset demo data</span></button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    bindShellEvents();
  }

  function navigateWithIosTransition(url) {
    if (!url) return;
    document.body.classList.add('ios-page-leaving');
    setTimeout(function () {
      window.location.href = url;
    }, 135);
  }

  function bindShellEvents() {
    const sidebarEl = document.getElementById('app-sidebar');
    const scrim = document.getElementById('sidebar-scrim');

    const mobileOpenBtn = document.getElementById('mobile-nav-open');
    if (mobileOpenBtn) {
      mobileOpenBtn.addEventListener('click', function () {
        sidebarEl.classList.add('mobile-open');
        if (scrim) scrim.classList.add('open');
      });
    }

    const mobileCloseBtn = document.getElementById('sidebar-mobile-close-btn');
    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', function () {
        sidebarEl.classList.remove('mobile-open');
        if (scrim) scrim.classList.remove('open');
      });
    }

    const topbarCollapseBtn = document.getElementById('topbar-sidebar-toggle');
    if (topbarCollapseBtn) {
      topbarCollapseBtn.addEventListener('click', toggleSidebarCollapsed);
    }

    const headerCollapseBtn = document.getElementById('sidebar-header-collapse-btn');
    if (headerCollapseBtn) {
      headerCollapseBtn.addEventListener('click', toggleSidebarCollapsed);
    }

    const railCollapseBtn = document.getElementById('sidebar-rail-toggle-btn');
    if (railCollapseBtn) {
      railCollapseBtn.addEventListener('click', toggleSidebarCollapsed);
    }

    document.querySelectorAll('[data-switch-role]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const targetRole = btn.getAttribute('data-switch-role');
        window.PatelaStore.setRole(targetRole);
        const page = document.body.getAttribute('data-page');
        if (page === 'overview') {
          navigateWithIosTransition(targetRole === 'worker' ? 'worker-dashboard.html' : 'client-dashboard.html');
        } else {
          document.body.classList.add('ios-page-leaving');
          setTimeout(function () {
            window.location.reload();
          }, 135);
        }
      });
    });

    const walletToggleBtn = document.getElementById('sidebar-wallet-toggle');
    if (walletToggleBtn) {
      walletToggleBtn.addEventListener('click', function () {
        const st = window.PatelaStore.getState();
        st.walletConnected = !st.walletConnected;
        window.PatelaStore.saveState(st);
        renderShell();
        window.PatelaUI.toast(
          st.walletConnected ? 'Wallet Connected' : 'Wallet Disconnected',
          st.walletConnected ? 'Connected to Base Sepolia (Demo).' : 'Wallet disconnected.'
        );
      });
    }

    const helpBtn = document.getElementById('sidebar-help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', function () {
        window.PatelaUI.confirmAction({
          title: 'Help & Workspace Guide',
          description: 'Patela secures milestone funds in smart-contract escrow and verifies deliverables with AI before releasing payouts.',
          meta: {
            'Client Persona': 'Alex Morgan ($2,450 USDC in escrow)',
            'Worker Persona': 'Jordan Blake ($1,850 USDC secured)',
            'Shortcut': 'Press Ctrl+B to collapse or expand the sidebar'
          },
          confirmLabel: 'Got it'
        });
      });
    }

    const notifBtn = document.getElementById('topbar-notif-btn');
    const notifMenu = document.getElementById('topbar-notif-menu');
    const accountBtn = document.getElementById('topbar-account-btn');
    const accountMenu = document.getElementById('topbar-account-menu');

    if (notifBtn && notifMenu) {
      notifBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (accountMenu) accountMenu.classList.remove('open');
        notifMenu.classList.toggle('open');
      });
    }

    if (accountBtn && accountMenu) {
      accountBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (notifMenu) notifMenu.classList.remove('open');
        accountMenu.classList.toggle('open');
      });
    }

    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const st = window.PatelaStore.getState();
        const currentRole = window.PatelaStore.getRole();
        st.notifications.forEach(function (n) {
          if (n.role === currentRole) n.unread = false;
        });
        window.PatelaStore.saveState(st);
        renderShell();
      });
    }

    const resetBtn = document.getElementById('reset-demo-data-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        window.PatelaStore.resetState();
        window.PatelaUI.toast('Demo Data Reset', 'Default balances and milestones restored.');
        setTimeout(function () { window.location.reload(); }, 400);
      });
    }

    if (!window.__patelaNavClickBound) {
      window.__patelaNavClickBound = true;
      document.addEventListener('click', function (e) {
        if (!e.target.closest('.popover-wrap')) {
          const nm = document.getElementById('topbar-notif-menu');
          const am = document.getElementById('topbar-account-menu');
          if (nm) nm.classList.remove('open');
          if (am) am.classList.remove('open');
        }

        // Smooth iOS page transition on internal navigation links
        const anchor = e.target.closest('a[href]');
        if (
          anchor &&
          !e.defaultPrevented &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey &&
          anchor.getAttribute('target') !== '_blank' &&
          !anchor.hasAttribute('download')
        ) {
          const href = anchor.getAttribute('href');
          if (href && href.charAt(0) !== '#' && href.indexOf('javascript:') !== 0) {
            e.preventDefault();
            navigateWithIosTransition(href);
          }
        }
      });
    }

    if (!window.__patelaSidebarKeyBound) {
      window.__patelaSidebarKeyBound = true;
      document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
          e.preventDefault();
          toggleSidebarCollapsed();
        } else if (e.key === 'Escape') {
          const sb = document.getElementById('app-sidebar');
          const sc = document.getElementById('sidebar-scrim');
          if (sb && sb.classList.contains('mobile-open')) {
            sb.classList.remove('mobile-open');
            if (sc) sc.classList.remove('open');
          }
        }
      });
    }
  }

  document.addEventListener('DOMContentLoaded', renderShell);
  window.PatelaNav = {
    renderShell: renderShell,
    toggleSidebarCollapsed: toggleSidebarCollapsed,
    resolveSiteHref: resolveSiteHref,
    navigateWithIosTransition: navigateWithIosTransition
  };
})();
