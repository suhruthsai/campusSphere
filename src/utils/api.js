// ── Shared API client — auto-attaches JWT, handles 401 ────────────────────────

// Backend origin. Empty in local dev (Vite proxies /api and /ws to the backend);
// in production set VITE_API_URL, e.g. https://campussphere-backend.onrender.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE_URL = `${API_ORIGIN}/api/v1`;

/** Absolute WebSocket URL for a backend path like '/ws/timetable'. The token is deliberately not in
 *  it: a query string ends up in the server's access log, the proxy's log and the browser's history. */
export function wsUrl(path) {
  if (API_ORIGIN) return API_ORIGIN.replace(/^http/, 'ws') + path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

/** A signed-in WebSocket: connect, then send the token as the first frame (the server allows five
 *  seconds for it). Returns null when nobody is signed in, so callers can skip the socket. */
export function openSocket(path) {
  const token = localStorage.getItem('campussphere_token');
  if (!token) return null;
  const ws = new WebSocket(wsUrl(path));
  ws.addEventListener('open', () => ws.send(JSON.stringify({ token })), { once: true });
  return ws;
}

const TOKEN_KEY = 'campussphere_token';
const AUTH_PAGES = ['/login', '/forgot-password'];

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // 401 with a token on any route except login/register means the session is gone. Without one
  // it's a visitor (the public campus at "/") calling a members-only route: just fail that call.
  if (res.status === 401 && token && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('campussphere_user');
    // On the campus ("/") an expired session simply becomes the guest view, with the Sign in button
    if (!AUTH_PAGES.includes(window.location.pathname) && window.location.pathname !== '/') {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    // FastAPI validation errors return a list of {msg, ...}
    const detail = Array.isArray(err.detail) ? err.detail.map((d) => d.msg).join('; ') : err.detail;
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email, password)  => request('/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data)             => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me:       ()                 => request('/auth/me'),
  /** What I hold beyond my role (HOD of..., Principal, CoE, no-dues desks), for my menus. */
  roles:    ()                 => request('/auth/me/roles'),
  stats:    ()                 => request('/auth/stats'),
  users:    (params = {})      => request('/auth/users?' + new URLSearchParams(params)),
  getUser:  (id)               => request(`/auth/users/${id}`),
  setStatus:(id, status)       => request(`/auth/users/${id}/status?new_status=${status}`, { method: 'PATCH' }),
  updateUser:(id, data)        => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword:(id)           => request(`/auth/users/${id}/reset-password`, { method: 'POST' }),
  /** Changing the password signs out every other device; this browser keeps going on the fresh token it returns. */
  changePassword:(current, next) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }) })
    .then((d) => { if (d?.access_token) localStorage.setItem(TOKEN_KEY, d.access_token); return d; }),
  deleteUser:(id)              => request(`/auth/users/${id}`, { method: 'DELETE' }),
};

// ── Buildings ──────────────────────────────────────────────────────────────────
export const buildingsApi = {
  list:   ()   => request('/buildings/'),
  create: (data)     => request('/buildings/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/buildings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id)       => request(`/buildings/${id}`, { method: 'DELETE' }),
  get:    (id) => request(`/buildings/${id}`),
  route:  (fromId, toId, mode = 'walk') =>
    request('/buildings/route?' + new URLSearchParams({ from_id: fromId, to_id: toId, mode })),
};

// ── Classroom utilization (ML forecast + recommendations) ──────────────────────
export const utilizationApi = {
  model:         ()            => request('/ai/utilization/model'),
  report:        (week = null) => request('/ai/utilization/report' + (week ? `?week=${week}` : '')),
  train:         ()            => request('/ai/utilization/train', { method: 'POST' }),
  recordSession: (data)        => request('/ai/utilization/sessions', { method: 'POST', body: JSON.stringify(data) }),
};

// ── AI Assistant (Groq is called server-side; the key never reaches the browser) ─
export const aiApi = {
  // messages: [{ role: 'user' | 'assistant', content }], target: null | student persona id
  chat: (messages, target = null) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, target }) }),
  /** Mitra's Morning Brief for the signed-in user (built from the timetable and requests, no AI call). */
  brief: () => request('/ai/brief'),
};

