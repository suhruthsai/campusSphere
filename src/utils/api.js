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
  deleteUser:(id)              => request(`/auth/users/${id}`, { method: 'DELETE' }),
};

// ── Buildings ──────────────────────────────────────────────────────────────────
export const buildingsApi = {
  list:   ()   => request('/buildings/'),
  get:    (id) => request(`/buildings/${id}`),
  route:  (fromId, toId, mode = 'walk') =>
    request('/buildings/route?' + new URLSearchParams({ from_id: fromId, to_id: toId, mode })),
};

// ── AI Assistant (Groq is called server-side; the key never reaches the browser) ─
export const aiApi = {
  // messages: [{ role: 'user' | 'assistant', content }], target: null | student persona id
  chat: (messages, target = null) =>
    request('/ai/chat', { method: 'POST', body: JSON.stringify({ messages, target }) }),
};

// ── Events ─────────────────────────────────────────────────────────────────────
export const eventsApi = {
  list:   (params = {}) => request('/events/?' + new URLSearchParams(params)),
  create: (data)        => request('/events/', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data)    => request(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id)          => request(`/events/${id}`, { method: 'DELETE' }),
};

// ── Announcements ──────────────────────────────────────────────────────────────
export const announcementsApi = {
  list:       (params = {}) => request('/announcements/?' + new URLSearchParams(params)),
  create:     (data)        => request('/announcements/', { method: 'POST', body: JSON.stringify(data) }),
  deactivate: (id)          => request(`/announcements/${id}/deactivate`, { method: 'PATCH' }),
  delete:     (id)          => request(`/announcements/${id}`, { method: 'DELETE' }),
};

// ── Attendance ─────────────────────────────────────────────────────────────────
export const attendanceApi = {
  list:    (params = {}) => request('/attendance/?' + new URLSearchParams(params)),
  mark:    (params = {}) => request('/attendance/?' + new URLSearchParams(params), { method: 'POST' }),
  summary: (studentId)   => request(`/attendance/summary/${studentId}`),
};

// ── Media ──────────────────────────────────────────────────────────────────────
export const mediaApi = {
  getBuilding: (buildingId) => request(`/media/${buildingId}`),
  getRoom:     (buildingId, roomLabel) =>
    request(`/media/${buildingId}/${encodeURIComponent(roomLabel)}`),
  delete: (mediaId) => request(`/media/${mediaId}`, { method: 'DELETE' }),
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

export default { authApi, buildingsApi, aiApi, eventsApi, announcementsApi, attendanceApi, mediaApi, classroomsApi, timetableApi, subjectsApi, facultyApi, substitutionsApi };

