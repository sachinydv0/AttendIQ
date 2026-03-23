const API_BASE = 'http://localhost:3001';
let savedCreds = null;
let appData    = null;

function pct(p,t) { return t ? Math.round((p/t)*100) : 0; }
function colorForPct(p) { return p>=75?'var(--green)':p>=60?'var(--yellow)':'var(--red)'; }
function setLoading(on,txt) {
  document.getElementById('loadingOverlay').classList.toggle('show',on);
  if(txt) document.getElementById('loadingTxt').textContent=txt;
}
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function showTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+name).classList.add('active');
  document.querySelector('[data-tab="'+name+'"]').classList.add('active');
}

// Nav
document.querySelectorAll('.nav-tab').forEach(btn=>
  btn.addEventListener('click',()=>showTab(btn.dataset.tab))
);

// Password toggle
document.getElementById('pwToggle').onclick=()=>{
  const i=document.getElementById('pwInput');
  i.type=i.type==='password'?'text':'password';
};

// Login
document.getElementById('loginBtn').onclick=doLogin;
['admInput','pwInput'].forEach(id=>
  document.getElementById(id).addEventListener('keydown',e=>e.key==='Enter'&&doLogin())
);

async function doLogin() {
  const admission_no=document.getElementById('admInput').value.trim();
  const password=document.getElementById('pwInput').value;
  if(!admission_no||!password){showErr('Enter Admission ID and Password.');return;}
  const btn=document.getElementById('loginBtn');
  btn.disabled=true; btn.textContent='Logging in...';
  setLoading(true,'Connecting to IMS ERP...');
  hideErr();
  try {
    const res=await fetch(`${API_BASE}/api/login`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({admission_no,password})
    });
    const data=await res.json();
    if(!data.success) throw new Error(data.error||'Login failed.');
    savedCreds={admission_no,password};
    appData=data;
    buildDashboard(data);
    showScreen('dashScreen');
    // Auto-load today's attendance
    const today=new Date().toISOString().split('T')[0];
    document.getElementById('dateFrom').value=today;
    filterDates();
  } catch(e){ showErr(e.message); }
  finally{ btn.disabled=false; btn.textContent='Login'; setLoading(false); }
}

function showErr(msg){ const e=document.getElementById('errMsg'); e.textContent='⚠ '+msg; e.classList.add('show'); }
function hideErr(){ document.getElementById('errMsg').classList.remove('show'); }

