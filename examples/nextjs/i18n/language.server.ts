import { cookieServer } from './cookie.server';
import { languageMode } from './languages';
import { urlServer } from './url.server';

export const languageServer = languageMode === 'url' ? urlServer : cookieServer;
