import 'server-only';
import { cookies } from 'next/headers';
import { type LanguageDefinition, requireLanguageId, resolveLanguageId } from './language';

export type LanguageCookieOptions = {
  name?: string;
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
  secure?: boolean;
};

export type CookieServerOptions<LanguageId extends string> = LanguageDefinition<LanguageId> & {
  cookie?: LanguageCookieOptions;
};

export function createServerHandler<LanguageId extends string>(
  options: CookieServerOptions<LanguageId>,
) {
  const { name = 'fluentic-language', ...configuredCookie } = options.cookie ?? {};
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...configuredCookie,
  };

  const getLanguageId = async (): Promise<LanguageId> => {
    const value = (await cookies()).get(name)?.value;

    return resolveLanguageId(options, value) ?? options.defaultLanguageId;
  };
  const setLanguageId = async (value: LanguageId): Promise<void> => {
    const languageId = requireLanguageId(options, value);
    (await cookies()).set(name, languageId, cookieOptions);
  };
  const POST = async (request: Request): Promise<Response> => {
    const value = await request.text();
    const languageId = resolveLanguageId(options, value);
    if (!languageId) return new Response('Unsupported language', { status: 400 });
    await setLanguageId(languageId);

    return new Response(null, { status: 204 });
  };

  return { getLanguageId, setLanguageId, POST };
}

export { createServerHandler as createCookieServerHandler };
