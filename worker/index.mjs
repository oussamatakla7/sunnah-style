const pagePaths = new Map([['/', 'index'], ['/index', 'index'], ['/index.html', 'index'],
  ['/shop', 'shop'], ['/shop.html', 'shop'], ['/contact', 'contact'], ['/contact.html', 'contact']]);
const customPagePath = /^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isCustomPage = key => key.length <= 67 && customPagePath.test(key);
const stateKey = 'store-state.json';
const adminPaths = new Set(['/editor', '/editor.html', '/editor.js', '/api/admin/state', '/api/admin/users', '/api/admin/orders']);
const noCache = {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'};
const json = (value, status = 200) => Response.json(value, {status, headers: noCache});
const empty = {revision: 0, draft: {pages: {}, products: null}, live: {pages: {}, products: null}};

async function getState(bucket) {
  const object = await bucket.get(stateKey);
  return object ? {data: await object.json(), etag: object.etag} : {data: empty, etag: null};
}

function validContent(content) {
  return content && content.pages && typeof content.pages === 'object' && !Array.isArray(content.pages) &&
    Object.keys(content.pages).every(key =>
    (['index', 'shop', 'contact', 'layout-header', 'layout-footer'].includes(key) || isCustomPage(key)) &&
    typeof content.pages[key] === 'string' && content.pages[key].startsWith('<!doctype html>')) &&
    Array.isArray(content.products) && content.products.length <= 1000 &&
    new Set(content.products.map(item => item?.sku)).size === content.products.length &&
    content.products.every(item => item && /^[A-Z0-9_-]{1,80}$/.test(item.sku) &&
      typeof item.name === 'string' && item.name.trim() && typeof item.description === 'string' &&
      [1, 2, 3].includes(item.category) && Number.isFinite(item.price) && item.price >= 0 &&
      (item.quantity === null || (Number.isSafeInteger(item.quantity) && item.quantity >= 0)) &&
      typeof item.image === 'string' && Array.isArray(item.variants) && item.variants.length > 0 &&
      item.variants.every(variant => Array.isArray(variant) && Array.isArray(variant[0]) &&
        typeof variant[0][0] === 'string' && /^#[a-f\d]{6}$/i.test(variant[0][1]) &&
        (variant[1] === null || Array.isArray(variant[1]))));
}

async function updateState(request, bucket, role) {
  if (request.headers.get('origin') !== new URL(request.url).origin ||
      request.headers.get('content-type')?.split(';')[0] !== 'application/json') return json({error: 'origin'}, 403);
  if (Number(request.headers.get('content-length')) > 8_000_000) return json({error: 'limit'}, 413);
  const reader = request.body?.getReader();
  if (!reader) return json({error: 'invalid'}, 400);
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8_000_000) {
      await reader.cancel();
      return json({error: 'limit'}, 413);
    }
    body += decoder.decode(value, {stream: true});
  }
  let input;
  try { input = JSON.parse(body + decoder.decode()); }
  catch { return json({error: 'invalid'}, 400); }
  if (!input || !['save', 'publish'].includes(input.action)) return json({error: 'invalid'}, 400);
  const {data, etag} = await getState(bucket);
  if (data.revision !== input.revision) return json({error: 'conflict'}, 409);
  const content = role === 'products' ? {pages:data.draft.pages, products:input.content?.products} : input.content;
  if (!validContent(content)) return json({error: 'invalid'}, 400);
  const next = {
    revision: data.revision + 1,
    draft: content,
    live: input.action === 'publish' ? (role === 'products' ? {pages:data.live.pages, products:content.products} : content) : data.live
  };
  const written = await bucket.put(stateKey, JSON.stringify(next), {
    onlyIf: etag ? {etagMatches: etag} : {etagDoesNotMatch: '*'}
  });
  return written ? json({revision: next.revision}) : json({error: 'conflict'}, 409);
}

function asset(path, cache = noCache) {
  const file = assets[path];
  if (!file) return new Response('Not found', {status: 404, headers: noCache});
  return new Response(Uint8Array.from(atob(file.data), byte => byte.charCodeAt(0)), {
    headers: {'Content-Type': file.type, ...cache}
  });
}


