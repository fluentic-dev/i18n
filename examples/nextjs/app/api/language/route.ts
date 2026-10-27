import { cookies } from 'next/headers';
export async function POST(request: Request) {
  const language = await request.text();
  if (!['en', 'fr'].includes(language)) return new Response('Invalid language', { status: 400 });
  (await cookies()).set('language', language, { httpOnly: true, sameSite: 'lax', path: '/' });
  return new Response(null, { status: 204 });
}
