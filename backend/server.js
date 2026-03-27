const express = require('express');
const axios   = require('axios');
const cheerio = require('cheerio');
const cors    = require('cors');

const app = express();
app.use(express.json());

// ── CORS: restrict to your GitHub Pages domain ────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://sachinydv0.github.io/AttendIQ/',         
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'null', // file:// protocol (local dev)
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(null, true); // keep permissive for now — tighten once you confirm your Pages URL
  },
}));

// ── Simple in-memory rate limiter (per IP) ────────────────────────────────────
const rateLimits = {};
function rateLimit(req, res, next) {
  const ip  = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
  const now = Date.now();
  if (!rateLimits[ip]) rateLimits[ip] = { count: 1, start: now };
  else {
    if (now - rateLimits[ip].start > 60_000) {
      rateLimits[ip] = { count: 1, start: now };
    } else {
      rateLimits[ip].count++;
      if (rateLimits[ip].count > 20) {
        return res.status(429).json({ error: 'Too many requests. Please wait a minute.' });
      }
    }
  }
  next();
}
app.use('/api/', rateLimit);

// ── Clean up rate limit map every 5 minutes ───────────────────────────────────
setInterval(() => {
  const now = Date.now();
  for (const ip in rateLimits) {
    if (now - rateLimits[ip].start > 120_000) delete rateLimits[ip];
  }
}, 300_000);

const BASE = 'https://erp.imsuc.ac.in';

function extractCookies(arr) {
  if (!arr) return '';
  return arr.map(c => c.split(';')[0]).join('; ');
}
function mergeCookies(existing, fresh) {
  if (!fresh) return existing;
  const map = {};
  [...existing.split('; '), ...fresh.split('; ')].forEach(c => {
    const idx = c.indexOf('=');
    if (idx > 0) map[c.slice(0,idx).trim()] = c.slice(idx+1).trim();
  });
  return Object.entries(map).map(([k,v]) => `${k}=${v}`).join('; ');
}

// ── Session store with TTL (1 hour) ──────────────────────────────────────────
const sessions = {};
const SESSION_TTL = 5 * 60 * 1000; //  5 minutes

function saveSession(admission_no, cookies) {
  sessions[admission_no] = { cookies, ts: Date.now() };
}
function getSession(admission_no) {
  const s = sessions[admission_no];
  if (!s) return null;
  if (Date.now() - s.ts > SESSION_TTL) {
    delete sessions[admission_no];
    return null;
  }
  return s.cookies;
}

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const id in sessions) {
    if (now - sessions[id].ts > SESSION_TTL) delete sessions[id];
  }
}, 5 * 60 * 1000); // every 5 minutes

async function doLogin(admission_no, password) {
  const initResp = await axios.get(`${BASE}/`, {
    headers: { 'User-Agent': 'Mozilla/5.0 Chrome/146.0.0.0' },
    maxRedirects: 5,
  });
  let cookies = extractCookies(initResp.headers['set-cookie']);

  const loginResp = await axios.post(
    `${BASE}/`,
    new URLSearchParams({ email: admission_no, password }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':   'Mozilla/5.0 Chrome/146.0.0.0',
        'Referer':      `${BASE}/`,
        'Origin':       BASE,
        'Cookie':       cookies,
      },
      maxRedirects: 0,
      validateStatus: () => true,
    }
  );

  const lc = extractCookies(loginResp.headers['set-cookie']);
  if (lc) cookies = mergeCookies(cookies, lc);

  if (loginResp.status !== 303 || !(loginResp.headers['location']||'').includes('user'))
    throw new Error('Invalid credentials. Please check your Admission ID and Password.');

  // Follow redirect to establish session
  try {
    const ur = await axios.get(`${BASE}/index.php/user`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookies, 'Referer': `${BASE}/` },
      maxRedirects: 5,
    });
    const uc = extractCookies(ur.headers['set-cookie']);
    if (uc) cookies = mergeCookies(cookies, uc);
  } catch(e) {}

  return cookies;
}