const loginPath = '/admin-login';
const cookieName = '__Host-sunnah-admin';
const sessionAge = 8 * 60 * 60;
const encode = new TextEncoder();
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
const bytes = value => Uint8Array.from(value.match(/../g), pair => Number.parseInt(pair,16));
const cookie = (value, age) => cookieName + '=' + value + '; Path=/; Max-Age=' + age + '; Secure; HttpOnly; SameSite=Strict';
const redirect = (path, session) => new Response(null, {status:303, headers:{
  ...noCache, Location:path, ...(session ? {'Set-Cookie':session} : {})
}});
const sameOrigin = request => request.headers.get('origin') === new URL(request.url).origin;
const sessionToken = request => request.headers.get('cookie')?.split(';').map(part => part.trim())
  .find(part => part.startsWith(cookieName+'='))?.slice(cookieName.length+1);
const sessionKey = async token => 'admin/sessions/' + hex(await crypto.subtle.digest('SHA-256',encode.encode(token)));
const usersKey = 'admin/users.json';
const validUsername = name => typeof name === 'string' && /^[a-z][a-z0-9_-]{2,39}$/.test(name);
async function accounts(env) {
  const stored = await env.BUCKET.get(usersKey);
  if (stored) return {data:await stored.json(), etag:stored.etag};
  const data = {admin:{role:'admin', verifier:env.ADMIN_PASSWORD_VERIFIER, version:'initial'}};
  if (env.PRODUCTS_PASSWORD_VERIFIER) data.sunnah = {role:'products', verifier:env.PRODUCTS_PASSWORD_VERIFIER, version:'initial'};
  return {data, etag:null};
}
const passwordHash = async (password, salt) => {
  const key = await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    {name:'PBKDF2',salt:encode.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
};
async function manageUsers(request, env, current) {
  if (current.role !== 'admin') return json({error:'forbidden'},403);
  const {data, etag} = await accounts(env);
  if (request.method === 'GET') return json({current:current.username, users:Object.entries(data).map(([username, {role}]) => ({username,role}))});
  if (request.method !== 'PUT') return json({error:'method'},405);
  if (!sameOrigin(request) || request.headers.get('content-type') !== 'application/json') return json({error:'origin'},403);
  let input;
  try { const body = await request.text(); if (body.length > 2048) return json({error:'invalid'},400); input = JSON.parse(body); }
  catch { return json({error:'invalid'},400); }
  const {username, role, password, action} = input || {};
  if (!validUsername(username) || !['create','update','delete'].includes(action)) return json({error:'invalid'},400);
  const existing = Object.hasOwn(data,username) ? data[username] : null;
  if ((action === 'create') === Boolean(existing)) return json({error:'conflict'},409);
  if ((username === 'admin' || username === current.username) &&
      (action === 'delete' || role !== 'admin')) return json({error:'protected'},400);
  if (action === 'delete') delete data[username];
  else {
    if (!['admin','products'].includes(role) || typeof password !== 'string' ||
        (password ? password.length < 8 || password.length > 128 : !existing)) return json({error:'invalid'},400);
    let verifier = existing?.verifier;
    if (password) {
      const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
      verifier = salt + ':' + hex(await passwordHash(password,salt));
    }
    data[username] = {role,verifier,version:crypto.randomUUID()};
  }
  const written = await env.BUCKET.put(usersKey,JSON.stringify(data),{
    onlyIf:etag ? {etagMatches:etag} : {etagDoesNotMatch:'*'}
  });
  return written ? json({ok:true}) : json({error:'conflict'},409);
}

async function session(request, env) {
  const token = sessionToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = await sessionKey(token);
  const entry = await env.BUCKET.head(key);
  if (!(Number(entry?.customMetadata?.expires) > Date.now())) return null;
  const username = entry.customMetadata.username || (entry.customMetadata.role === 'products' ? 'sunnah' : 'admin');
  const {data} = await accounts(env);
  const account = Object.hasOwn(data,username) ? data[username] : null;
  return account && account.version === (entry.customMetadata.version || 'initial')
    ? {key,username,role:account.role} : null;
}

function loginPage(message = '', status = 200) {
  return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول الإدارة | سنّة ستايل</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:#f7f3eb;color:#12362c;font:16px system-ui}main{width:min(100%,26rem);background:white;border:1px solid #ded5c4;padding:2rem}h1{margin:0 0 1rem;font-size:1.65rem}form,label{display:grid;gap:.6rem}form{gap:1rem}input,button{font:inherit;padding:.7rem;border:1px solid #b6c0b8;border-radius:.35rem}button{background:#12362c;color:white;cursor:pointer}p{color:#853a36}</style><main><h1>دخول لوحة سنّة ستايل</h1><p role="alert">'+message+'</p><form method="post" action="/admin-login"><label>اسم المستخدم<input name="username" dir="ltr" autocomplete="username" maxlength="80" required></label><label>كلمة المرور<input name="password" dir="ltr" type="password" autocomplete="current-password" maxlength="128" required></label><button>تسجيل الدخول</button></form></main></html>',{
    status,headers:{...noCache,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}
  });
}