// ── Mitra, the walking 3D guide (public: visitors and parents use it without an account) ─
async function guideFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}/ai/guide${path}`, {
    ...options,
    headers: { ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res;
}

export const guideApi = {
  // lang: 'auto' | 'en-IN' | 'hi-IN' | 'te-IN'; at: the place id Mitra is standing at
  chat: (messages, lang, at) => guideFetch('/chat', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, lang, at }),
  }).then((r) => r.json()),
  voice: () => guideFetch('/voice').then((r) => r.json()),
  /** Submit a request Mitra prepared, after the student taps Confirm (signed-in students only). */
  confirm: (token) => request('/ai/guide/confirm', { method: 'POST', body: JSON.stringify({ token }) }),
  speak: (text, lang) => guideFetch('/speak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, lang }),
  }).then((r) => r.blob()),
  listen: (audio, lang = 'unknown') => {
    const fd = new FormData();
    fd.append('file', audio, 'speech.webm');
    return guideFetch(`/listen?lang=${encodeURIComponent(lang)}`, { method: 'POST', body: fd }).then((r) => r.json());
  },
};

// ── Mitra's knowledge base (admin): the crawled college website ─────────────────
export const knowledgeApi = {
  status:    ()            => request('/knowledge/status'),
  refresh:   ()            => request('/knowledge/refresh', { method: 'POST' }),
  search:    (q)           => request('/knowledge/search?' + new URLSearchParams({ q })),
  documents: (params = {}) => request('/knowledge/documents?' + new URLSearchParams(params)),
  remove:    (id)          => request(`/knowledge/documents/${id}`, { method: 'DELETE' }),
  asked:     (unanswered)  => request('/knowledge/asked?' + new URLSearchParams({ unanswered: !!unanswered })),
  questions: ()            => request('/knowledge/questions'),
  upload: async (file, title, link) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', title || '');
    fd.append('link', link || '');
    const res = await fetch(`${BASE_URL}/knowledge/upload`, {
      method: 'POST', headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
    return body;
  },
};

// ── Announcements ──────────────────────────────────────────────────────────────
export const announcementsApi = {
  list:       (params = {}) => request('/announcements/?' + new URLSearchParams(params)),
  mine:       ()            => request('/announcements/mine'),      // notices meant for me
  canPost:    ()            => request('/announcements/can-post'),  // where I may post
  posted:     ()            => request('/announcements/posted'),    // what I posted
  create:     (data)        => request('/announcements/', { method: 'POST', body: JSON.stringify(data) }),
  deactivate: (id)          => request(`/announcements/${id}/deactivate`, { method: 'PATCH' }),
  delete:     (id)          => request(`/announcements/${id}`, { method: 'DELETE' }),
};

// ── Classrooms ─────────────────────────────────────────────────────────────────
export const classroomsApi = {
  list:        (params = {}) => request('/classrooms/?' + new URLSearchParams(params)),
  get:         (id)          => request(`/classrooms/${id}`),
  create:      (data)        => request('/classrooms/', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data)    => request(`/classrooms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:      (id)          => request(`/classrooms/${id}`, { method: 'DELETE' }),
  getCurrent:  (id, atDateTime = null) => {
    const q = atDateTime ? `?at_datetime=${encodeURIComponent(atDateTime)}` : '';
    return request(`/classrooms/${id}/current${q}`);
  },
  getWeek:     (id)          => request(`/classrooms/${id}/week`),
};