function extractObj(str, key) {
  const start = str.indexOf(key + '=');
  if (start === -1) return null;
  const ob = str.indexOf('{', start);
  if (ob === -1) return null;
  let depth = 0, i = ob;
  for (; i < str.length; i++) {
    if (str[i] === '{') depth++;
    else if (str[i] === '}') { depth--; if (depth === 0) break; }
  }
  return str.slice(ob, i + 1);
}

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { admission_no, password } = req.body;
  if (!admission_no || !password)
    return res.status(400).json({ error: 'Missing credentials' });

  // No logging of admission_no or password for user privacy
  console.log('[LOGIN] attempt received');

  try {
    const cookies = await doLogin(admission_no, password);
    saveSession(admission_no, cookies);

    // Fetch attendance + schedule in parallel for speed
    const [attResp, scheduleData] = await Promise.all([
      axios.get(`${BASE}/admission/view_attendance`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 Chrome/146.0.0.0',
          'Referer':    `${BASE}/admission`,
          'Cookie':     cookies,
        },
        maxRedirects: 5,
      }),
      fetchSchedule(cookies),
    ]);

    const html = attResp.data;
    const ngInitMatch = html.match(/ng-init='([^']+)'/) || html.match(/ng-init="([^"]+)"/);
    if (!ngInitMatch) {
      const $ = cheerio.load(html);
      throw new Error(`Session failed — page: "${$('title').text()}"`);
    }

    const ngInit = ngInitMatch[1];
    let admission = {}, attendanceData = {};
    try { admission      = JSON.parse(extractObj(ngInit, 'admission') || '{}'); }      catch(e) {}
    try { attendanceData = JSON.parse(extractObj(ngInit, 'attendance_data') || '{}'); } catch(e) {}

    if (!attendanceData.total_attendance)
      throw new Error('Attendance data not found.');

    // Fetch today's date-wise
    const today    = new Date();
    const todayERP = fmtDateERP(today);
    const todayRecords = await fetchDatewise(cookies, todayERP);

    console.log('[OK] attendance loaded, schedule:', scheduleData.length, 'items, today:', todayRecords.length, 'records');

    return res.json({
      success: true,
      student: {
        name:         `${admission.first_name||''} ${admission.last_name||''}`.trim() || 'Student',
        admission_no: admission.admission_no || admission_no,
        course:       admission.course_name  || '',
        semester:     admission.semester     || '',
        section:      admission.section      || '',
        photo:        admission.photo ? `${BASE}/${admission.photo}` : null,
      },
      attendance: {
        total:      parseInt(attendanceData.total_attendance)         || 0,
        present:    parseInt(attendanceData.present_attendance)       || 0,
        absent:     parseInt(attendanceData.absent_attendance)        || 0,
        percentage: parseInt(attendanceData.attendance_in_percentage) || 0,
        color:      attendanceData.color       || '#ccc',
        label:      attendanceData.color_data1 || 'Unknown',
      },
      schedule:  scheduleData,
      datewise:  todayRecords,
      fetchedAt: new Date().toISOString(),
    });

  } catch(err) {
    console.error('[ERROR]', err.message);
    return res.status(err.message.includes('Invalid') ? 401 : 500)
              .json({ error: err.message });
  }
});

