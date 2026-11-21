import { type NextRequest, NextResponse } from 'next/server';
import { languageMode } from './i18n/languages';
import { urlServer } from './i18n/url.server';

const { proxy: urlProxy } = urlServer;

export default function proxy(request: NextRequest) {
  return languageMode === 'url' ? urlProxy(request) : NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next|.*\\..*).*)',
};
