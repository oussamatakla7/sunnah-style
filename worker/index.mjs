const pagePaths = new Map([['/', 'index'], ['/index', 'index'], ['/index.html', 'index'],
  ['/shop', 'shop'], ['/shop.html', 'shop'], ['/contact', 'contact'], ['/contact.html', 'contact']]);
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
  return content && content.pages && Object.keys(content.pages).every(key =>
    ['index', 'shop', 'contact'].includes(key) &&
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const isAdmin = adminPaths.has(path);
    if (isAdmin) {
      const identity = request.headers.get('oai-authenticated-user-id');
      const email = request.headers.get('oai-authenticated-user-email')?.trim().toLowerCase();
      const owner = env.ADMIN_EMAIL?.trim().toLowerCase();
      if (!identity || !email) {
        if (path === '/editor' || path === '/editor.html') {
          return new Response(null, {status: 302, headers: {...noCache, Location: '/signin-with-chatgpt?return_to=%2Feditor'}});
        }
        return json({error: 'login'}, 401);
      }
      if (!owner || email !== owner) return new Response('هذه اللوحة مخصّصة لمالك المتجر.', {
        status: 403, headers: {...noCache, 'Content-Type': 'text/plain; charset=utf-8'}
      });
      if (path === '/api/admin/state' && request.method === 'PUT') return updateState(request, env.BUCKET);
      if (path === '/api/admin/state' && request.method === 'GET') {
        const {data} = await getState(env.BUCKET);
        return json({revision: data.revision, draft: data.draft});
      }
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({error: 'method'}, 405);
    if (isAdmin) return asset(path === '/editor' ? '/editor.html' : path);
    const page = pagePaths.get(path);
    if (page || path === '/catalog.js') {
      const {data} = await getState(env.BUCKET);
      if (page && data.live.pages[page]) return new Response(data.live.pages[page], {
        headers: {...noCache, 'Content-Type': 'text/html; charset=utf-8'}
      });
      if (path === '/catalog.js' && data.live.products) return new Response(
        'window.storeCatalog = ' + JSON.stringify(data.live.products) + ';', {
          headers: {...noCache, 'Content-Type': 'application/javascript; charset=utf-8'}
        });
      return asset(page ? '/' + page + '.html' : path);
    }
    if (path.startsWith('/assets/')) return asset(path, {...noCache, 'Cache-Control': 'public, max-age=3600'});
    return ['/shop.js', '/style.css'].includes(path) ? asset(path) : new Response('Not found', {status: 404, headers: noCache});
  }
};