async function login(request, env) {
  if (!sameOrigin(request)) return loginPage('أعيدي فتح صفحة تسجيل الدخول.',403);
  if (Number(request.headers.get('content-length')) > 1024) return loginPage('بيانات الدخول غير صالحة.',400);
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return loginPage('بيانات الدخول غير صالحة.',400);
  const reader = request.body?.getReader();
  if (!reader) return loginPage('بيانات الدخول غير صالحة.',400);
  let body = '';
  const decoder = new TextDecoder();
  let count = 0;
  for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    count += value.byteLength;
    if (count > 1024) {
      await reader.cancel();
      return loginPage('بيانات الدخول غير صالحة.',400);
    }
    body += decoder.decode(value,{stream:true});
  }
  const fields = new URLSearchParams(body + decoder.decode());
  const username = fields.get('username');
  const {data} = await accounts(env);
  const account = validUsername(username) && Object.hasOwn(data,username) ? data[username] : null;
  const verifier = account?.verifier;
  if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(verifier || '')) return loginPage('اسم المستخدم أو كلمة المرور غير صحيحة.',401);
  const password = fields.get('password') || '';
  const [salt, expected] = verifier.split(':');
  const actual = await passwordHash(password,salt);
  let mismatch = 0;
  const target = bytes(expected);
  for (let index = 0; index < target.length; index++) mismatch |= target[index] ^ actual[index];
  if (mismatch !== 0) return loginPage('اسم المستخدم أو كلمة المرور غير صحيحة.',401);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.BUCKET.put(await sessionKey(token),'',{customMetadata:{username,version:account.version,expires:String(Date.now()+sessionAge*1000)}});
  return redirect('/editor',cookie(token,sessionAge));
}


async function createOrder(request, bucket) {
  if (!sameOrigin(request) || request.headers.get('content-type') !== 'application/json') return json({error:'origin'},403);
  const reader = request.body?.getReader();
  if (!reader) return json({error:'invalid'},400);
  const decoder = new TextDecoder();
  let body = '';
  let bytes = 0;
  for (;;) {
    const {done,value} = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 16384) { await reader.cancel(); return json({error:'limit'},413); }
    body += decoder.decode(value,{stream:true});
  }
  let input;
  try { input = JSON.parse(body + decoder.decode()); }
  catch { return json({error:'invalid'},400); }
  const limits = {customer:100,phone:25,area:100,address:250,notes:250};
  const delivery = {};
  for (const [field, limit] of Object.entries(limits)) {
    const value = input?.delivery?.[field];
    if (typeof value !== 'string' || value.length > limit || (!value.trim() && field !== 'notes')) return json({error:'invalid'},400);
    delivery[field] = value.trim().replace(/\s+/g,' ');
  }
  if (delivery.phone.replace(/[^0-9٠-٩۰-۹]/g,'').length < 7 ||
      !Array.isArray(input.items) || !input.items.length || input.items.length > 50) return json({error:'invalid'},400);
  const {data} = await getState(bucket);
  const catalog = data.live.products ?? defaultCatalog;
  const items = [];
  const quantities = new Map();
  let cents = 0;
  for (const item of input.items) {
    const product = catalog.find(product => product.sku === item?.sku);
    const variant = Number.isInteger(item?.color) && product?.variants[item.color];
    if (!variant || typeof item.size !== 'string' || !(variant[1] || ['يُحدّد عبر واتساب']).map(String).includes(item.size) ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) return json({error:'invalid_item'},400);
    const quantity = (quantities.get(product.sku) || 0) + item.quantity;
    if (product.quantity != null && quantity > product.quantity) return json({error:'stock'},409);
    quantities.set(product.sku,quantity);
    const unitCents = Math.round(product.price * 100);
    cents += unitCents * item.quantity;
    items.push({sku:product.sku,name:product.name,color:variant[0][0],size:item.size,quantity:item.quantity,unitCents});
  }
  const now = Date.now();
  const id = crypto.randomUUID();
  const order = {id,createdAt:new Date(now).toISOString(),delivery,items,cents};
  const key = orderKey(id, now);
  await bucket.put(key,JSON.stringify(order));
  return json({id,items,cents},201);
}

