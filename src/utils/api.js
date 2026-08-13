// ── Shared API client — auto-attaches JWT, handles 401 ────────────────────────
const BASE_URL = '/api/v1';
const TOKEN_KEY = 'campussphere_token';

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

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('campussphere_user');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(err.detail || `HTTP ${res.status}`);
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
  importCsv:   (file, dryRun = false) => {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('campussphere_token');
    return fetch(`/api/v1/timetable/import/csv?dry_run=${dryRun}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    }).then(r => r.json());
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

export default { authApi, buildingsApi, eventsApi, announcementsApi, attendanceApi, mediaApi, classroomsApi, timetableApi, subjectsApi, facultyApi };
