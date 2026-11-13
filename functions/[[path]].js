const storefront = 'https://sunnah-style.oussamatakla.chatgpt.site';

export async function onRequest({ request }) {
  const incoming = new URL(request.url);
  const upstream = new URL(storefront);
  upstream.pathname = incoming.pathname;
  upstream.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  if (headers.get('origin') === incoming.origin) headers.set('origin', storefront);
  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.body,
    redirect: 'manual',
  });
  const output = new Response(response.body, response);
  const location = output.headers.get('location');
  if (location) {
    const destination = new URL(location, upstream);
    if (destination.origin === storefront) {
      output.headers.set('location', destination.pathname + destination.search + destination.hash);
    }
  }
  return output;
}