function orderKey(id, timestamp) {
  return 'orders/' + String(9999999999999 - timestamp).padStart(13,'0') + '-' + id;
}

async function manageOrders(request, bucket, current) {
  if (current.role !== 'admin') return json({error:'forbidden'},403);
  const params = new URL(request.url).searchParams;
  if (request.method === 'DELETE') {
    if (!sameOrigin(request)) return json({error:'origin'},403);
    const id = params.get('id') || '';
    const timestamp = Date.parse(params.get('createdAt'));
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id) ||
        !Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp > 9999999999999) {
      return json({error:'invalid'},400);
    }
    await bucket.delete(orderKey(id, timestamp));
    return json({ok:true});
  }
  if (request.method !== 'GET') return json({error:'method'},405);
  const cursor = params.get('cursor');
  const result = await bucket.list({prefix:'orders/',limit:20,...(cursor ? {cursor} : {})});
  const orders = await Promise.all(result.objects.map(async entry => (await bucket.get(entry.key))?.json()));
  return json({orders:orders.filter(Boolean),cursor:result.truncated ? result.cursor : null});
}

function convexStore(env) {
  const call = (method, params, body, conditional = {}) => fetch(
    env.CONVEX_SITE_URL + '/store-record?' + new URLSearchParams(params),
    {method, body, headers:{Authorization:'Bearer ' + env.STORE_BRIDGE_SECRET, ...conditional}}
  );
  return {
    async get(key) {
      const response = await call('GET',{key});
      if (response.status === 404) return null;
      if (!response.ok) throw Error('Convex read failed');
      return {etag:response.headers.get('etag'),json:() => response.json()};
    },
    async put(key, body, options) {
      const conditional = {};
      if (options?.onlyIf?.etagMatches) conditional['If-Match'] = options.onlyIf.etagMatches;
      if (options?.onlyIf?.etagDoesNotMatch) conditional['If-None-Match'] = '*';
      const response = await call('PUT',{key},body,conditional);
      if (response.status === 412) return null;
      if (!response.ok) throw Error('Convex write failed');
      return {key};
    },
    async delete(key) {
      if (!(await call('DELETE',{key})).ok) throw Error('Convex delete failed');
    },
    async list({cursor}) {
      const response = await call('GET',{after:cursor || ''});
      if (!response.ok) throw Error('Convex list failed');
      const keys = await response.json();
      return {objects:keys.slice(0,20).map(key => ({key})),truncated:keys.length > 20,cursor:keys[19]};
    }
  };
}