async function doRefresh() {
  if(!savedCreds) return;
  setLoading(true,'Refreshing...');
  try {
    const res=await fetch(`${API_BASE}/api/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(savedCreds)});
    const data=await res.json();
    if(data.success){ appData=data; buildDashboard(data);
      const today=new Date().toISOString().split('T')[0];
      document.getElementById('dateFrom').value=today;
      filterDates();
    }
  } catch(e){}
  finally{ setLoading(false); }
}
document.getElementById('refreshBtn').onclick=doRefresh;
document.getElementById('refreshBtnS').onclick=doRefresh;

document.getElementById('logoutBtn').onclick=()=>{
  savedCreds=null; appData=null;
  document.getElementById('admInput').value='';
  document.getElementById('pwInput').value='';
  showScreen('loginScreen');
};

function buildDashboard(data) {
  const s=data.student||{}, att=data.attendance||{};
  const total=att.total||0, present=att.present||0;
  const absent=att.absent||(total-present);
  const p=att.percentage||pct(present,total);

  document.getElementById('tbName').textContent=s.name||'—';
  document.getElementById('tbAdm').textContent=s.admission_no||'—';

  const circ=207.3, color=colorForPct(p);
  const ring=document.getElementById('ringFill');
  ring.style.stroke=color;
  setTimeout(()=>{ ring.style.strokeDashoffset=circ-(circ*Math.min(p,100)/100); },150);
  document.getElementById('ringPct').textContent=p+'%';
  document.getElementById('ringPct').style.color=color;
  document.getElementById('stTotal').textContent=total;
  document.getElementById('stPresent').textContent=present;
  document.getElementById('stAbsent').textContent=absent;

  const badge=document.getElementById('statusBadge');
  if(p>=75){badge.textContent='✓ SAFE';badge.className='badge badge-safe';}
  else if(p>=60){badge.textContent='⚠ AT RISK';badge.className='badge badge-risk';}
  else{badge.textContent='✕ CRITICAL';badge.className='badge badge-critical';}
  document.getElementById('erpLabel').textContent=att.label||'';

  const bunks=p>=75?Math.max(0,Math.floor(present/0.75-total)):0;
  const need75=p<75?Math.ceil((0.75*total-present)/0.25):0;
  const al=document.getElementById('alertBox');
  if(p>=85) al.textContent=`Great! You can skip ${bunks} more class${bunks!==1?'es':''} and stay above 75%.`;
  else if(p>=75) al.textContent=`Safe zone. You have ${bunks} safe bunk${bunks!==1?'s':''} remaining.`;
  else if(p>=60) al.textContent=`Caution! Attend ${need75} more class${need75!==1?'es':''} to reach 75%.`;
  else al.textContent=`Critical! You need ${need75} consecutive classes to reach 75%.`;
  al.style.borderLeftColor=color;

  const need90=p<90?Math.ceil((0.90*total-present)/0.10):0;
  document.getElementById('icBunks').textContent=p>=75?bunks:0;
  document.getElementById('icBunks').style.color=p>=75?'var(--green)':'var(--red)';
  document.getElementById('icBunksDesc').textContent=p>=75?'Skip & stay ≥75%':'Below 75%, no bunks';
  document.getElementById('icNeed75').textContent=p>=75?'✓':need75;
  document.getElementById('icNeed75').style.color=p>=75?'var(--green)':'var(--yellow)';
  document.getElementById('icNeed75Desc').textContent=p>=75?'Already above 75%':`${need75} classes needed`;
  document.getElementById('icNeed90').textContent=p>=90?'✓':need90;
  document.getElementById('icNeed90').style.color=p>=90?'var(--green)':'var(--blue)';
  document.getElementById('icNeed90Desc').textContent=p>=90?'Already above 90%':`${need90} classes needed`;

  initSim(total,present,p);

  document.getElementById('siName').textContent=s.name||'—';
  document.getElementById('siAdm').textContent=s.admission_no||'—';
  document.getElementById('siCourse').textContent=s.course||'—';
  document.getElementById('siSem').textContent=s.semester?'Sem '+s.semester:'—';
  document.getElementById('siSec').textContent=s.section||'—';
  document.getElementById('lastSync').textContent='Last synced: '+new Date(data.fetchedAt).toLocaleString('en-IN');
}

function initSim(total,present,curPct) {
  document.getElementById('simCur').textContent=curPct+'%';
  document.getElementById('simCur').style.color=colorForPct(curPct);
  function update() {
    const att=parseInt(document.getElementById('simAtt').value);
    const tot=parseInt(document.getElementById('simTot').value);
    document.getElementById('simAtt').max=tot;
    const ca=Math.min(att,tot);
    document.getElementById('simAttVal').textContent=ca;
    document.getElementById('simTotVal').textContent=tot;
    const nt=total+tot;
    const ia=nt?Math.round(((present+ca)/nt)*100):0;
    const ib=nt?Math.round((present/nt)*100):0;
    document.getElementById('simIfAtt').textContent=ia+'%';
    document.getElementById('simIfAtt').style.color=colorForPct(ia);
    document.getElementById('simIfBunk').textContent=ib+'%';
    document.getElementById('simIfBunk').style.color=colorForPct(ib);
    document.getElementById('simLive').textContent=ia+'%';
    document.getElementById('simLive').style.color=colorForPct(ia);
  }
  document.getElementById('simAtt').oninput=update;
  document.getElementById('simTot').oninput=update;
  update();
}

function toERPDate(iso) { const [y,m,d]=iso.split('-'); return d+'-'+m+'-'+y; }
function toDisplayDate(iso) {
  return new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'short',year:'numeric'});
}

async function filterDates() {
  const dateVal=document.getElementById('dateFrom').value;
  if(!dateVal){alert('Please select a date.');return;}
  if(!savedCreds) return;

  const list=document.getElementById('dateList');
  list.innerHTML='<div class="ds-note">Fetching from ERP...</div>';
  document.getElementById('dateSummary').style.display='none';

  try {
    const resp=await fetch(
      `${API_BASE}/api/datewise?date=${toERPDate(dateVal)}&admission_no=${encodeURIComponent(savedCreds.admission_no)}`
    );
    const data=await resp.json();

    if(!data.success||!data.records||!data.records.length) {
      list.innerHTML='<div class="ds-note">No classes found for '+toDisplayDate(dateVal)+'</div>';
      return;
    }

    const records=data.records;
    const p=records.filter(r=>r.status==='present').length;
    const a=records.filter(r=>r.status==='absent').length;
    const eligible=p+a;
    const pv=eligible>0?Math.round((p/eligible)*100):0;

    document.getElementById('dateSummary').style.display='flex';
    document.getElementById('dsTotal').textContent=records.length;
    document.getElementById('dsPresent').textContent=p;
    document.getElementById('dsAbsent').textContent=a;
    document.getElementById('dsPct').textContent=eligible>0?pv+'%':'—';
    document.getElementById('dsPct').style.color=eligible>0?colorForPct(pv):'var(--muted)';

    list.innerHTML=
      `<div class="date-header">${toDisplayDate(dateVal)}</div>`+
      records.map(r=>{
        const pillCls=r.status==='present'?'ds-present':r.status==='absent'?'ds-absent':'ds-pending';
        const pillTxt=r.status==='present'?'Present':r.status==='absent'?'Absent':(r.attendence||'Not Taken');
        return `<div class="date-item">
          <div class="date-left">
            <div class="date-day">${r.subject||'—'}</div>
            <div class="date-subj">${r.faculty||''}${r.room?' · Room '+r.room:''}</div>
            ${r.code?`<div class="date-subj" style="color:var(--accent);font-size:10px">${r.code}</div>`:''}
          </div>
          <div class="date-status ${pillCls}">${pillTxt}</div>
        </div>`;
      }).join('');

  } catch(e) {
    list.innerHTML='<div class="ds-note">Error: '+e.message+'</div>';
  }
}