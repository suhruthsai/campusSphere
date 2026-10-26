// ── Shared API client — auto-attaches JWT, handles 401 ────────────────────────

// Backend origin. Empty in local dev (Vite proxies /api and /ws to the backend);
// in production set VITE_API_URL, e.g. https://campussphere-backend.onrender.com
export const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE_URL = `${API_ORIGIN}/api/v1`;

/** Absolute WebSocket URL for a backend path like '/ws/telemetry'. */
export function wsUrl(path) {
  if (API_ORIGIN) return API_ORIGIN.replace(/^http/, 'ws') + path;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${path}`;
}

const TOKEN_KEY = 'campussphere_token';
const AUTH_PAGES = ['/login', '/register', '/forgot-password'];

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

  // 401 on any route except login/register means the session is gone
  if (res.status === 401 && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('campussphere_user');
    if (!AUTH_PAGES.includes(window.location.pathname)) {
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
  stats:    ()                 => request('/auth/stats'),
  users:    (params = {})      => request('/auth/users?' + new URLSearchParams(params)),
  getUser:  (id)               => request(`/auth/users/${id}`),
  setStatus:(id, status)       => request(`/auth/users/${id}/status?new_status=${status}`, { method: 'PATCH' }),
  updateUser:(id, data)        => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword:(id)           => request(`/auth/users/${id}/reset-password`, { method: 'POST' }),
  changePassword:(current, next) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: next }) }),
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
};

// ── Announcements ──────────────────────────────────────────────────────────────
export const announcementsApi = {
  list:       (params = {}) => request('/announcements/?' + new URLSearchParams(params)),
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
async function uploadFile(path, file) {
  const fd = new FormData();
  fd.append('file', file);
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

// ── Joining after TGEAPCET counselling, college fees, originals register ──────
const put = (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data || {}) });

export const joiningApi = {
  config:        ()            => request('/joining/config'),
  mine:          ()            => request('/joining/me'),
  start:         ()            => post('/joining/me/start'),
  saveDetails:   (data)        => put('/joining/me', data),
  submit:        ()            => post('/joining/me/submit'),
  removeDoc:     (key)         => request(`/joining/me/documents/${key}`, { method: 'DELETE' }),
  uploadDoc:     (key, file)   => uploadFile(`/joining/me/documents/${key}`, file),
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
  documentFees:  ()            => request('/leaving/admin/document-fees'),
  setDocumentFee:(docType, amount) => put(`/leaving/admin/document-fees/${docType}`, { amount }),
};

