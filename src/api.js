const STORAGE_KEY = 'helpdesk.api.url';
const LOCAL_DEFAULT = 'http://localhost:7070';

export function getApiUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) return stored;
  const fromBuild = process.env.API_URL;
  if (fromBuild) return fromBuild;
  return ['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? LOCAL_DEFAULT
    : '';
}

export function setApiUrl(value) {
  const trimmed = value.trim();
  if (trimmed && !/^https?:\/\//i.test(trimmed)) {
    throw new Error('Введите полный адрес с http:// или https://');
  }
  if (trimmed) {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) throw new Error('Не указывайте логин и пароль в URL');
  }
  localStorage.setItem(STORAGE_KEY, trimmed.replace(/\/+$/, ''));
}

async function request(method, { id, body } = {}) {
  const base = getApiUrl();
  if (!base) throw new Error('Сначала укажите адрес сервера в настройках API.');

  let url;
  try {
    url = new URL(base);
    url.searchParams.set('method', method);
    if (id !== undefined) url.searchParams.set('id', String(id));
  } catch {
    throw new Error('Некорректный адрес API. Проверьте настройки.');
  }

  let response;
  try {
    response = await fetch(url.toString(), {
      method: body === undefined ? 'GET' : 'POST',
      ...(body === undefined ? {} : {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
  } catch {
    throw new Error('Не удалось подключиться к серверу. Проверьте URL, запуск backend и CORS.');
  }

  if (!response.ok) {
    let message = `Ошибка сервера: HTTP ${response.status}`;
    try {
      const details = await response.json();
      if (details.message || details.error) message += ` — ${details.message || details.error}`;
    } catch { /* тело ответа может быть пустым */ }
    throw new Error(message);
  }
  // Удаление возвращает 204 — тело ответа отсутствует.
  if (response.status === 204) return null;
  const raw = await response.text();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Сервер вернул некорректный JSON.');
  }
}

export const api = {
  allTickets: () => request('allTickets'),
  ticketById: (id) => request('ticketById', { id }),
  createTicket: (ticket) => request('createTicket', { body: ticket }),
  updateById: (id, changes) => request('updateById', { id, body: changes }),
  deleteById: (id) => request('deleteById', { id }),
};
