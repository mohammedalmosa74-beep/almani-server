const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DB_FILE = path.join(__dirname, 'data', 'db.json');

app.set('trust proxy', 1);
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

let memDB = { products: [], orders: [], categories: [], settings: {} };
let memMode = false;

function readDB() {
  if (memMode) return JSON.parse(JSON.stringify(memDB));
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { products: [], orders: [], categories: [], settings: {} }; }
}
function writeDB(d) {
  if (memMode) { memDB = JSON.parse(JSON.stringify(d)); return; }
  try { fs.writeFileSync(DB_FILE, JSON.stringify(d, null, 2)); }
  catch { memMode = true; memDB = JSON.parse(JSON.stringify(d)); }
}
function jGet(t) { const d = readDB(); return d[t] || []; }
function jOne(t, f, v) { return jGet(t).find(r => r[f] === v) || null; }
function jAdd(t, item) { const d = readDB(); if (!d[t]) d[t] = []; d[t].push(item); writeDB(d); return item; }
function jUpd(t, f, v, u) { const d = readDB(); const i = (d[t]||[]).findIndex(r => r[f] === v); if (i===-1) return null; Object.assign(d[t][i], u); writeDB(d); return d[t][i]; }
function jDel(t, f, v) { const d = readDB(); const i = (d[t]||[]).findIndex(r => r[f] === v); if (i===-1) return null; const r = d[t].splice(i,1)[0]; writeDB(d); return r; }

const io = new Server(server, { cors: { origin: '*', methods: ['GET','POST'] } });
io.on('connection', (socket) => {
  socket.on('join', (role) => socket.join(role));
});

function sanitize(str) { if (typeof str !== 'string') return ''; return str.trim().replace(/[\x00-\x1F]/g, '').slice(0, 500); }
function validateId(id) { const n = parseInt(id); return Number.isFinite(n) && n > 0 ? n : null; }
function ok(res, data) { res.json({ success: true, data }); }
function fail(res, msg, code) { res.status(code || 500).json({ success: false, error: msg }); }

// Products
app.get('/api/products', (req, res) => {
  try {
    let r = jGet('products');
    if (req.query.active === 'true') r = r.filter(p => p.active);
    if (req.query.active === 'false') r = r.filter(p => !p.active);
    if (req.query.cat) r = r.filter(p => p.cat === req.query.cat);
    if (req.query.search) { const s = req.query.search.toLowerCase(); r = r.filter(p => p.name.toLowerCase().includes(s) || (p.sub||'').toLowerCase().includes(s)); }
    ok(res, r);
  } catch (e) { fail(res, e.message); }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const id = validateId(req.params.id);
    if (!id) return fail(res, 'معرف غير صالح', 400);
    const p = jOne('products', 'id', id);
    if (!p) return fail(res, 'المنتج غير موجود', 404);
    ok(res, p);
  } catch (e) { fail(res, e.message); }
});

app.post('/api/products', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const name = sanitize(req.body.name), price = parseFloat(req.body.price), cat = sanitize(req.body.cat);
    if (!name || name.length < 2) return fail(res, 'الاسم يجب أن يكون 2 أحرف على الأقل', 400);
    if (!price || price < 1) return fail(res, 'سعر غير صالح', 400);
    if (!cat) return fail(res, 'القسم مطلوب', 400);
    const prod = { name, sub: sanitize(req.body.sub||''), price: Math.min(Math.max(price,1),999999999), cat, unit: sanitize(req.body.unit||'قطعة'), badge: sanitize(req.body.badge||''), discount: Math.min(Math.max(parseFloat(req.body.discount)||0,0),99), active: true, image: typeof req.body.image==='string' ? req.body.image.slice(0,5000) : '' };
    prod.id = Date.now();
    const p = jAdd('products', prod);
    io.emit('products:updated', { action: 'create', product: p });
    ok(res, p);
  } catch (e) { fail(res, e.message); }
});

