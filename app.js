const SUPABASE_URL = 'https://zvjrbnlmwaigqotlwrlv.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_-laJfxmOVoe3F3kBtU30tQ_TQRboWCI';
const FUNCTIONS_URL = 'https://zvjrbnlmwaigqotlwrlv.supabase.co/functions/v1';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let CURRENT_USER = null;

function showLoading(s) { document.getElementById('loadingSpinner').classList.toggle('hidden', !s); }
function showToast(m, t = 'success') { const c = document.getElementById('customAlertContainer'); const e = document.createElement('div'); e.className = `px-4 py-2 rounded shadow-lg text-white font-bold text-xs transform transition-all duration-300 translate-x-full ${t === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`; e.innerHTML = m; c.appendChild(e); setTimeout(() => e.classList.remove('translate-x-full'), 10); setTimeout(() => { e.classList.add('translate-x-full'); setTimeout(() => e.remove(), 300); }, 3000); }

async function callApi(fn, args) {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const res = await fetch(`${FUNCTIONS_URL}/api`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` }, body: JSON.stringify({ fn, args }) });
  const data = await res.json(); if (data.error) throw new Error(data.error); return data;
}

// LOGIN
async function executeLogin(e) {
  e.preventDefault(); showLoading(true);
  try {
    const empId = document.getElementById('loginEmpId').value.trim().toLowerCase();
    const pwd = document.getElementById('loginPassword').value.trim();
    const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({ email: empId + '@valicore.com', password: pwd });
    if (authErr) throw new Error("ভুল Employee ID বা Password!");

    const { data: profile } = await supabaseClient.from('users').select('*').eq('auth_id', authData.user.id).single();
    CURRENT_USER = profile;
    
    document.getElementById('loginPageWrapper').classList.add('hidden');
    document.getElementById('mainAppWrapper').classList.remove('hidden');
    document.getElementById('navUserFullName').innerText = profile.full_name;
    document.getElementById('navUserTeamRole').innerText = profile.team_name + " (" + profile.role + ")";
    document.getElementById('headerWelcomeText').innerText = "Welcome, " + profile.full_name;
    document.getElementById('navUserAvatar').innerText = profile.team_name.substring(0,3).toUpperCase();

    navigateTo('dashboard', document.querySelector('.sidebar-link'));
    loadDashboardData();
  } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); }
}

function executeLogout() { supabaseClient.auth.signOut(); location.reload(); }

// NAVIGATION
function navigateTo(p, btn) {
  document.querySelectorAll('.sidebar-link').forEach(b => b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  document.querySelectorAll('#viewContainer > div').forEach(d => d.classList.add('hidden'));
  document.getElementById(`view-${p}`).classList.remove('hidden');
  
  const titles = { dashboard: 'Dashboard', ccr: 'CCR (R&D)', warehouse: 'Warehouse', validation: 'Validation', qa: 'QA (Doc. Control)', admin: 'Admin Panel' };
  document.getElementById('currentActivePageTitle').innerText = titles[p] || 'ValiCore';

  if (p === 'ccr') loadCcrData(1);
}

// DASHBOARD
async function loadDashboardData() {
  try {
    const rows = JSON.parse(await callApi('fetchFinalSummaryData', []));
    let m = { matNo: 0, pPending: 0, completed: 0 }, c = { PV: 0, PVR: 0, PO: 0 };
    
    rows.forEach(r => {
      if (r.category === 'Process Validation') c.PV++; else if (r.category === 'Process Verification') c.PVR++; else if (r.category === 'Process Optimization') c.PO++;
      if (r.material_availability === 'No') m.matNo++; 
      if (r.protocol_status === 'Pending') m.pPending++; 
      if (r.execution_status === 'Completed') m.completed++;
    });

    document.getElementById('metricMatNeed').innerText = m.matNo;
    document.getElementById('metricProtoPending').innerText = m.pPending;
    document.getElementById('metricCompleted').innerText = m.completed;

    Highcharts.chart('pvStatusChart', {
      chart: { type: 'column', backgroundColor: 'transparent' }, title: { text: 'Status Overview', style: { fontSize: '12px', fontWeight: 'bold' } },
      xAxis: { categories: ['Material Need', 'Protocol Pending'] }, legend: { enabled: false }, credits: { enabled: false },
      series: [{ data: [m.matNo, m.pPending], color: '#ef4444', dataLabels: { enabled: true } }]
    });

    Highcharts.chart('actionPlanChart', {
      chart: { type: 'pie', backgroundColor: 'transparent' }, title: { text: 'Category Distribution', style: { fontSize: '12px', fontWeight: 'bold' } },
      credits: { enabled: false },
      series: [{ data: [{name:'PV',y:c.PV,color:'#10b981'}, {name:'PVR',y:c.PVR,color:'#3b82f6'}, {name:'PO',y:c.PO,color:'#f59e0b'}] }]
    });
  } catch (e) { console.error(e); }
}

// CCR MODULE
function toggleCcrForm(show) { document.getElementById('ccrFormContainer').classList.toggle('hidden', !show); }

async function loadCcrData(page = 1) {
  const tbody = document.getElementById('ccrModuleGridTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">Loading...</td></tr>';
  try {
    const search = document.getElementById('ccrGlobalSearchInput').value;
    const res = await callApi('fetchCcrPaged', [{ page, pageSize: 50, search }]);
    
    if (res.rows.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-slate-400">No records found.</td></tr>'; return; }

    tbody.innerHTML = res.rows.map((r, i) => {
      const bg = i % 2 === 0 ? 'bg-white' : 'bg-sky-50';
      return `<tr class="${bg} hover:bg-sky-100 transition-colors">
        <td class="p-2 font-bold sticky left-0 ${bg}">S/L ${r.CCRSL}</td>
        <td class="p-2 font-semibold">${r.ProductName}</td>
        <td class="p-2 text-blue-600 font-bold">${r.CCRNo}</td>
        <td class="p-2"><span class="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">${r.Category}</span></td>
        <td class="p-2 text-slate-500">${r.CreatedAt ? r.CreatedAt.split('T')[0] : '-'}</td>
      </tr>`;
    }).join('');
  } catch (err) { tbody.innerHTML = `<tr><td colspan="5" class="text-red-500 text-center">${err.message}</td></tr>`; }
}

async function submitNewCcr(e) {
  e.preventDefault(); showLoading(true);
  const payload = {
    productName: document.getElementById('ccrProductName').value,
    ccrNo: document.getElementById('ccrNoInput').value,
    batchSize: document.getElementById('ccrBatchSize').value,
    actionPlan: document.getElementById('ccrActionPlan').value,
    reasonForCcr: "Process Change", existingStatus: "Pending", proposedChange: "Pending", materialDependency: "Yes" // Defaults for simplified form
  };
  try {
    await callApi('addNewCcrRecord', [payload]);
    showToast('New CCR Added Successfully!');
    toggleCcrForm(false);
    document.getElementById('formCcrEntry').reset();
    loadCcrData(1);
  } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); }
}