// ── Timetable ──────────────────────────────────────────────────────────────────
export const timetableApi = {
  list:        (params = {}) => request('/timetable/?' + new URLSearchParams(params)),
  mine:        ()            => request('/timetable/mine'),
  stats:       ()            => request('/timetable/stats'),
  create:      (data)        => request('/timetable/', { method: 'POST', body: JSON.stringify(data) }),
  update:      (id, data)    => request(`/timetable/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete:      (id)          => request(`/timetable/${id}`, { method: 'DELETE' }),
  getCurrent:  (classroomId, atDateTime = null) => {
    const q = atDateTime ? `?at_datetime=${encodeURIComponent(atDateTime)}` : '';
    return request(`/timetable/classroom/${classroomId}/current${q}`);
  },
  getWeek:     (classroomId) => request(`/timetable/classroom/${classroomId}/week`),
  conflicts:   ()            => request('/timetable/conflicts'),
  getOverrides:(classroomId = null) => {
    const q = classroomId ? `?classroom_id=${encodeURIComponent(classroomId)}` : '';
    return request(`/timetable/overrides${q}`);
  },
  createOverride: (data)     => request('/timetable/overrides', { method: 'POST', body: JSON.stringify(data) }),
  importCsv:   (file, dryRun = false) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('campussphere_token');
    return fetch(`${BASE_URL}/timetable/import/csv?dry_run=${dryRun}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
      return body;
    });
  },
};

