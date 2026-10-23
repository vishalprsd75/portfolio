// ═══════════════════════════════════════════════════════════
// Freelance Business Manager — SPA Client Application
// ═══════════════════════════════════════════════════════════

const state = {
  user: null,
  currency: 'INR',
  currentView: 'dashboard',
  clients: [],
  projects: [],
  documents: [],
  payments: [],
  settings: {},
};

// ── API Fetch Helper ──────────────────────────────────────
async function api(endpoint, options = {}) {
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  };

  const res = await fetch(`/api/v1${endpoint}`, { ...defaults, ...options });

  if (res.status === 401 && !endpoint.startsWith('/auth')) {
    showAuthScreen();
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }
  return data;
}

// ── Toast Notifications ───────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatMoney(amount) {
  const num = Number(amount) || 0;
  if (state.currency === 'INR') {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: state.currency || 'USD' }).format(num);
}

// ── Authentication & Lifecycle ────────────────────────────
async function initApp() {
  try {
    const authData = await api('/auth/me');
    state.user = authData.user;
    onAuthenticated();
  } catch (err) {
    checkSetupStatus();
  }
}

async function checkSetupStatus() {
  try {
    const { setupComplete } = await api('/auth/setup-status');
    const authScreen = document.getElementById('auth-screen');
    const setupNameField = document.getElementById('setup-name-field');
    const authTitle = document.getElementById('auth-title');
    const authSubtitle = document.getElementById('auth-subtitle');
    const submitBtn = document.getElementById('auth-submit-btn');

    authScreen.style.display = 'flex';

    if (!setupComplete) {
      setupNameField.style.display = 'block';
      authTitle.textContent = 'Setup Owner Account';
      authSubtitle.textContent = 'Create your private owner account to get started';
      submitBtn.textContent = 'Create Account & Start';
      submitBtn.dataset.mode = 'setup';
    } else {
      setupNameField.style.display = 'none';
      authTitle.textContent = 'Freelance Manager';
      authSubtitle.textContent = 'Sign in to your private business portal';
      submitBtn.textContent = 'Sign In';
      submitBtn.dataset.mode = 'login';
    }
  } catch (e) {
    showToast('Failed to check server status', 'error');
  }
}

function showAuthScreen() {
  document.getElementById('app-container').style.display = 'none';
  checkSetupStatus();
}

function onAuthenticated() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-avatar').textContent = state.user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  loadSettings();
  loadDashboard();
  loadDropdownData();
}

// ── Navigation ────────────────────────────────────────────
document.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    switchView(view);
  });
});

function switchView(viewName) {
  state.currentView = viewName;
  document.querySelectorAll('.sidebar-nav .nav-item').forEach((i) => i.classList.remove('active'));
  const activeNavItem = document.querySelector(`.sidebar-nav .nav-item[data-view="${viewName}"]`);
  if (activeNavItem) activeNavItem.classList.add('active');

  document.querySelectorAll('.app-view').forEach((v) => (v.style.display = 'none'));
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) targetView.style.display = 'block';

  document.getElementById('page-title').textContent =
    viewName.charAt(0).toUpperCase() + viewName.slice(1);

  // Close mobile sidebar if open
  document.getElementById('sidebar').classList.remove('mobile-open');

  if (viewName === 'dashboard') loadDashboard();
  else if (viewName === 'clients') loadClients();
  else if (viewName === 'projects') loadProjects();
  else if (viewName === 'documents') loadDocuments();
  else if (viewName === 'payments') loadPayments();
  else if (viewName === 'settings') loadSettingsForm();
}

// Mobile sidebar toggle
document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('mobile-open');
});

// Logout
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  showAuthScreen();
});

// ── Auth Form Submission ──────────────────────────────────
document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = document.getElementById('auth-submit-btn');
  const mode = submitBtn?.dataset?.mode;
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  const originalText = submitBtn ? submitBtn.textContent : 'Sign In';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = mode === 'setup' ? 'Creating...' : 'Signing in...';
  }

  try {
    if (mode === 'setup') {
      const name = document.getElementById('auth-name').value;
      const res = await api('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      state.user = res.user;
      showToast('Welcome to Freelance Manager!');
    } else {
      const res = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      state.user = res.user;
      showToast('Logged in successfully');
    }
    onAuthenticated();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }
});

function fillDemoCredentials() {
  const emailInput = document.getElementById('auth-email');
  const passInput = document.getElementById('auth-password');
  if (emailInput) emailInput.value = 'vishalprasad7505@gmail.com';
  if (passInput) passInput.value = 'Admin@123456';
  showToast('Demo credentials filled');
}