// ── GET /api/datewise?date=21-02-2026&admission_no=XXX ────────────────────────
app.get('/api/datewise', async (req, res) => {
  const { date, admission_no } = req.query;
  if (!date || !admission_no)
    return res.status(400).json({ error: 'Missing date or admission_no' });

  const cookies = getSession(admission_no);
  if (!cookies)
    return res.status(401).json({ error: 'Session expired. Please login again.' });

  try {
    const records = await fetchDatewise(cookies, date);
    return res.json({ success: true, date, records });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
});

// ── fetchSchedule ─────────────────────────────────────────────────────────────
async function fetchSchedule(cookies) {
  const schedule = [];
  try {
    const resp = await axios.get(`${BASE}/admission/scheduler`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 Chrome/146.0.0.0',
        'Cookie':     cookies,
        'Accept':     'application/json, text/plain, */*',
        'Referer':    `${BASE}/admission`,
      },
      maxRedirects: 5,
    });

    const html = resp.data;
    const ngMatch = html.match(/ng-init='(data=\[[\s\S]*?\])'\s/) ||
                    html.match(/ng-init='(data=\[[\s\S]*?)'/) ||
                    html.match(/ng-init="(data=\[[\s\S]*?)"/) ||
                    html.match(/ng-init='([^']+)'/) ||
                    html.match(/ng-init="([^"]+)"/);

    if (!ngMatch) return schedule;

    const ni = ngMatch[1];
    const dataStart = ni.indexOf('data=[');
    if (dataStart !== -1) {
      const arrStart = ni.indexOf('[', dataStart);
      let depth = 0, i = arrStart;
      for (; i < ni.length; i++) {
        if (ni[i] === '[') depth++;
        else if (ni[i] === ']') { depth--; if (depth === 0) break; }
      }
      try {
        const dataArr = JSON.parse(ni.slice(arrStart, i+1));
        dataArr.forEach(group => {
          if (group.tasks && Array.isArray(group.tasks)) {
            group.tasks.forEach(task => {
              const nameParts = task.name ? task.name.replace(/^\[[^\]]+\]\s*/, '') : '';
              const dashIdx   = nameParts.indexOf(' - ');
              const subject   = dashIdx !== -1 ? nameParts.slice(dashIdx + 3) : nameParts;
              const code      = dashIdx !== -1 ? nameParts.slice(0, dashIdx) : '';
              const fromTime  = task.from ? task.from.slice(11,16) : '';
              const toTime    = task.to   ? task.to.slice(11,16)   : '';
              const timeStr   = fromTime ? `${fromTime} - ${toTime}` : '';
              schedule.push({
                time:        timeStr,
                subject:     subject.trim(),
                code:        code.trim(),
                faculty:     '',
                classNature: task.classNature || '',
                period:      task.period || '',
                status:      'pending',
              });
            });
          }
        });
      } catch(e) {
        console.log('[SCHEDULE] parse error:', e.message);
      }
    }
  } catch(e) {
    console.log('[SCHEDULE ERROR]', e.message);
  }
  return schedule;
}

// ── fetchDatewise ─────────────────────────────────────────────────────────────
async function fetchDatewise(cookies, dateStr) {
  const records = [];
  try {
    const resp = await axios.post(
      `${BASE}/admission/view_schduleAttendence`,
      new URLSearchParams({ selectDate: dateStr }).toString(),
      {
        headers: {
          'Content-Type':     'application/x-www-form-urlencoded',
          'User-Agent':       'Mozilla/5.0 Chrome/146.0.0.0',
          'Cookie':           cookies,
          'Accept':           'application/json, text/plain, */*',
          'Referer':          `${BASE}/admission`,
          'X-Requested-With': 'XMLHttpRequest',
        },
        maxRedirects: 5,
      }
    );

    const data = resp.data;
    if (Array.isArray(data) && data[0] === '1' && Array.isArray(data[1])) {
      data[1].forEach(item => {
        const att = (item.attendence || '').trim();
        let status = 'pending';
        if (att.toLowerCase() === 'present') status = 'present';
        else if (att.toLowerCase() === 'absent') status = 'absent';

        records.push({
          date:      dateStr,
          subject:   item.subject_name  || '',
          code:      item.subject_code  || '',
          faculty:   item.faculty_name  || '',
          room:      item.room_no       || '',
          status,
          attendence: att,
        });
      });
    }
  } catch(e) {
    console.log('[DATEWISE ERROR]', e.message);
  }
  return records;
}

// ── Date format helper ────────────────────────────────────────────────────────
function fmtDateERP(d) {
  const dd   = String(d.getDate()).padStart(2,'0');
  const mm   = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

app.get('/', (req, res) => res.json({ status: 'AttendIQ API ✓', time: new Date().toISOString() }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`\nAttendIQ server running on http://localhost:${PORT}\n`));