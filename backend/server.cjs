// Совместимый с учебным API локальный backend; внешние npm-пакеты не нужны.
// Исходный backend Нетологии: https://github.com/netology-code/ahj-homeworks/tree/AHJ-50/http/helpdesk/backend
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 7070);
const DATA_FILE = path.join(__dirname, 'data', 'tickets.json');
const seed = [
  {name: 'Поменять краску в принтере, ком. 404', description: 'Принтер HP LJ-1210, картриджи на складе', status: false},
  {name: 'Переустановить Windows, PC-Hall24', description: '', status: false},
  {name: 'Установить обновление KB-31642dv3875', description: 'Вышло критическое обновление для Windows', status: false},
];

function readTickets() {
  if (fs.existsSync(DATA_FILE)) return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  return seed.map((item) => ({id: crypto.randomUUID(), ...item, created: Date.now()}));
}
let tickets = readTickets();
function persist() {
  fs.mkdirSync(path.dirname(DATA_FILE), {recursive: true});
  fs.writeFileSync(DATA_FILE, JSON.stringify(tickets, null, 2));
}
function send(res, status, data) {
  res.statusCode = status;
  if (status === 204) return res.end();
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function json(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 100000) {
        reject(new Error('Тело запроса слишком большое'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Некорректный JSON')); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const method = url.searchParams.get('method');
  const id = url.searchParams.get('id');

  try {
    if (req.method === 'GET' && method === 'allTickets') {
      return send(res, 200, tickets.map(({description, ...summary}) => summary));
    }
    if (req.method === 'GET' && method === 'ticketById') {
      const ticket = tickets.find((item) => item.id === id);
      return ticket ? send(res, 200, ticket) : send(res, 404, {message: 'Ticket not found'});
    }
    if (req.method === 'POST' && method === 'createTicket') {
      const input = await json(req);
      if (typeof input.name !== 'string' || !input.name.trim()) return send(res, 400, {message: 'Укажите название'});
      const ticket = {id: crypto.randomUUID(), name: input.name.trim(), description: String(input.description || ''), status: false, created: Date.now()};
      tickets.push(ticket);
      persist();
      return send(res, 200, ticket);
    }
    if (req.method === 'POST' && method === 'updateById') {
      const ticket = tickets.find((item) => item.id === id);
      if (!ticket) return send(res, 404, {message: 'Ticket not found'});
      const input = await json(req);
      if ('name' in input) {
        if (typeof input.name !== 'string' || !input.name.trim()) return send(res, 400, {message: 'Укажите название'});
        ticket.name = input.name.trim();
      }
      if ('description' in input) ticket.description = String(input.description || '');
      if ('status' in input) ticket.status = Boolean(input.status);
      persist();
      return send(res, 200, tickets);
    }
    if (req.method === 'GET' && method === 'deleteById') {
      if (!tickets.some((item) => item.id === id)) return send(res, 404, {message: 'Ticket not found'});
      tickets = tickets.filter((item) => item.id !== id);
      persist();
      return send(res, 204);
    }
    return send(res, 404, {message: 'Unknown method'});
  } catch (error) {
    console.error(error);
    return send(res, 400, {message: error.message});
  }
});
server.listen(PORT, '0.0.0.0', () => console.log(`HelpDesk API: http://localhost:${PORT}`));
