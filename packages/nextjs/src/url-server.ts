import { headers } from 'next/headers';
import { resolveLanguageId } from './language';
import { createUrlProxyHandler, type UrlProxyOptions } from './url-proxy';

export type UrlServerOptions<LanguageId extends string> = UrlProxyOptions<LanguageId>;

export function createServerHandler<LanguageId extends string>(
  options: UrlServerOptions<LanguageId>,
) {
  const headerName = options.headerName ?? 'x-fluentic-language';
  const getLanguageId = async (): Promise<LanguageId> => {
    return resolveLanguageId(options, (await headers()).get(headerName)) ?? options.defaultLanguageId;
  };
  const proxy = createUrlProxyHandler(options);

  return { getLanguageId, proxy };
}

export { createServerHandler as createUrlServerHandler };

export { createUrlProxyHandler } from './url-proxy';
export type { UrlProxyOptions } from './url-proxy';