app.put('/api/products/:id', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const id = validateId(req.params.id);
    if (!id) return fail(res, 'معرف غير صالح', 400);
    const u = {};
    if (req.body.name !== undefined) u.name = sanitize(req.body.name);
    if (req.body.sub !== undefined) u.sub = sanitize(req.body.sub);
    if (req.body.price !== undefined) u.price = Math.min(Math.max(parseFloat(req.body.price)||0,1),999999999);
    if (req.body.cat !== undefined) u.cat = sanitize(req.body.cat);
    if (req.body.unit !== undefined) u.unit = sanitize(req.body.unit);
    if (req.body.badge !== undefined) u.badge = sanitize(req.body.badge);
    if (req.body.active !== undefined) u.active = req.body.active === 'true' || req.body.active === true;
    if (req.body.discount !== undefined) u.discount = Math.min(Math.max(parseFloat(req.body.discount)||0,0),99);
    if (req.body.image !== undefined) u.image = typeof req.body.image==='string' ? req.body.image.slice(0,5000) : '';
    const p = jUpd('products', 'id', id, u);
    if (!p) return fail(res, 'المنتج غير موجود', 404);
    io.emit('products:updated', { action: 'update', product: p });
    ok(res, p);
  } catch (e) { fail(res, e.message); }
});

app.delete('/api/products/:id', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const id = validateId(req.params.id);
    if (!id) return fail(res, 'معرف غير صالح', 400);
    const p = jDel('products', 'id', id);
    if (!p) return fail(res, 'المنتج غير موجود', 404);
    ok(res, p);
  } catch (e) { fail(res, e.message); }
});

app.patch('/api/products/:id/toggle', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const id = validateId(req.params.id);
    if (!id) return fail(res, 'معرف غير صالح', 400);
    const p = jOne('products', 'id', id);
    if (!p) return fail(res, 'المنتج غير موجود', 404);
    const u = jUpd('products', 'id', id, { active: !p.active });
    ok(res, { id: u.id, active: u.active });
  } catch (e) { fail(res, e.message); }
});

// Orders
app.get('/api/orders', (req, res) => {
  try {
    let r = jGet('orders');
    const isAdmin = req.headers.authorization === 'Bearer admin-token-2024';
    if (!isAdmin) {
      if (!req.query.phone) return fail(res, 'غير مصرح', 401);
      r = r.filter(o => o.phone === sanitize(req.query.phone));
    }
    if (req.query.status) r = r.filter(o => o.status === sanitize(req.query.status));
    r.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (req.query.limit) r = r.slice(0, parseInt(req.query.limit));
    ok(res, r);
  } catch (e) { fail(res, e.message); }
});

app.get('/api/orders/stats', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const items = jGet('orders');
    const s = { total: 0, pending: 0, confirmed: 0, preparing: 0, delivering: 0, delivered: 0, cancelled: 0 };
    items.forEach(o => { s.total++; if (s[o.status] !== undefined) s[o.status]++; });
    ok(res, s);
  } catch (e) { fail(res, e.message); }
});

app.post('/api/orders', (req, res) => {
  try {
    const { items, total, address, lat, lng, phone, name, payment, txnId } = req.body;
    if (!items || !items.length) return fail(res, 'الطلب فارغ', 400);
    if (items.length > 100) return fail(res, 'عدد المنتجات كبير جداً', 400);
    const phoneClean = sanitize(String(phone||'')).replace(/\D/g,'').slice(0,15);
    if (!phoneClean) return fail(res, 'رقم الهاتف مطلوب', 400);
    const order = {
      id: 'ORD-'+Date.now().toString(36).toUpperCase(),
      items: items.slice(0,100).map(i=>({name:sanitize(i.name),sub:sanitize(i.sub||''),qty:Math.min(Math.max(parseInt(i.qty)||1,1),999),price:Math.min(Math.max(parseFloat(i.price)||0,0),999999999),unit:sanitize(i.unit)||''})),
      status: 'pending', date: new Date().toISOString(),
      total: Math.min(Math.max(parseFloat(total||0),0),999999999),
      payment: ['cash','syriatel','sham','qr'].includes(payment) ? payment : 'cash',
      txnId: sanitize(txnId||'').slice(0,50), address: sanitize(address||'').slice(0,500),
      lat: lat !== undefined ? parseFloat(lat) : null, lng: lng !== undefined ? parseFloat(lng) : null,
      phone: phoneClean, name: sanitize(name||'').slice(0,100)
    };
    const o = jAdd('orders', order);
    io.emit('orders:updated', { action: 'create', order: o });
    ok(res, o);
  } catch (e) { fail(res, e.message); }
});