// ── Load Shared Settings ──────────────────────────────────
async function loadSettings() {
  try {
    state.settings = await api('/settings');
    if (state.settings?.currency) {
      state.currency = state.settings.currency;
    }
  } catch (err) {
    console.error(err);
  }
}

// ── DASHBOARD ─────────────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await api('/dashboard/stats');
    const { kpis, monthlyRevenue, recentActivities, upcomingProjects } = data;

    document.getElementById('kpi-revenue').textContent = formatMoney(kpis.totalRevenue);
    document.getElementById('kpi-receivables').textContent = formatMoney(kpis.outstandingReceivables);
    document.getElementById('kpi-active-projects').textContent = kpis.activeProjects;
    document.getElementById('kpi-clients').textContent = kpis.totalClients;
    document.getElementById('kpi-overdue-count').textContent = `${kpis.overdueCount} Overdue`;

    // Render 6-Month Revenue Trend Bars
    const barContainer = document.getElementById('revenue-bars-container');
    barContainer.innerHTML = '';
    const maxRev = Math.max(...monthlyRevenue.map((m) => m.amount), 1000);

    monthlyRevenue.forEach((m) => {
      const heightPercent = Math.round((m.amount / maxRev) * 100);
      const col = document.createElement('div');
      col.style.cssText = 'flex:1; display:flex; flex-direction:column; align-items:center; height:100%; justify-content:flex-end;';
      col.innerHTML = `
        <div style="font-size:11px; font-weight:600; color:var(--accent-1); margin-bottom:6px;">${m.amount > 0 ? formatMoney(m.amount) : ''}</div>
        <div style="width:100%; max-width:44px; height:${Math.max(heightPercent, 4)}%; background:var(--gradient-main); border-radius:6px 6px 0 0; transition:height 0.4s ease;"></div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">${m.month}</div>
      `;
      barContainer.appendChild(col);
    });

    // Upcoming Deadlines
    const deadlineList = document.getElementById('upcoming-deadlines-list');
    deadlineList.innerHTML = '';
    if (!upcomingProjects || upcomingProjects.length === 0) {
      deadlineList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No pending project deadlines.</p>';
    } else {
      upcomingProjects.forEach((p) => {
        const item = document.createElement('div');
        item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-subtle);';
        item.innerHTML = `
          <div>
            <div style="font-size:13.5px; font-weight:600; color:var(--text-primary);">${escapeHtml(p.name)}</div>
            <div style="font-size:11.5px; color:var(--text-muted);">${escapeHtml(p.client?.name || 'Client')}</div>
          </div>
          <div style="font-size:12px; font-weight:600; color:var(--accent-warning);">
            ${new Date(p.deadline).toLocaleDateString()}
          </div>
        `;
        deadlineList.appendChild(item);
      });
    }

    // Activity Logs
    const actList = document.getElementById('activity-log-list');
    actList.innerHTML = '';
    if (!recentActivities || recentActivities.length === 0) {
      actList.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No recent activities logged yet.</p>';
    } else {
      recentActivities.forEach((a) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-subtle); font-size:13px;';
        row.innerHTML = `
          <div>
            <span style="font-weight:600; color:var(--text-primary); text-transform:capitalize;">${escapeHtml(a.action.replace('.', ' '))}</span>
            ${a.details ? `<span style="color:var(--text-muted); margin-left:8px;">${escapeHtml(JSON.stringify(a.details).slice(0, 70))}</span>` : ''}
          </div>
          <span style="font-size:11px; color:var(--text-muted);">${new Date(a.createdAt).toLocaleString()}</span>
        `;
        actList.appendChild(row);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

// ── CLIENTS ───────────────────────────────────────────────
async function loadClients() {
  try {
    const search = document.getElementById('client-search')?.value || '';
    const res = await api(`/clients?search=${encodeURIComponent(search)}`);
    state.clients = res.clients || [];

    const tbody = document.getElementById('clients-table-body');
    tbody.innerHTML = '';

    if (state.clients.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No clients found. Click "+ Add Client" to create one.</td></tr>';
      return;
    }

    state.clients.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(c.name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(c.businessName || 'Individual')}</div>
        </td>
        <td>
          <div>${escapeHtml(c.email)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(c.phone || '—')}</div>
        </td>
        <td><span class="badge ${c.status === 'ACTIVE' ? 'badge-completed' : 'badge-draft'}">${c.status}</span></td>
        <td>${c._count?.projects || 0}</td>
        <td>${c._count?.documents || 0}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-client" data-id="${c.id}" onclick="editClient('${c.id}')">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-client" data-id="${c.id}" onclick="deleteClient('${c.id}')" title="Delete Client">&times;</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('client-search')?.addEventListener('input', debounce(loadClients, 300));
document.getElementById('btn-add-client')?.addEventListener('click', () => openClientModal());
document.getElementById('btn-quick-client')?.addEventListener('click', () => openClientModal());

function openClientModal(client = null) {
  document.getElementById('client-id').value = client?.id || '';
  document.getElementById('client-name').value = client?.name || '';
  document.getElementById('client-business').value = client?.businessName || '';
  document.getElementById('client-email').value = client?.email || '';
  document.getElementById('client-phone').value = client?.phone || '';
  document.getElementById('client-address').value = client?.address || '';
  document.getElementById('client-notes').value = client?.notes || '';
  document.getElementById('client-modal-title').textContent = client ? 'Edit Client' : 'New Client';
  openModal('modal-client');
}

window.editClient = function (id) {
  const c = state.clients.find((x) => x.id === id);
  if (c) openClientModal(c);
};

window.deleteClient = async function (id) {
  if (!confirm('Are you sure you want to delete this client?')) return;
  try {
    await api(`/clients/${id}`, { method: 'DELETE' });
    showToast('Client deleted successfully');
    loadClients();
    loadDropdownData();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('form-client')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('client-id').value;
  const name = document.getElementById('client-name').value.trim();
  const email = document.getElementById('client-email').value.trim();

  if (!name) {
    showToast('Please enter client name', 'error');
    document.getElementById('client-name').focus();
    return;
  }
  if (!email) {
    showToast('Please enter client email', 'error');
    document.getElementById('client-email').focus();
    return;
  }

  const saveBtn = document.getElementById('btn-save-client') || e.target.querySelector('button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  const payload = {
    name,
    businessName: document.getElementById('client-business').value.trim() || undefined,
    email,
    phone: document.getElementById('client-phone').value.trim() || undefined,
    address: document.getElementById('client-address').value.trim() || undefined,
    notes: document.getElementById('client-notes').value.trim() || undefined,
  };

  try {
    if (id) {
      await api(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Client updated successfully');
    } else {
      await api('/clients', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Client created successfully');
    }
    closeModal('modal-client');
    loadClients();
    loadDropdownData();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Client';
    }
  }
});

// ── PROJECTS ──────────────────────────────────────────────
async function loadProjects() {
  try {
    const search = document.getElementById('project-search')?.value || '';
    const status = document.getElementById('project-status-filter')?.value || '';
    let query = `?search=${encodeURIComponent(search)}`;
    if (status) query += `&status=${encodeURIComponent(status)}`;

    const res = await api(`/projects${query}`);
    state.projects = res.data || res.projects || [];

    const tbody = document.getElementById('projects-table-body');
    tbody.innerHTML = '';

    if (state.projects.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:24px; color:var(--text-muted);">No projects found.</td></tr>';
      return;
    }

    state.projects.forEach((p) => {
      const tr = document.createElement('tr');
      const badgeClass =
        p.status === 'COMPLETED' ? 'badge-completed'
        : p.status === 'IN_PROGRESS' ? 'badge-in-progress'
        : p.status === 'APPROVED' ? 'badge-approved'
        : 'badge-draft';

      tr.innerHTML = `
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(p.name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${escapeHtml(p.projectType || 'Standard')}</div>
        </td>
        <td>${escapeHtml(p.client?.name || '—')}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(p.status.replace('_', ' '))}</span></td>
        <td>${formatMoney(p.agreedAmount)}</td>
        <td>${p.deadline ? new Date(p.deadline).toLocaleDateString() : '—'}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-project" data-id="${p.id}" onclick="editProject('${p.id}')">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-project" data-id="${p.id}" onclick="deleteProject('${p.id}')" title="Delete Project">&times;</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('project-search')?.addEventListener('input', debounce(loadProjects, 300));
document.getElementById('project-status-filter')?.addEventListener('change', loadProjects);
document.getElementById('btn-add-project')?.addEventListener('click', () => openProjectModal());

function openProjectModal(project = null) {
  document.getElementById('project-id').value = project?.id || '';
  document.getElementById('project-name').value = project?.name || '';
  document.getElementById('project-type').value = project?.projectType || '';
  document.getElementById('project-status').value = project?.status || 'LEAD';
  document.getElementById('project-amount').value = project?.agreedAmount || '';
  document.getElementById('project-deadline').value = project?.deadline ? project.deadline.split('T')[0] : '';
  document.getElementById('project-scope').value = project?.scope || '';

  populateClientSelect('project-client-select', project?.clientId);
  document.getElementById('project-modal-title').textContent = project ? 'Edit Project' : 'New Project';
  openModal('modal-project');
}

window.editProject = function (id) {
  const p = state.projects.find((x) => x.id === id);
  if (p) openProjectModal(p);
};

window.deleteProject = async function (id) {
  if (!confirm('Are you sure you want to delete this project?')) return;
  try {
    await api(`/projects/${id}`, { method: 'DELETE' });
    showToast('Project deleted successfully');
    loadProjects();
    loadDropdownData();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

document.getElementById('form-project')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('project-id').value;
  const clientId = document.getElementById('project-client-select').value;
  const name = document.getElementById('project-name').value.trim();

  if (!clientId) {
    showToast('Please select a client for this project', 'error');
    document.getElementById('project-client-select').focus();
    return;
  }
  if (!name) {
    showToast('Please enter project name', 'error');
    document.getElementById('project-name').focus();
    return;
  }

  const saveBtn = document.getElementById('btn-save-project') || e.target.querySelector('button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  const payload = {
    clientId,
    name,
    projectType: document.getElementById('project-type').value.trim() || undefined,
    status: document.getElementById('project-status').value,
    agreedAmount: document.getElementById('project-amount').value || null,
    deadline: document.getElementById('project-deadline').value || null,
    scope: document.getElementById('project-scope').value.trim() || undefined,
  };

  try {
    if (id) {
      await api(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Project updated successfully');
    } else {
      await api('/projects', { method: 'POST', body: JSON.stringify(payload) });
      showToast('Project created successfully');
    }
    closeModal('modal-project');
    loadProjects();
    loadDropdownData();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Project';
    }
  }
});

// ── DOCUMENTS ─────────────────────────────────────────────
async function loadDocuments() {
  try {
    const type = document.getElementById('doc-type-filter')?.value || '';
    const status = document.getElementById('doc-status-filter')?.value || '';
    let query = '?';
    if (type) query += `type=${type}&`;
    if (status) query += `status=${status}&`;

    const res = await api(`/documents${query}`);
    state.documents = res.data || [];

    const tbody = document.getElementById('documents-table-body');
    tbody.innerHTML = '';

    if (state.documents.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No documents found. Click "+ Create Document" to draft one.</td></tr>';
      return;
    }

    state.documents.forEach((d) => {
      const tr = document.createElement('tr');
      const badgeClass =
        d.status === 'ISSUED' ? 'badge-issued'
        : d.status === 'ACCEPTED' || d.status === 'PAID' ? 'badge-completed'
        : 'badge-draft';

      tr.innerHTML = `
        <td style="font-family:'JetBrains Mono',monospace; font-weight:600; color:var(--text-primary);">${escapeHtml(d.documentNumber)}</td>
        <td><span class="badge badge-draft">${escapeHtml(d.type)}</span></td>
        <td>${escapeHtml(d.client?.name || '—')}</td>
        <td>${d.issueDate ? new Date(d.issueDate).toLocaleDateString() : '—'}</td>
        <td style="font-weight:600; color:var(--text-primary);">${formatMoney(d.totalAmount)}</td>
        <td><span class="badge ${badgeClass}">${escapeHtml(d.status)}</span></td>
        <td>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-secondary btn-sm" data-action="edit-doc" data-id="${d.id}" onclick="editDoc('${d.id}')" title="Edit Document">Edit</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="view-doc" data-id="${d.id}" onclick="previewDoc('${d.id}')" title="View Print HTML">View</button>
            <button type="button" class="btn btn-outline btn-sm" data-action="pdf-doc" data-id="${d.id}" onclick="downloadDoc('${d.id}')" title="Download PDF">PDF</button>
            <button type="button" class="btn btn-danger btn-sm" data-action="delete-doc" data-id="${d.id}" onclick="deleteDoc('${d.id}')" title="Delete">&times;</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('doc-type-filter')?.addEventListener('change', loadDocuments);
document.getElementById('doc-status-filter')?.addEventListener('change', loadDocuments);
document.getElementById('btn-create-document')?.addEventListener('click', () => openDocumentModal());
document.getElementById('btn-quick-doc')?.addEventListener('click', () => openDocumentModal());

window.previewDoc = function (id) {
  window.open(`/api/v1/pdf/${id}/html`, '_blank');
};

window.downloadDoc = function (id) {
  window.open(`/api/v1/pdf/${id}/download`, '_blank');
};

window.deleteDoc = async function (id) {
  if (!confirm('Are you sure you want to delete this document?')) return;
  try {
    await api(`/documents/${id}`, { method: 'DELETE' });
    showToast('Document deleted');
    loadDocuments();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

window.editDoc = async function (id) {
  try {
    const doc = await api(`/documents/${id}`);
    document.getElementById('doc-id').value = doc.id;
    document.getElementById('doc-type').value = doc.type;
    document.getElementById('doc-title').value = doc.title || '';
    document.getElementById('doc-issueDate').value = doc.issueDate ? doc.issueDate.split('T')[0] : '';
    document.getElementById('doc-dueDate').value = doc.dueDate ? doc.dueDate.split('T')[0] : '';
    document.getElementById('doc-terms').value = doc.terms || '';
    document.getElementById('doc-discount').value = doc.discountPercent || '0';
    document.getElementById('doc-tax').value = doc.taxPercent || '0';

    populateClientSelect('doc-client-select', doc.clientId);
    populateProjectSelect('doc-project-select', doc.projectId);

    const body = document.getElementById('line-items-body');
    body.innerHTML = '';
    if (doc.lineItems && doc.lineItems.length > 0) {
      doc.lineItems.forEach((item) => {
        addLineItemRow(item.description, item.quantity, item.unitPrice);
      });
    } else {
      addLineItemRow('Web Design & Development', 1, 0);
    }

    updateDocumentTotals();
    document.getElementById('doc-modal-title').textContent = `Edit ${doc.type}`;
    openModal('modal-document');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

function openDocumentModal() {
  document.getElementById('doc-id').value = '';
  document.getElementById('doc-type').value = 'QUOTATION';
  document.getElementById('doc-title').value = '';
  document.getElementById('doc-issueDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('doc-dueDate').value = '';
  document.getElementById('doc-terms').value = state.settings?.defaultPaymentTerms || '';
  document.getElementById('doc-discount').value = '0';
  document.getElementById('doc-tax').value = state.settings?.taxRate || '0';

  populateClientSelect('doc-client-select');
  populateProjectSelect('doc-project-select');

  // Reset line items with 1 clean item
  const body = document.getElementById('line-items-body');
  body.innerHTML = '';
  addLineItemRow('Web Design & Development', 1, 0);

  updateDocumentTotals();
  document.getElementById('doc-modal-title').textContent = 'New Document';
  openModal('modal-document');
}

function addLineItemRow(desc = '', qty = 1, rate = 0) {
  const tbody = document.getElementById('line-items-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="form-input item-desc" value="${escapeHtml(desc)}" placeholder="Item description" required style="padding:6px 10px;"></td>
    <td><input type="number" class="form-input item-qty" value="${qty}" min="0.1" step="any" style="padding:6px 10px; text-align:center;"></td>
    <td><input type="number" class="form-input item-rate" value="${rate}" min="0" step="any" style="padding:6px 10px; text-align:right;"></td>
    <td class="item-amount" style="text-align:right; font-weight:600; color:var(--text-primary); padding:6px 10px;">${formatMoney(qty * rate)}</td>
    <td><button type="button" class="btn-icon remove-item-btn" style="color:var(--accent-danger);">&times;</button></td>
  `;

  tr.querySelector('.remove-item-btn')?.addEventListener('click', () => {
    tr.remove();
    updateDocumentTotals();
  });

  tr.querySelectorAll('.item-qty, .item-rate').forEach((input) => {
    input.addEventListener('input', () => {
      const q = Number(tr.querySelector('.item-qty').value) || 0;
      const r = Number(tr.querySelector('.item-rate').value) || 0;
      tr.querySelector('.item-amount').textContent = formatMoney(q * r);
      updateDocumentTotals();
    });
  });

  tbody.appendChild(tr);
}

document.getElementById('btn-add-line-item')?.addEventListener('click', () => {
  addLineItemRow('', 1, 0);
});

document.getElementById('doc-discount')?.addEventListener('input', updateDocumentTotals);
document.getElementById('doc-tax')?.addEventListener('input', updateDocumentTotals);

function updateDocumentTotals() {
  let subtotal = 0;
  document.querySelectorAll('#line-items-body tr').forEach((tr) => {
    const q = Number(tr.querySelector('.item-qty')?.value) || 0;
    const r = Number(tr.querySelector('.item-rate')?.value) || 0;
    subtotal += q * r;
  });

  const discountPct = Number(document.getElementById('doc-discount')?.value) || 0;
  const discountAmount = (subtotal * discountPct) / 100;
  const subAfterDiscount = subtotal - discountAmount;

  const taxPct = Number(document.getElementById('doc-tax')?.value) || 0;
  const taxAmount = (subAfterDiscount * taxPct) / 100;
  const total = subAfterDiscount + taxAmount;

  document.getElementById('doc-calc-subtotal').textContent = formatMoney(subtotal);
  document.getElementById('doc-calc-total').textContent = formatMoney(total);
}

window.submitDocument = async function (status = 'DRAFT') {
  const docId = document.getElementById('doc-id').value;
  const clientId = document.getElementById('doc-client-select').value;
  if (!clientId) {
    showToast('Please select a client for this document', 'error');
    document.getElementById('doc-client-select').focus();
    return;
  }

  const lineItems = [];
  document.querySelectorAll('#line-items-body tr').forEach((tr) => {
    const desc = tr.querySelector('.item-desc')?.value?.trim();
    const qty = Number(tr.querySelector('.item-qty')?.value) || 1;
    const rate = Number(tr.querySelector('.item-rate')?.value) || 0;
    if (desc) {
      lineItems.push({ description: desc, quantity: qty, unitPrice: rate });
    }
  });

  if (lineItems.length === 0) {
    showToast('Please add at least one line item with a description', 'error');
    return;
  }

  const draftBtn = document.getElementById('btn-doc-draft');
  const issueBtn = document.getElementById('btn-doc-issue');
  if (status === 'DRAFT' && draftBtn) {
    draftBtn.disabled = true;
    draftBtn.textContent = 'Saving...';
  } else if (issueBtn) {
    issueBtn.disabled = true;
    issueBtn.textContent = 'Issuing...';
  }

  const payload = {
    type: document.getElementById('doc-type').value,
    status,
    clientId,
    projectId: document.getElementById('doc-project-select').value || null,
    title: document.getElementById('doc-title').value.trim() || undefined,
    issueDate: document.getElementById('doc-issueDate').value || undefined,
    dueDate: document.getElementById('doc-dueDate').value || null,
    discountPercent: Number(document.getElementById('doc-discount').value) || 0,
    taxPercent: Number(document.getElementById('doc-tax').value) || 0,
    terms: document.getElementById('doc-terms').value.trim() || undefined,
    lineItems,
  };

  try {
    if (docId) {
      await api(`/documents/${docId}`, { method: 'PUT', body: JSON.stringify(payload) });
      showToast('Document updated successfully');
    } else {
      await api('/documents', { method: 'POST', body: JSON.stringify(payload) });
      showToast(`Document created as ${status}`);
    }
    closeModal('modal-document');
    loadDocuments();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (draftBtn) {
      draftBtn.disabled = false;
      draftBtn.textContent = 'Save as Draft';
    }
    if (issueBtn) {
      issueBtn.disabled = false;
      issueBtn.textContent = 'Save & Issue';
    }
  }
};

document.getElementById('form-document')?.addEventListener('submit', (e) => {
  e.preventDefault();
  submitDocument('ISSUED');
});

// ── PAYMENTS ──────────────────────────────────────────────
async function loadPayments() {
  try {
    const res = await api('/payments');
    state.payments = res.data || [];

    const tbody = document.getElementById('payments-table-body');
    tbody.innerHTML = '';

    if (state.payments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:24px; color:var(--text-muted);">No payments recorded yet.</td></tr>';
      return;
    }

    state.payments.forEach((p) => {
      const tr = document.createElement('tr');
      const allocText =
        p.allocations && p.allocations.length > 0
          ? p.allocations.map((a) => a.invoice?.document?.documentNumber).join(', ')
          : 'General Credit';

      tr.innerHTML = `
        <td>${new Date(p.paymentDate).toLocaleDateString()}</td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${escapeHtml(p.client?.name || '—')}</div>
        </td>
        <td style="font-weight:700; color:var(--accent-success);">${formatMoney(p.amount)}</td>
        <td>${escapeHtml(p.paymentMethod || 'Bank')}</td>
        <td style="font-family:'JetBrains Mono',monospace; font-size:12px;">${escapeHtml(p.transactionRef || '—')}</td>
        <td><span class="badge badge-draft">${escapeHtml(allocText)}</span></td>
        <td>
          <button type="button" class="btn btn-danger btn-sm" data-action="delete-payment" data-id="${p.id}" onclick="deletePayment('${p.id}')">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('btn-record-payment')?.addEventListener('click', () => openPaymentModal());
document.getElementById('btn-quick-payment')?.addEventListener('click', () => openPaymentModal());

async function openPaymentModal() {
  document.getElementById('payment-amount').value = '';
  document.getElementById('payment-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('payment-ref').value = '';
  populateClientSelect('payment-client-select');

  // Load unpaid invoices for first client
  loadUnpaidInvoicesForClient();
  openModal('modal-payment');
}

document.getElementById('payment-client-select')?.addEventListener('change', loadUnpaidInvoicesForClient);

async function loadUnpaidInvoicesForClient() {
  const clientId = document.getElementById('payment-client-select')?.value;
  const select = document.getElementById('payment-invoice-select');
  select.innerHTML = '<option value="">-- No specific invoice (General credit) --</option>';

  if (!clientId) return;

  try {
    const res = await api(`/documents?clientId=${clientId}&type=INVOICE`);
    const invoices = (res.data || []).filter((d) => d.invoice && Number(d.invoice.balance) > 0);

    invoices.forEach((inv) => {
      const opt = document.createElement('option');
      opt.value = inv.invoice.id;
      opt.textContent = `${inv.documentNumber} — Balance: ${formatMoney(inv.invoice.balance)}`;
      opt.dataset.balance = inv.invoice.balance;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('payment-invoice-select')?.addEventListener('change', (e) => {
  const selectedOpt = e.target.selectedOptions[0];
  if (selectedOpt && selectedOpt.dataset.balance) {
    document.getElementById('payment-amount').value = selectedOpt.dataset.balance;
  }
});

document.getElementById('form-payment')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const clientId = document.getElementById('payment-client-select').value;
  const amount = Number(document.getElementById('payment-amount').value);
  const paymentDate = document.getElementById('payment-date').value;
  const paymentMethod = document.getElementById('payment-method').value;
  const transactionRef = document.getElementById('payment-ref').value.trim();
  const invoiceId = document.getElementById('payment-invoice-select').value;
  const autoReceipt = document.getElementById('payment-auto-receipt').checked;

  if (!clientId) {
    showToast('Please select a client for this payment', 'error');
    document.getElementById('payment-client-select').focus();
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please enter a valid payment amount greater than 0', 'error');
    document.getElementById('payment-amount').focus();
    return;
  }

  const allocations = [];
  if (invoiceId) {
    allocations.push({ invoiceId, amount });
  }

  const saveBtn = document.getElementById('btn-save-payment') || e.target.querySelector('button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Recording...';
  }

  const payload = {
    clientId,
    amount,
    paymentDate: paymentDate || undefined,
    paymentMethod,
    transactionRef: transactionRef || undefined,
    allocations,
    autoGenerateReceipt: autoReceipt,
  };

  try {
    await api('/payments', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Payment recorded successfully');
    closeModal('modal-payment');
    loadPayments();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Record Payment';
    }
  }
});

window.deletePayment = async function (id) {
  if (!confirm('Are you sure you want to delete this payment? Invoice balances will be restored.')) return;
  try {
    await api(`/payments/${id}`, { method: 'DELETE' });
    showToast('Payment deleted');
    loadPayments();
    loadDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ── SETTINGS ──────────────────────────────────────────────
async function loadSettingsForm() {
  try {
    const s = await api('/settings');
    state.settings = s;

    document.getElementById('set-businessName').value = s.businessName || '';
    document.getElementById('set-email').value = s.email || '';
    document.getElementById('set-phone').value = s.phone || '';
    document.getElementById('set-address').value = s.address || '';
    document.getElementById('set-currency').value = s.currency || 'INR';
    document.getElementById('set-timezone').value = s.timezone || 'Asia/Kolkata';
    document.getElementById('set-defaultValidityDays').value = s.defaultValidityDays || 15;
    document.getElementById('set-paymentInstructions').value = s.paymentInstructions || '';
    document.getElementById('set-defaultPaymentTerms').value = s.defaultPaymentTerms || '';
    document.getElementById('set-pdfFooterText').value = s.pdfFooterText || '';
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById('btn-save-settings') || e.target.querySelector('button[type="submit"]');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }

  const payload = {
    businessName: document.getElementById('set-businessName').value.trim() || undefined,
    email: document.getElementById('set-email').value.trim() || undefined,
    phone: document.getElementById('set-phone').value.trim() || undefined,
    address: document.getElementById('set-address').value.trim() || undefined,
    currency: document.getElementById('set-currency').value.trim() || 'INR',
    timezone: document.getElementById('set-timezone').value.trim() || 'Asia/Kolkata',
    defaultValidityDays: Number(document.getElementById('set-defaultValidityDays').value) || 15,
    paymentInstructions: document.getElementById('set-paymentInstructions').value.trim() || undefined,
    defaultPaymentTerms: document.getElementById('set-defaultPaymentTerms').value.trim() || undefined,
    pdfFooterText: document.getElementById('set-pdfFooterText').value.trim() || undefined,
  };

  try {
    state.settings = await api('/settings', { method: 'PUT', body: JSON.stringify(payload) });
    state.currency = state.settings.currency || 'INR';
    showToast('Settings saved successfully');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Settings';
    }
  }
});

// ── Shared Modal Helpers ──────────────────────────────────
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

async function handleLogout() {
  try {
    await api('/auth/logout', { method: 'POST' });
  } catch (e) {}
  showAuthScreen();
}

// Global window exposures for inline HTML handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.openClientModal = openClientModal;
window.openProjectModal = openProjectModal;
window.openDocumentModal = openDocumentModal;
window.openPaymentModal = openPaymentModal;
window.handleLogout = handleLogout;
window.editClient = editClient;
window.deleteClient = deleteClient;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.editDoc = editDoc;
window.previewDoc = previewDoc;
window.downloadDoc = downloadDoc;
window.deleteDoc = deleteDoc;
window.deletePayment = deletePayment;
window.submitDocument = submitDocument;
window.addLineItemRow = addLineItemRow;
window.updateDocumentTotals = updateDocumentTotals;
window.fillDemoCredentials = fillDemoCredentials;

// Global Unified Click Event Delegation
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button, .btn, .modal-close');
  if (!btn) return;

  // 1. Modal close button
  if (btn.classList.contains('modal-close')) {
    const overlay = btn.closest('.modal-overlay');
    if (overlay) overlay.classList.remove('active');
    return;
  }

  // 2. Data actions on table rows
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action === 'edit-client' && id) { editClient(id); return; }
  if (action === 'delete-client' && id) { deleteClient(id); return; }
  if (action === 'edit-project' && id) { editProject(id); return; }
  if (action === 'delete-project' && id) { deleteProject(id); return; }
  if (action === 'edit-doc' && id) { editDoc(id); return; }
  if (action === 'view-doc' && id) { previewDoc(id); return; }
  if (action === 'pdf-doc' && id) { downloadDoc(id); return; }
  if (action === 'delete-doc' && id) { deleteDoc(id); return; }
  if (action === 'delete-payment' && id) { deletePayment(id); return; }

  // 3. Quick buttons by ID
  if (btn.id === 'btn-quick-client' || btn.id === 'btn-add-client') {
    openClientModal();
    return;
  }
  if (btn.id === 'btn-quick-payment' || btn.id === 'btn-record-payment') {
    openPaymentModal();
    return;
  }
  if (btn.id === 'btn-quick-doc' || btn.id === 'btn-create-document') {
    openDocumentModal();
    return;
  }
  if (btn.id === 'btn-add-project') {
    openProjectModal();
    return;
  }
  if (btn.id === 'btn-add-line-item') {
    addLineItemRow();
    return;
  }
  if (btn.id === 'btn-doc-draft') {
    submitDocument('DRAFT');
    return;
  }
  if (btn.id === 'btn-doc-issue') {
    submitDocument('ISSUED');
    return;
  }
});

// Close modals on clicking overlay backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList && e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach((m) => m.classList.remove('active'));
  }
});

async function loadDropdownData() {
  try {
    const [cRes, pRes] = await Promise.all([
      api('/clients?limit=100'),
      api('/projects?limit=100'),
    ]);
    state.clients = cRes.clients || [];
    state.projects = pRes.data || pRes.projects || [];
  } catch (e) {
    console.error(e);
  }
}

function populateClientSelect(selectId, selectedId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">-- Select Client --</option>';
  state.clients.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name}${c.businessName ? ` (${c.businessName})` : ''}`;
    if (selectedId && opt.value === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

function populateProjectSelect(selectId, selectedId = null) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML = '<option value="">-- No Project --</option>';
  state.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    if (selectedId && opt.value === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// ── Start Application ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', initApp);
