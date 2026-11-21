import { type NextRequest, NextResponse } from 'next/server';
import { type LanguageDefinition, resolveLanguageId } from './language';

export type UrlProxyOptions<LanguageId extends string> = LanguageDefinition<LanguageId> & {
  detectLanguage?: boolean;
  headerName?: string;
  rememberCookie?: false | string;
};

function decodePathSegment(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function preferredLanguage<LanguageId extends string>(
  request: NextRequest,
  options: UrlProxyOptions<LanguageId>,
): LanguageId {
  const remembered = options.rememberCookie && request.cookies.get(options.rememberCookie)?.value;
  const fromCookie = resolveLanguageId(options, remembered || null);
  if (fromCookie) return fromCookie;
  if (options.detectLanguage !== false) {
    const requested = (request.headers.get('accept-language') ?? '')
      .split(',')
      .map((entry) => {
        const [id, q] = entry.trim().split(';q=');
        return { id, quality: q === undefined ? 1 : Number(q) || 0 };
      })
      .sort((a, b) => b.quality - a.quality);

    for (const candidate of requested) {
      const exact = resolveLanguageId(options, candidate.id);
      if (exact) return exact;
      const base = options.languages.find((id) => id.split('-')[0] === candidate.id.split('-')[0]);
      if (base) return base;
    }
  }

  return options.defaultLanguageId;
}

export function createUrlProxyHandler<LanguageId extends string>(
  options: UrlProxyOptions<LanguageId>,
) {
  const headerName = options.headerName ?? 'x-fluentic-language';

  return function proxy(request: NextRequest): NextResponse {
    const segments = request.nextUrl.pathname.split('/');
    const languageId = resolveLanguageId(options, decodePathSegment(segments[1] ?? ''));

    if (!languageId) {
      const destination = request.nextUrl.clone();
      const selected = preferredLanguage(request, options);
      destination.pathname = `/${encodeURIComponent(selected)}${
        destination.pathname === '/' ? '' : destination.pathname
      }`;

      return NextResponse.redirect(destination);
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(headerName, languageId);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    if (options.rememberCookie) {
      response.cookies.set(options.rememberCookie, languageId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      });
    }

    return response;
  };
}
