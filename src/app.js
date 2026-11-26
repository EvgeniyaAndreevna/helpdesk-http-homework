import './styles.css';
import logo from './assets/logo.svg';
import { api, getApiUrl, setApiUrl } from './api.js';

const root = document.querySelector('#app');
root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand"><img src="${logo}" alt="" width="42" height="42" />
        <div><div class="brand-name">HelpDesk</div><div class="brand-subtitle">Сервис управления заявками</div></div>
      </div>
      <button class="api-button" id="api-settings" type="button" title="Настройки подключения">
        <span class="api-dot" id="api-dot"></span><span id="api-status">Подключение к API</span>
        <span class="gear" aria-hidden="true">⚙</span>
      </button>
    </header>
    <main class="main">
      <section class="welcome">
        <div><span class="eyebrow">РАБОЧЕЕ ПРОСТРАНСТВО</span>
          <h1>Управление заявками</h1>
          <p>Создавайте обращения, отслеживайте выполнение и редактируйте задачи.</p>
        </div>
        <div class="metrics" aria-label="Статистика">
          <div class="metric"><span class="metric-value" id="total-count">—</span><span class="metric-name">Всего</span></div>
          <div class="metric"><span class="metric-value" id="active-count">—</span><span class="metric-name">В работе</span></div>
          <div class="metric"><span class="metric-value" id="done-count">—</span><span class="metric-name">Готово</span></div>
        </div>
      </section>
      <section class="panel" aria-label="Заявки">
        <div class="panel-header">
          <div><h2>Список заявок</h2><p id="list-caption">Данные загружаются с сервера</p></div>
          <div class="panel-actions">
            <button type="button" class="btn btn-quiet" id="refresh-button" title="Обновить список">↻ <span>Обновить</span></button>
            <button type="button" class="btn btn-primary" id="add-button"><span aria-hidden="true">＋</span> Добавить тикет</button>
          </div>
        </div>
        <div id="feedback" class="feedback" role="alert" hidden></div>
        <div class="ticket-heading" aria-hidden="true">
          <span>Статус</span><span>Заявка</span><span>Создана</span><span>Действия</span>
        </div>
        <div id="tickets" class="tickets" aria-live="polite"></div>
      </section>
      <footer class="footer">HelpDesk · HTTP / Fetch API · Данные хранятся на сервере</footer>
    </main>
  </div>
  <div id="modal-root"></div>
  <div id="toast" class="toast" role="status" aria-live="polite" hidden></div>