// ── Subjects ───────────────────────────────────────────────────────────────────
export const subjectsApi = {
  list:   (params = {}) => request('/subjects/?' + new URLSearchParams(params)),
  create: (data)        => request('/subjects/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)    => request(`/subjects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)          => request(`/subjects/${id}`, { method: 'DELETE' }),
};

// ── Faculty Profiles ───────────────────────────────────────────────────────────
export const facultyApi = {
  list:   (params = {}) => request('/faculty-profiles/?' + new URLSearchParams(params)),
  create: (data)        => request('/faculty-profiles/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)    => request(`/faculty-profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)          => request(`/faculty-profiles/${id}`, { method: 'DELETE' }),
};

// ── Faculty Substitutions ───────────────────────────────────────────────────────
export const substitutionsApi = {
  list:         (params = {}) => request('/substitutions/?' + new URLSearchParams(params)),
  today:        ()            => request('/substitutions/today'),
  get:          (id)          => request(`/substitutions/${id}`),
  checkConflict:(data)        => request('/substitutions/check-conflict', { method: 'POST', body: JSON.stringify(data) }),
  create:       (data)        => request('/substitutions/', { method: 'POST', body: JSON.stringify(data) }),
  update:       (id, data)    => request(`/substitutions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  cancel:       (id, data)    => request(`/substitutions/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),
  auditHistory: (params = {}) => request('/substitutions/history/audit?' + new URLSearchParams(params)),
};

// ── Student Services (bonafide / NOC requests) ────────────────────────────────
const post = (path, data) => request(path, { method: 'POST', body: JSON.stringify(data || {}) });

export const servicesApi = {
  catalog:       ()            => request('/services/catalog'),
  myProfile:     ()            => request('/services/me/profile'),
  saveProfile:   (data)        => request('/services/me/profile', { method: 'PUT', body: JSON.stringify(data) }),
  createRequest: (data)        => post('/services/requests', data),
  myRequests:    ()            => request('/services/requests/mine'),
  getRequest:    (id)          => request(`/services/requests/${id}`),
  cancel:        (id)          => post(`/services/requests/${id}/cancel`),
  approve:       (id, remarks) => post(`/services/requests/${id}/approve`, { remarks }),
  reject:        (id, remarks) => post(`/services/requests/${id}/reject`, { remarks }),
  inbox:         ()            => request('/services/approvals/inbox'),
  history:       ()            => request('/services/approvals/history'),
  verify:        (code)        => request(`/services/verify/${encodeURIComponent(code)}`),
  // Admin setup
  approverUsers:    ()         => request('/services/admin/approvers'),
  assignments:      ()         => request('/services/admin/assignments'),
  assign:           (data)     => post('/services/admin/assignments', data),
  unassign:         (id)       => request(`/services/admin/assignments/${id}`, { method: 'DELETE' }),
  students:         (params = {}) => request('/services/admin/students?' + new URLSearchParams(params)),
  setStudentProfile:(userId, data) => request(`/services/admin/students/${userId}/profile`, { method: 'PUT', body: JSON.stringify(data) }),
  allRequests:      (params = {}) => request('/services/admin/requests?' + new URLSearchParams(params)),
  rollList:         (params = {}) => request('/services/admin/roll-list?' + new URLSearchParams(params)),
  // Exam Cell (Controller of Examinations)
  examQueue:        ()         => request('/services/exam-cell/queue'),
  uploadFinal:      (id, file) => uploadFile(`/services/requests/${id}/final-document`, file),
  dispatch:         (id, tracking) => post(`/services/requests/${id}/dispatch`, { tracking }),

  /** Save the approved PDF (the endpoint needs the login token, so it's fetched as a blob, not linked). */
  downloadPdf: (id, refNo) => requestBlob(`/services/requests/${id}/pdf`)
    .then((blob) => saveBlob(blob, `${(refNo || `document-${id}`).replace(/\//g, '-')}.pdf`)),
};

/** Upload one file (multipart; the browser sets the boundary header). */
async function uploadFile(path, file, fields = {}) {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(fields).forEach(([k, v]) => { if (v) fd.append(k, v); });
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((Array.isArray(err.detail) ? err.detail.map((d) => d.msg).join('; ') : err.detail) || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Fetch an authenticated file as a blob (PDFs, uploaded documents). */
async function requestBlob(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.blob();
}

/** Save a blob as a file. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

// ── Class attendance (marking by period, the 75% / 65% analysis) ──────────────────
export const attendanceApi = {
  rules:       ()                 => request('/attendance/rules'),
  saveRules:   (data)             => request('/attendance/rules', { method: 'PUT', body: JSON.stringify(data) }),
  classes:     (date, scope = 'mine') => request(`/attendance/classes?date=${date}&scope=${scope}`),
  session:     (entryId, date)    => request(`/attendance/session?entry_id=${entryId}&date=${date}`),
  save:        (data)             => request('/attendance/session', { method: 'PUT', body: JSON.stringify(data) }),
  setGroup:    (data)             => request('/attendance/group', { method: 'PUT', body: JSON.stringify(data) }),
  me:          ()                 => request('/attendance/me'),
  mySections:  ()                 => request('/attendance/my-sections'),
  section:     (section)          => request(`/attendance/section?section=${encodeURIComponent(section)}`),
  overview:    ()                 => request('/attendance/overview'),
};

// ── Accreditation Autopilot (admins and the Principal) ─────────────────────────
export const institutionApi = {
  achievements: (f = {}) => request(`/institution/achievements?${new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))}`),
  addAchievement: (data) => request('/institution/achievements', { method: 'POST', body: JSON.stringify(data) }),
  removeAchievement: (id) => request(`/institution/achievements/${id}`, { method: 'DELETE' }),
  stats:      ()         => request('/institution/stats'),
  setStat:    (data)     => request('/institution/stats', { method: 'PUT', body: JSON.stringify(data) }),
  meetings:   (body, year) => request(`/institution/meetings?${new URLSearchParams(Object.fromEntries(Object.entries({ body, year }).filter(([, v]) => v)))}`),
  addMeeting: (data)     => request('/institution/meetings', { method: 'POST', body: JSON.stringify(data) }),
  setDecision: (id, index, status) => request(`/institution/meetings/${id}`, { method: 'PATCH', body: JSON.stringify({ index, status }) }),
};

export const researchApi = {
  access:     ()                        => request('/research/access'),
  faculty:    (prog = 'IT', former = false) => request(`/research/faculty?programme=${prog}&include_former=${former}`),
  saveRecord: (data)                    => request('/research/faculty', { method: 'PUT', body: JSON.stringify(data) }),
  items:      (prog = 'IT', filters = {}) => request(`/research/items?${new URLSearchParams({ programme: prog, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)) })}`),
  mine:       ()                        => request('/research/mine'),
  addItem:    (data)                    => request('/research/items', { method: 'POST', body: JSON.stringify(data) }),
  removeItem: (id)                      => request(`/research/items/${id}`, { method: 'DELETE' }),
  verify:     (id, verified)            => request(`/research/items/${id}/verify`, { method: 'POST', body: JSON.stringify({ verified }) }),
  evidence:   (id, name)                => requestBlob(`/research/items/${id}/evidence`).then((b) => saveBlob(b, name || `evidence-${id}`)),
  upload:     (id, file)                => uploadFile(`/research/items/${id}/evidence`, file),
  activities: (prog = 'IT', year)       => request(`/research/activities?programme=${prog}${year ? `&year=${year}` : ''}`),
  addActivity: (data)                   => request('/research/activities', { method: 'POST', body: JSON.stringify(data) }),
  removeActivity: (id)                  => request(`/research/activities/${id}`, { method: 'DELETE' }),
  summary:    (prog = 'IT')             => request(`/research/summary?programme=${prog}`),
};

export const feedbackApi = {
  access:    ()                 => request('/feedback/access'),
  templates: ()                 => request('/feedback/templates'),
  forms:     (year, programme)  => request(`/feedback/forms?${new URLSearchParams({ ...(year ? { year } : {}), ...(programme ? { programme } : {}) })}`),
  create:    (data)             => request('/feedback/forms', { method: 'POST', body: JSON.stringify(data) }),
  setStatus: (id, status)       => request(`/feedback/forms/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove:    (id)               => request(`/feedback/forms/${id}`, { method: 'DELETE' }),
  mine:      ()                 => request('/feedback/mine'),
  respond:   (id, answers)      => request(`/feedback/forms/${id}/respond`, { method: 'POST', body: JSON.stringify({ answers }) }),
  results:   (id)               => request(`/feedback/forms/${id}/results`),
  saveAtr:   (id, data)         => request(`/feedback/forms/${id}/atr`, { method: 'PUT', body: JSON.stringify(data) }),
  approveAtr: (id, approved)    => request(`/feedback/forms/${id}/atr/approve`, { method: 'POST', body: JSON.stringify({ approved }) }),
  publishAtr: (id, published)   => request(`/feedback/forms/${id}/atr/publish`, { method: 'POST', body: JSON.stringify({ published }) }),
  publicForm: (code)            => request(`/feedback/public/${encodeURIComponent(code)}`),
  publicRespond: (code, role, answers) => request(`/feedback/public/${encodeURIComponent(code)}`, { method: 'POST', body: JSON.stringify({ role, answers }) }),
};

export const resultsApi = {
  overview:    (prog = 'IT') => request(`/results/overview?programme=${prog}`),
  saveSummary: (data)        => request('/results/summaries', { method: 'PUT', body: JSON.stringify(data) }),
  saveBatch:   (data)        => request('/results/batches', { method: 'PUT', body: JSON.stringify(data) }),
};

export const obeApi = {
  access:     (prog = 'IT')          => request(`/obe/access?programme=${prog}`),
  outcomes:   (prog = 'IT')          => request(`/obe/outcomes?programme=${prog}`),
  saveOutcome: (data)                => request('/obe/outcomes', { method: 'PUT', body: JSON.stringify(data) }),
  years:      (prog = 'IT')          => request(`/obe/years?programme=${prog}`),
  courses:    (prog = 'IT', year)    => request(`/obe/courses?programme=${prog}${year ? `&year=${year}` : ''}`),
  course:     (id)                   => request(`/obe/courses/${id}`),
  saveCos:    (id, cos)              => request(`/obe/courses/${id}/cos`, { method: 'PUT', body: JSON.stringify(cos) }),
  saveMapping: (id, cells)           => request(`/obe/courses/${id}/mapping`, { method: 'PUT', body: JSON.stringify(cells) }),
  saveSurvey: (id, rows)             => request(`/obe/courses/${id}/survey`, { method: 'PUT', body: JSON.stringify(rows) }),
  removeAssessment: (id)             => request(`/obe/assessments/${id}`, { method: 'DELETE' }),
  template:   (id, name)             => requestBlob(`/obe/courses/${id}/template`).then((b) => saveBlob(b, name)),
  importSheet: async (id, { name, kind, held_on, file }) => {
    const fd = new FormData();
    fd.append('name', name); fd.append('kind', kind);
    if (held_on) fd.append('held_on', held_on);
    fd.append('file', file);
    const res = await fetch(`${BASE_URL}/obe/courses/${id}/assessments`, {
      method: 'POST', headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((Array.isArray(body.detail) ? body.detail.map((d) => d.msg).join('; ') : body.detail) || `HTTP ${res.status}`);
    return body;
  },
  attainment: (prog = 'IT', year)    => request(`/obe/attainment?programme=${prog}${year ? `&year=${year}` : ''}`),
  saveSettings: (data)               => request('/obe/settings', { method: 'PUT', body: JSON.stringify(data) }),
  actions:    (prog = 'IT')          => request(`/obe/actions?programme=${prog}`),
  addAction:  (data)                 => request('/obe/actions', { method: 'POST', body: JSON.stringify(data) }),
  updateAction: (id, data)           => request(`/obe/actions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const placementsApi = {
  access:   ()                     => request('/placements/access'),
  me:       ()                     => request('/placements/me'),
  register: (id)                   => request(`/placements/drives/${id}/register`, { method: 'POST' }),
  withdraw: (id)                   => request(`/placements/drives/${id}/withdraw`, { method: 'POST' }),
  drives:   (batch)                => request(`/placements/drives${batch ? `?batch=${batch}` : ''}`),
  drive:    (id)                   => request(`/placements/drives/${id}`),
  create:   (data)                 => request('/placements/drives', { method: 'POST', body: JSON.stringify(data) }),
  results:  (id, results, declare) => request(`/placements/drives/${id}/results`, { method: 'PUT', body: JSON.stringify({ results, declare }) }),
  report:   (dept = 'IT', batch)   => request(`/placements/report?department=${encodeURIComponent(dept)}${batch ? `&batch=${batch}` : ''}`),
};

export const reportsApi = {
  departments: ()             => request('/reports/departments'),
  department:  (dept = 'IT')  => request(`/reports/department?department=${encodeURIComponent(dept)}`),
};

export const accreditationApi = {
  access:   ()                   => request('/accreditation/access'),
  // scope: 'both' (the Civil & IT Block pilot) | 'civil' | 'it'; NBA needs 'civil' or 'it'
  report:   (framework = 'naac', scope = 'both') => request(`/accreditation/report?framework=${framework}&scope=${scope}`),
  desks:    (scope = 'both')     => request(`/accreditation/desks?scope=${scope}`),
  evidencePack: (framework = 'naac', scope = 'both') => requestBlob(`/accreditation/report.pdf?framework=${framework}&scope=${scope}`)
    .then((b) => saveBlob(b, `MVSR-${framework.toUpperCase()}-${scope === 'both' ? 'Civil-IT' : scope === 'it' ? 'IT' : 'Civil'}-evidence-pack.pdf`)),
  // Workspace: yearly values, evidence, team, college facts
  wsAccess:  ()                                => request('/accreditation/workspace/access'),
  wsGrid:    (framework, programme = '')       => request(`/accreditation/workspace?framework=${framework}&programme=${encodeURIComponent(programme)}`),
  wsMetric:  (framework, code, programme = '') => request(`/accreditation/workspace/metric?framework=${framework}&code=${encodeURIComponent(code)}&programme=${encodeURIComponent(programme)}`),
  wsValue:   (data)                            => request('/accreditation/workspace/value', { method: 'PUT', body: JSON.stringify(data) }),
  wsLock:    (data)                            => request('/accreditation/workspace/lock', { method: 'POST', body: JSON.stringify(data) }),
  wsSnapshot: (framework, programme = '')      => request(`/accreditation/workspace/snapshot?framework=${framework}&programme=${encodeURIComponent(programme)}`, { method: 'POST' }),
  wsLink:    (data)                            => request('/accreditation/workspace/evidence/link', { method: 'POST', body: JSON.stringify(data) }),
  wsRemoveEvidence: (id)                       => request(`/accreditation/workspace/evidence/${id}`, { method: 'DELETE' }),
  wsEvidenceFile: (id, name)                   => requestBlob(`/accreditation/workspace/evidence/${id}/file`).then((b) => saveBlob(b, name || `evidence-${id}`)),
  wsUpload: async ({ framework, code, programme = '', year, title, signed = false, file }) => {
    const fd = new FormData();
    Object.entries({ framework, code, programme, year, title, signed }).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append('file', file);
    const res = await fetch(`${BASE_URL}/accreditation/workspace/evidence`, {
      method: 'POST', headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body: fd,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((Array.isArray(body.detail) ? body.detail.map((d) => d.msg).join('; ') : body.detail) || `HTTP ${res.status}`);
    return body;
  },
  wsTeam:    ()                                => request('/accreditation/workspace/team'),
  wsPeople:  ()                                => request('/accreditation/workspace/people'),
  wsTeamAdd: (data)                            => request('/accreditation/workspace/team', { method: 'POST', body: JSON.stringify(data) }),
  wsTeamRemove: (id)                           => request(`/accreditation/workspace/team/${id}`, { method: 'DELETE' }),
  wsFacts:   ()                                => request('/accreditation/workspace/facts'),
  wsFactSet: (data)                            => request('/accreditation/workspace/facts', { method: 'PUT', body: JSON.stringify(data) }),
  readiness: (framework, programme = '')       => request(`/accreditation/readiness?framework=${framework}&programme=${programme}`),
  exportWorkbook: (framework, programme = '')  => requestBlob(`/accreditation/export/workbook?framework=${framework}&programme=${programme}`)
    .then((b) => saveBlob(b, `MVSR-${framework.toUpperCase()}${programme ? '-' + programme : ''}-data.xlsx`)),
  exportEvidence: (framework, programme = '')  => requestBlob(`/accreditation/export/evidence.zip?framework=${framework}&programme=${programme}`)
    .then((b) => saveBlob(b, `MVSR-${framework.toUpperCase()}-evidence.zip`)),
  mockVisit: (programme = 'IT')                => request(`/accreditation/mock-visit?programme=${programme}`),
};

// ── Joining after TGEAPCET counselling, college fees, originals register ──────
const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data || {}) });

export const joiningApi = {
  config:        ()            => request('/joining/config'),
  mine:          ()            => request('/joining/me'),
  start:         ()            => post('/joining/me/start'),
  saveDetails:   (data)        => put('/joining/me', data),
  submit:        ()            => post('/joining/me/submit'),
  removeDoc:     (key)         => request(`/joining/me/documents/${key}`, { method: 'DELETE' }),
  uploadDoc:     (key, file, issuedOn) => uploadFile(`/joining/me/documents/${key}`, file, { issued_on: issuedOn }),
  docBlob:       (docId)       => requestBlob(`/joining/documents/${docId}/file`),
  createPayment: (data)        => post('/joining/me/payments', data),
  completeTest:  (id, outcome) => post(`/joining/me/payments/${id}/test-complete`, { outcome }),
  receipt:       (id, receiptNo) => requestBlob(`/joining/payments/${id}/receipt`).then((b) => saveBlob(b, `${receiptNo.replace(/\//g, '-')}.pdf`)),
  acknowledgement: (ackNo)     => requestBlob(`/joining/acknowledgement?ack_no=${encodeURIComponent(ackNo)}`).then((b) => saveBlob(b, `${ackNo.replace(/\//g, '-')}.pdf`)),
  // Admin Office
  applications:  (params = {}) => request('/joining/office/applications?' + new URLSearchParams(params)),
  application:   (id)          => request(`/joining/office/applications/${id}`),
  review:        (docId, status, remarks) => post(`/joining/office/documents/${docId}/review`, { status, remarks }),
  verify:        (id)          => post(`/joining/office/applications/${id}/verify`),
  sendBack:      (id, remarks) => post(`/joining/office/applications/${id}/return`, { remarks }),
  receiveOriginals: (id, docKeys) => post(`/joining/office/applications/${id}/originals`, { doc_keys: docKeys }),
  enroll:        (id, data)    => post(`/joining/office/applications/${id}/enroll`, data),
  mentors:       ()            => request('/joining/office/mentors'),
  originals:     (params = {}) => request('/joining/office/originals?' + new URLSearchParams(params)),
  lend:          (id, dueBack, note) => post(`/joining/office/originals/${id}/lend`, { due_back: dueBack, note }),
  redeposit:     (id, note)    => post(`/joining/office/originals/${id}/redeposit`, { note }),
  returnOriginal:(id, note)    => post(`/joining/office/originals/${id}/return`, { note }),
  recordCopies:  (docId, n)    => post(`/joining/office/documents/${docId}/copies`, { copies_received: n }),
  // Admin: which documents joinees must give
  docRules:      ()            => request('/joining/admin/doc-rules'),
  addDocRule:    (data)        => post('/joining/admin/doc-rules', data),
  saveDocRule:   (id, data)    => put(`/joining/admin/doc-rules/${id}`, data),
  // Admin fee settings
  feeHeads:      ()            => request('/joining/admin/fee-heads'),
  addFeeHead:    (data)        => post('/joining/admin/fee-heads', data),
  saveFeeHead:   (id, data)    => put(`/joining/admin/fee-heads/${id}`, data),
};

// ── Leaving the college: no-dues clearance, dues and document-fee payments ────
export const leavingApi = {
  config:        ()            => request('/leaving/config'),
  mine:          ()            => request('/leaving/me'),
  start:         (data)        => post('/leaving/me/start', data),
  payDues:       (itemId)      => post(`/leaving/me/items/${itemId}/pay`),
  /** TEST MODE: finish a dues or document-fee payment. */
  completeTest:  (id, outcome) => post(`/leaving/payments/${id}/test-complete`, { outcome }),
  receipt:       (id, receiptNo) => requestBlob(`/leaving/payments/${id}/receipt`).then((b) => saveBlob(b, `${receiptNo.replace(/\//g, '-')}.pdf`)),
  noDuesCertificate: ()        => requestBlob('/leaving/me/no-dues-certificate').then((b) => saveBlob(b, 'No-Dues-Certificate.pdf')),
  // Clearance officers
  queue:         (status = 'pending') => request(`/leaving/clearance/queue?status=${encodeURIComponent(status)}`),
  clear:         (itemId, remarks) => post(`/leaving/clearance/items/${itemId}/clear`, { remarks }),
  recordDues:    (itemId, amount, remarks) => post(`/leaving/clearance/items/${itemId}/dues`, { amount, remarks }),
  // Admin
  officers:      ()            => request('/leaving/admin/officers'),
  addOfficer:    (data)        => post('/leaving/admin/officers', data),
  removeOfficer: (id)          => request(`/leaving/admin/officers/${id}`, { method: 'DELETE' }),
  // What I get from the college when I leave
  checklist:     ()            => request('/leaving/me/checklist'),
  documentFees:  ()            => request('/leaving/admin/document-fees'),
  setDocumentFee:(docType, amount) => put(`/leaving/admin/document-fees/${docType}`, { amount }),
};


// ── CampusLocker: my documents, share links, the access log ──────────────────────
const lockerForm = async (path, fields, file) => {
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v ?? ''));
  fd.append('file', file);
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {}, body: fd });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || `HTTP ${res.status}`);
  return body;
};

