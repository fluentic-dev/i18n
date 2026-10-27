const prefix = '/i18n';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) {
      return new Response('Not found', { status: 404 });
    }

    url.pathname = url.pathname.slice(prefix.length) || '/';
    const response = await env.ASSETS.fetch(new Request(url, request));
    // Asset canonicalization operates on the stripped path. Restore the public
    // mount point so trailing-slash redirects stay inside this documentation site.
    const location = response.headers.get('Location');
    if (response.status >= 300 && response.status < 400 && location) {
      const destination = new URL(location, url);
      if (destination.origin === url.origin) {
        destination.pathname = prefix + destination.pathname;
        const headers = new Headers(response.headers);
        headers.set('Location', destination.pathname + destination.search + destination.hash);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
    }
    return response;
  },
};