`;

const el = (sel) => root.querySelector(sel);
const list = el('#tickets');
const feedback = el('#feedback');
const modalRoot = el('#modal-root');
const expanded = new Set();
const descriptions = new Map();
let tickets = [];
let pending = false;
let reloadCounter = 0;
let activeModal = null;
let toastTimer;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function btn(className, text, label, onClick) {
  const button = node('button', className, text);
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.addEventListener('click', onClick);
  return button;
}

function dateLabel(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function showToast(message, error = false) {
  const toast = el('#toast');
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle('toast-error', error);
  toast.hidden = false;
  toastTimer = window.setTimeout(() => { toast.hidden = true; }, 4300);
}

function updateStatus(connected = null) {
  const dot = el('#api-dot');
  const label = el('#api-status');
  dot.classList.toggle('online', connected === true);
  dot.classList.toggle('offline', connected === false);
  label.textContent = connected === true ? 'API подключён' : connected === false ? 'API недоступен' : 'Настройки API';
}

function renderCounters() {
  el('#total-count').textContent = String(tickets.length);
  el('#active-count').textContent = String(tickets.filter((ticket) => !ticket.status).length);
  el('#done-count').textContent = String(tickets.filter((ticket) => ticket.status).length);
  el('#list-caption').textContent = `${tickets.length} ${plural(tickets.length, ['заявка', 'заявки', 'заявок'])} в системе`;
}

function plural(value, words) {
  const n = value % 100;
  if (n >= 11 && n <= 14) return words[2];
  const d = n % 10;
  return d === 1 ? words[0] : d >= 2 && d <= 4 ? words[1] : words[2];
}

function render() {
  renderCounters();
  list.replaceChildren();
  if (!tickets.length) {
    const empty = node('div', 'empty');
    empty.append(node('div', 'empty-icon', '◻'), node('strong', '', 'Заявок пока нет'),
      node('p', '', 'Нажмите «Добавить тикет», чтобы создать первую заявку.'));
    list.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  tickets.forEach((ticket) => {
    const container = node('article', `ticket ${ticket.status ? 'ticket-done' : ''}`);
    const row = node('div', 'ticket-row');
    const checkbox = btn(`check ${ticket.status ? 'checked' : ''}`,
      ticket.status ? '✓' : '',
      ticket.status ? 'Отметить как невыполненную' : 'Отметить как выполненную',
      () => toggleStatus(ticket));
    checkbox.setAttribute('aria-pressed', String(Boolean(ticket.status)));
    checkbox.disabled = pending;
    const status = node('div', 'ticket-check');
    status.append(checkbox);

    const title = btn('ticket-title', ticket.name || '(без названия)', 'Показать подробности заявки', () => toggleDetails(ticket.id));
    title.setAttribute('aria-expanded', String(expanded.has(ticket.id)));
    const titleWrap = node('div', 'ticket-name');
    titleWrap.append(title, node('span', 'ticket-state', ticket.status ? 'Выполнено' : 'В работе'));

    const created = node('time', 'ticket-date', dateLabel(ticket.created));
    const actions = node('div', 'ticket-actions');
    const edit = btn('icon-button', '✎', 'Редактировать заявку', () => showForm('edit', ticket.id));
    const remove = btn('icon-button danger-button', '×', 'Удалить заявку', () => showDelete(ticket));
    edit.disabled = pending;
    remove.disabled = pending;
    actions.append(edit, remove);
    row.append(status, titleWrap, created, actions);
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      toggleDetails(ticket.id);
    });
    container.append(row);

    if (expanded.has(ticket.id)) {
      const description = node('div', 'ticket-description');
      const details = descriptions.get(ticket.id);
      description.append(node('span', 'description-label', 'ПОЛНОЕ ОПИСАНИЕ'));
      const content = node('div', 'description-text',
        !details || details.loading ? 'Загрузка описания…' : details.error ? details.error : details.value || 'Описание отсутствует');
      if (details?.error) content.classList.add('text-error');
      description.append(content);
      container.append(description);
    }
    fragment.append(container);
  });
  list.append(fragment);
}

function setBusy(value) {
  pending = value;
  el('#refresh-button').disabled = value;
  el('#add-button').disabled = value;
  list.classList.toggle('busy', value);
  render();
}

function setFeedback(message) {
  feedback.textContent = message;
  feedback.hidden = !message;
}

async function refresh() {
  const thisReload = ++reloadCounter;
  setBusy(true);
  setFeedback('');
  try {
    const data = await api.allTickets();
    if (thisReload !== reloadCounter) return;
    if (!Array.isArray(data)) throw new Error('Сервер вернул не список заявок.');
    tickets = data;
    updateStatus(true);
    render();
  } catch (error) {
    if (thisReload !== reloadCounter) return;
    updateStatus(false);
    setFeedback(error.message);
  } finally {
    if (thisReload === reloadCounter) setBusy(false);
  }
}

async function toggleDetails(id) {
  if (expanded.has(id)) {
    expanded.delete(id);
    render();
    return;
  }
  expanded.add(id);
  descriptions.set(id, {loading: true});
  render();
  try {
    // Описание специально запрашивается отдельно от общего списка.
    const ticket = await api.ticketById(id);
    descriptions.set(id, {value: ticket.description || ''});
  } catch (error) {
    descriptions.set(id, {error: error.message});
  }
  render();
}

async function toggleStatus(ticket) {
  if (pending) return;
  setBusy(true);
  try {
    await api.updateById(ticket.id, {status: !ticket.status});
    showToast('Статус заявки обновлён');
    await refresh();
  } catch (error) {
    showToast(error.message, true);
  } finally {
    if (pending) setBusy(false);
  }
}

function showModal(title, content) {
  closeModal();
  const overlay = node('div', 'modal-backdrop');
  const dialog = node('section', 'modal');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', title);
  const header = node('div', 'modal-header');
  header.append(node('h2', '', title), btn('modal-close', '×', 'Закрыть окно', closeModal));
  dialog.append(header, content);
  overlay.append(dialog);
  overlay.addEventListener('mousedown', (event) => {
    if (event.target === overlay) closeModal();
  });
  modalRoot.append(overlay);
  activeModal = overlay;
  document.body.classList.add('has-modal');
  dialog.querySelector('input, textarea, button')?.focus();
}

function closeModal() {
  if (activeModal) activeModal.remove();
  activeModal = null;
  document.body.classList.remove('has-modal');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && activeModal) closeModal();
});

async function showForm(mode, id = null) {
  const isEdit = mode === 'edit';
  const title = isEdit ? 'Редактирование тикета' : 'Добавление тикета';
  const body = node('div', 'modal-body');
  if (isEdit) body.append(node('p', 'modal-loading', 'Загружаем данные заявки…'));
  showModal(title, body);
  const currentModal = activeModal;
  let original = null;
  if (isEdit) {
    try {
      original = await api.ticketById(id);
    } catch (error) {
      if (activeModal === currentModal) body.replaceChildren(node('p', 'text-error', error.message));
      return;
    }
  }
  if (activeModal !== currentModal) return;

  const form = node('form', 'ticket-form');
  form.innerHTML = `
    <label class="field"><span>Краткое описание <em>*</em></span>
      <input name="name" maxlength="200" required placeholder="Например, настроить принтер" autocomplete="off" /></label>
    <label class="field"><span>Подробное описание</span>
      <textarea name="description" rows="5" placeholder="Опишите заявку подробнее…"></textarea></label>
    <p class="modal-error" role="alert" hidden></p>
    <div class="modal-footer"><button type="button" class="btn btn-quiet cancel">Отмена</button>
      <button type="submit" class="btn btn-primary save">${isEdit ? 'Сохранить' : 'Добавить'}</button></div>`;
  const name = form.elements.namedItem('name');
  const description = form.elements.namedItem('description');
  name.value = original?.name || '';
  description.value = original?.description || '';
  form.querySelector('.cancel').addEventListener('click', closeModal);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = name.value.trim();
    const errorEl = form.querySelector('.modal-error');
    errorEl.hidden = true;
    if (!value) {
      errorEl.textContent = 'Введите краткое описание заявки.';
      errorEl.hidden = false;
      name.focus();
      return;
    }
    const submit = form.querySelector('.save');
    submit.disabled = true;
    submit.textContent = 'Сохранение…';
    try {
      const payload = {name: value, description: description.value.trim(), status: Boolean(original?.status)};
      if (isEdit) {
        await api.updateById(id, payload);
        descriptions.delete(id);
        expanded.delete(id);
      } else {
        await api.createTicket(payload);
      }
      if (activeModal === currentModal) closeModal();
      showToast(isEdit ? 'Заявка сохранена' : 'Заявка создана');
      await refresh();
    } catch (error) {
      errorEl.textContent = error.message;
      errorEl.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = isEdit ? 'Сохранить' : 'Добавить';
    }
  });
  body.replaceChildren(form);
  name.focus();
}

function showDelete(ticket) {
  const body = node('div', 'modal-body');
  body.append(node('p', 'delete-question', 'Вы действительно хотите удалить тикет?'));
  body.append(node('p', 'delete-name', ticket.name));
  body.append(node('p', 'delete-hint', 'Это действие нельзя отменить.'));
  const error = node('p', 'modal-error');
  error.hidden = true;
  body.append(error);
  const footer = node('div', 'modal-footer');
  const cancel = btn('btn btn-quiet', 'Отмена', 'Отмена', closeModal);
  const confirm = btn('btn btn-danger', 'Удалить', 'Подтвердить удаление', async () => {
    confirm.disabled = true;
    confirm.textContent = 'Удаление…';
    error.hidden = true;
    try {
      await api.deleteById(ticket.id);
      expanded.delete(ticket.id);
      descriptions.delete(ticket.id);
      closeModal();
      showToast('Заявка удалена');
      await refresh();
    } catch (caught) {
      error.textContent = caught.message;
      error.hidden = false;
    } finally {
      confirm.disabled = false;
      confirm.textContent = 'Удалить';
    }
  });
  footer.append(cancel, confirm);
  body.append(footer);
  showModal('Удаление тикета', body);
}

function showSettings() {
  const body = node('div', 'modal-body');
  const form = node('form', 'ticket-form');
  form.innerHTML = `
    <p class="settings-intro">Укажите публичный HTTPS-адрес backend или локальный адрес сервера. Сами заявки в браузере не сохраняются.</p>
    <label class="field"><span>Адрес API</span>
      <input name="url" type="url" placeholder="https://your-backend.example.com/" /></label>
    <p class="settings-note">Локально по умолчанию: http://localhost:7070. На GitHub Pages сервер размещается отдельно.</p>
    <p class="modal-error" role="alert" hidden></p>
    <div class="modal-footer"><button type="button" class="btn btn-quiet cancel">Отмена</button>
      <button type="submit" class="btn btn-primary">Сохранить и подключиться</button></div>`;
  const url = form.elements.namedItem('url');
  url.value = getApiUrl();
  form.querySelector('.cancel').addEventListener('click', closeModal);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      setApiUrl(url.value);
      closeModal();
      refresh();
    } catch (error) {
      const message = form.querySelector('.modal-error');
      message.textContent = error.message;
      message.hidden = false;
    }
  });
  body.append(form);
  showModal('Подключение к серверу', body);
  url.focus();
}

el('#api-settings').addEventListener('click', showSettings);
el('#add-button').addEventListener('click', () => showForm('create'));
el('#refresh-button').addEventListener('click', refresh);
updateStatus();
refresh();