app.put('/api/orders/:id/status', (req, res) => {
  try {
    const validStatuses = ['pending','confirmed','preparing','delivering','delivered','cancelled'];
    const status = sanitize(req.body.status||'');
    if (!validStatuses.includes(status)) return fail(res, 'حالة غير صالحة', 400);
    const isAdmin = req.headers.authorization === 'Bearer admin-token-2024';
    const o = jOne('orders', 'id', sanitize(req.params.id));
    if (!o) return fail(res, 'الطلب غير موجود', 404);
    if (!isAdmin) {
      if (status !== 'cancelled') return fail(res, 'غير مصرح', 403);
      if (!['pending','confirmed'].includes(o.status)) return fail(res, 'لا يمكن إلغاء الطلب', 400);
    }
    const u = jUpd('orders', 'id', sanitize(req.params.id), { status });
    io.emit('orders:updated', { action: 'update', order: u });
    ok(res, u);
  } catch (e) { fail(res, e.message); }
});

app.delete('/api/orders/:id', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const o = jDel('orders', 'id', sanitize(req.params.id));
    if (!o) return fail(res, 'الطلب غير موجود', 404);
    ok(res, o);
  } catch (e) { fail(res, e.message); }
});

// Categories
app.get('/api/categories', (req, res) => {
  try { ok(res, jGet('categories')); } catch (e) { fail(res, e.message); }
});

app.post('/api/categories', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const name = sanitize(req.body.name);
    if (!name) return fail(res, 'اسم القسم مطلوب', 400);
    const cat = { id: 'cat_'+Date.now(), name, icon: sanitize(req.body.icon||'fa-tag'), color: sanitize(req.body.color||'#16A34A') };
    const c = jAdd('categories', cat);
    io.emit('categories:updated', [c]);
    ok(res, c);
  } catch (e) { fail(res, e.message); }
});

app.put('/api/categories/:id', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const u = {};
    if (req.body.name) u.name = sanitize(req.body.name);
    if (req.body.icon) u.icon = sanitize(req.body.icon);
    if (req.body.color) u.color = sanitize(req.body.color);
    const c = jUpd('categories', 'id', sanitize(req.params.id), u);
    if (!c) return fail(res, 'القسم غير موجود', 404);
    ok(res, c);
  } catch (e) { fail(res, e.message); }
});

app.delete('/api/categories/:id', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const catId = sanitize(req.params.id);
    const prods = jGet('products').filter(p => p.cat === catId);
    if (prods.length) return fail(res, 'هناك منتجات مرتبطة بهذا القسم', 400);
    const c = jDel('categories', 'id', catId);
    if (!c) return fail(res, 'القسم غير موجود', 404);
    ok(res, c);
  } catch (e) { fail(res, e.message); }
});

// Auth
app.post('/api/auth/login', (req, res) => {
  const pw = String(req.body.password||'');
  if (pw === ADMIN_PASSWORD) return ok(res, { token: 'admin-token-2024' });
  fail(res, 'كلمة المرور خاطئة', 401);
});

app.post('/api/auth/send-otp', (req, res) => {
  const phone = String(req.body.phone||'').replace(/\D/g,'').slice(0,15);
  const code = String(req.body.code||'').replace(/\D/g,'').slice(0,6);
  if (!phone || !code) return fail(res, 'الرقم والرمز مطلوبان', 400);
  ok(res, { sent: false, msg: 'تم المحاكاة' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const phone = String(req.body.phone||'').replace(/\D/g,'').slice(0,15);
  const code = String(req.body.code||'').replace(/\D/g,'').slice(0,6);
  if (!phone || !code) return fail(res, 'الرقم والرمز مطلوبان', 400);
  ok(res, { verified: true, phone });
});

// Settings
app.get('/api/settings', (req, res) => {
  try { ok(res, jGet('settings')); } catch (e) { fail(res, e.message); }
});

app.put('/api/settings', (req, res) => {
  if (req.headers.authorization !== 'Bearer admin-token-2024') return fail(res, 'غير مصرح', 401);
  try {
    const validKeys = ['callMeBotKey','deliveryFee'];
    const d = readDB(); d.settings = d.settings || {};
    Object.entries(req.body).filter(([k]) => validKeys.includes(k)).forEach(([k, v]) => { d.settings[k] = String(v||'').slice(0,500); });
    writeDB(d);
    io.emit('settings:updated', req.body);
    ok(res, req.body);
  } catch (e) { fail(res, e.message); }
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: 'خطأ داخلي في السيرفر' });
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

// Start
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mode: ${memMode ? 'In-Memory' : 'Local JSON'}`);
  console.log(`Running on port ${PORT}`);
});
