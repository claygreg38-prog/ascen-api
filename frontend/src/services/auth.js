import api from './api';

export async function loginWithPin(participantId, pin) {
  const { data } = await api.post('/api/auth/login/facility', { participant_id: participantId, pin });
  localStorage.setItem('ascen_jwt', data.token || data.jwt);
  if (data.refreshToken) localStorage.setItem('ascen_refresh', data.refreshToken);
  localStorage.setItem('ascen_user', JSON.stringify(data.user));
  return data;
}

export async function registerWithCode(code, pin, firstName) {
  const { data } = await api.post('/api/auth/register/facility', { code, pin, first_name: firstName });
  localStorage.setItem('ascen_jwt', data.token || data.jwt);
  if (data.refreshToken) localStorage.setItem('ascen_refresh', data.refreshToken);
  localStorage.setItem('ascen_user', JSON.stringify(data.user));
  return data;
}

export function getUser() {
  try { return JSON.parse(localStorage.getItem('ascen_user')); } catch { return null; }
}

export function isAuthenticated() { return !!localStorage.getItem('ascen_jwt'); }

export function logout() { localStorage.clear(); window.location.href = '/app/login'; }
