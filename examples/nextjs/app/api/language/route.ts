import { cookieServer } from '../../../i18n/cookie.server';

export async function POST(request: Request) {
  return cookieServer.POST(request);
}