async function migrateStore(env, target) {
  const bucket = env.BUCKET;
  const state = await bucket.get(stateKey);
  if (state) await target.put(stateKey,await state.text());
  let cursor;
  let orders = 0;
  do {
    const batch = await bucket.list({prefix:'orders/',limit:20,...(cursor ? {cursor} : {})});
    for (const {key} of batch.objects) {
      const order = await bucket.get(key);
      if (order) {
        await target.put(key,await order.text());
        orders++;
      }
    }
    cursor = batch.truncated ? batch.cursor : undefined;
  } while (cursor);
  return json({state:Boolean(state),orders});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const convex = env.CONVEX_SITE_URL && env.STORE_BRIDGE_SECRET ? convexStore(env) : null;
    const bucket = convex && env.CONVEX_ACTIVE === '1' ? convex : env.BUCKET;
    if (path === '/api/admin/migrate-store') {
      if (request.method !== 'POST' || !convex || env.CONVEX_ACTIVE === '1' ||
          request.headers.get('Authorization') !== 'Bearer ' + env.STORE_BRIDGE_SECRET) return json({error:'not_found'},404);
      return migrateStore(env,convex);
    }
    if (convex && env.CONVEX_ACTIVE === 'migrate' &&
        ((path === '/api/orders' || path === '/api/admin/state' || path === '/api/admin/orders') && !['GET','HEAD'].includes(request.method))) {
      return json({error:'maintenance'},503);
    }
    if (path === '/api/orders') {
      if (request.method !== 'POST') return json({error:'method'},405);
      return createOrder(request,bucket);
    }
    if (path === loginPath) {
      if (request.method === 'GET') return await session(request, env) ? redirect('/editor') : loginPage();
      if (request.method === 'POST') return login(request, env);
      return json({error:'method'},405);
    }
    if (path === '/admin-logout') {
      if (request.method !== 'POST') return json({error:'method'},405);
      if (!sameOrigin(request)) return json({error:'origin'},403);
      const current = await session(request, env);
      if (current) await env.BUCKET.delete(current.key);
      return redirect(loginPath,cookie('',0));
    }
    const isAdmin = adminPaths.has(path);
    if (isAdmin) {
      const current = await session(request, env);
      if (!current) {
        if (path === '/editor' || path === '/editor.html') return redirect(loginPath);
        return json({error:'login'},401);
      }
      if (path === '/api/admin/users') return manageUsers(request,env,current);
      if (path === '/api/admin/orders') return manageOrders(request,bucket,current);
      if (path === '/api/admin/state' && request.method === 'PUT') return updateState(request, bucket, current.role);
      if (path === '/api/admin/state' && request.method === 'GET') {
        const {data} = await getState(bucket);
        if (current.role === 'products') return json({revision:data.revision, role:current.role, draft:{pages:{}, products:data.draft.products}});
        return json({revision: data.revision, role:current.role, draft: data.draft, publishedPages: Object.keys(data.live.pages)});
      }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'method'}, 405);
    if (isAdmin) return asset(path === '/editor' ? '/editor.html' : path);
    const custom = isCustomPage(path);
    const page = custom ? path : path === '/product.html' ? 'product' : pagePaths.get(path);
    if (page || path === '/catalog.js') {
      const {data} = await getState(bucket);
      if (page) {
        const {pages} = data.live;
        const response = pages[page] ? new Response(pages[page], {
          headers: {...noCache, 'Content-Type': 'text/html; charset=utf-8'}
        }) : asset(custom ? path : '/' + page + '.html');
        if (!response.ok || (!pages['layout-header'] && !pages['layout-footer'])) return response;
        const rewrite = new HTMLRewriter();
        for (const part of ['header', 'footer']) {
          const fragment = pages['layout-' + part]?.slice('<!doctype html>'.length);
          if (fragment) rewrite.on(part === 'header' ? 'body > header.bar' : 'body > footer', {
            element(node) { node.replace(fragment, {html:true}); }
          });
        }
        return rewrite.transform(response);
      }
      if (path === '/catalog.js' && data.live.products) return new Response(
        'window.storeCatalog = ' + JSON.stringify(data.live.products) + ';', {
          headers: {...noCache, 'Content-Type': 'application/javascript; charset=utf-8'}
        });
      return asset(path);
    }
    if (path.startsWith('/assets/')) return asset(path, {...noCache, 'Cache-Control': 'public, max-age=3600'});
    return ['/shop.js', '/style.css'].includes(path) ? asset(path) : new Response('Not found', {status: 404, headers: noCache});
  }
};