export const lockerApi = {
  mine:       ()                       => request('/locker/'),
  upload:     (file, title, category)  => lockerForm('/locker/files', { title, category }, file),
  remove:     (id)                     => request(`/locker/files/${id}`, { method: 'DELETE' }),
  blob:       (ref)                    => requestBlob(`/locker/items/${encodeURIComponent(ref)}/file`),
  share:      (ref, hours)             => post(`/locker/items/${encodeURIComponent(ref)}/share`, { hours }),
  shares:     ()                       => request('/locker/shares'),
  revoke:     (id)                     => request(`/locker/shares/${id}`, { method: 'DELETE' }),
  activity:   ()                       => request('/locker/activity'),
  lookup:     (rollNo)                 => request('/locker/office/lookup?' + new URLSearchParams({ roll_no: rollNo })),
  officeAdd:  (rollNo, file, title, category) => lockerForm('/locker/office/files', { roll_no: rollNo, title, category }, file),
  sharedInfo: (token)                  => request(`/locker/shared/${token}`),
  sharedBlob: (token)                  => requestBlob(`/locker/shared/${token}/file`),
  college:        ()                   => request('/locker/college'),
  collegeBlob:    (id)                 => requestBlob(`/locker/college/${id}/file`),
  collegeRefresh: ()                   => post('/locker/college/refresh'),
};
