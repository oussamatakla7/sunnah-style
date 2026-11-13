const pagePaths = new Map([['/', 'index'], ['/index', 'index'], ['/index.html', 'index'],
  ['/shop', 'shop'], ['/shop.html', 'shop'], ['/contact', 'contact'], ['/contact.html', 'contact']]);
const customPagePath = /^\/pages\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isCustomPage = key => key.length <= 67 && customPagePath.test(key);
const stateKey = 'store-state.json';
const adminPaths = new Set(['/editor', '/editor.html', '/editor.js', '/api/admin/state']);
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

async function updateState(request, bucket) {
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
  if (!input || !validContent(input.content) || !['save', 'publish'].includes(input.action)) return json({error: 'invalid'}, 400);
  const {data, etag} = await getState(bucket);
  if (data.revision !== input.revision) return json({error: 'conflict'}, 409);
  const next = {
    revision: data.revision + 1,
    draft: input.content,
    live: input.action === 'publish' ? input.content : data.live
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

async function session(request, env) {
  const token = sessionToken(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const key = await sessionKey(token);
  const entry = await env.BUCKET.head(key);
  return Number(entry?.customMetadata?.expires) > Date.now() ? key : null;
}

function loginPage(message = '', status = 200) {
  return new Response('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>دخول الإدارة | سنّة ستايل</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:1rem;background:#f7f3eb;color:#12362c;font:16px system-ui}main{width:min(100%,26rem);background:white;border:1px solid #ded5c4;padding:2rem}h1{margin:0 0 1rem;font-size:1.65rem}form,label{display:grid;gap:.6rem}form{gap:1rem}input,button{font:inherit;padding:.7rem;border:1px solid #b6c0b8;border-radius:.35rem}button{background:#12362c;color:white;cursor:pointer}p{color:#853a36}</style><main><h1>دخول لوحة سنّة ستايل</h1><p role="alert">'+message+'</p><form method="post" action="/admin-login"><label>اسم المستخدم<input name="username" dir="ltr" autocomplete="username" maxlength="80" required></label><label>كلمة المرور<input name="password" dir="ltr" type="password" autocomplete="current-password" maxlength="128" required></label><button>تسجيل الدخول</button></form></main></html>',{
    status,headers:{...noCache,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}
  });
}

async function login(request, env) {
  if (!sameOrigin(request)) return loginPage('أعيدي فتح صفحة تسجيل الدخول.',403);
  const verifier = env.ADMIN_PASSWORD_VERIFIER;
  if (!/^[a-f0-9]{32}:[a-f0-9]{64}$/.test(verifier || '')) return loginPage('تسجيل الدخول غير متاح حاليًا.',503);
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
  const password = fields.get('password') || '';
  const [salt, expected] = verifier.split(':');
  const key = await crypto.subtle.importKey('raw',encode.encode(password),'PBKDF2',false,['deriveBits']);
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    {name:'PBKDF2',salt:encode.encode(salt),iterations:100000,hash:'SHA-256'},key,256));
  let mismatch = 0;
  const target = bytes(expected);
  for (let index = 0; index < target.length; index++) mismatch |= target[index] ^ actual[index];
  if (fields.get('username') !== 'admin' || mismatch !== 0) return loginPage('اسم المستخدم أو كلمة المرور غير صحيحة.',401);
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  await env.BUCKET.put(await sessionKey(token),'',{customMetadata:{expires:String(Date.now()+sessionAge*1000)}});
  return redirect('/editor',cookie(token,sessionAge));
}


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    if (path === loginPath) {
      if (request.method === 'GET') return await session(request, env) ? redirect('/editor') : loginPage();
      if (request.method === 'POST') return login(request, env);
      return json({error:'method'},405);
    }
    if (path === '/admin-logout') {
      if (request.method !== 'POST') return json({error:'method'},405);
      if (!sameOrigin(request)) return json({error:'origin'},403);
      const key = await session(request, env);
      if (key) await env.BUCKET.delete(key);
      return redirect(loginPath,cookie('',0));
    }
    const isAdmin = adminPaths.has(path);
    if (isAdmin) {
      if (!await session(request, env)) {
        if (path === '/editor' || path === '/editor.html') return redirect(loginPath);
        return json({error:'login'},401);
      }
      if (path === '/api/admin/state' && request.method === 'PUT') return updateState(request, env.BUCKET);
      if (path === '/api/admin/state' && request.method === 'GET') {
        const {data} = await getState(env.BUCKET);
        return json({revision: data.revision, draft: data.draft, publishedPages: Object.keys(data.live.pages)});
      }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'method'}, 405);
    if (isAdmin) return asset(path === '/editor' ? '/editor.html' : path);
    const custom = isCustomPage(path);
    const page = custom ? path : pagePaths.get(path);
    if (page || path === '/catalog.js') {
      const {data} = await getState(env.BUCKET);
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
