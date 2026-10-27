import { t } from '@fluentic/i18n';
import { I18nManager } from '@fluentic/i18n-web';
import french from './catalog.mjs';
const account = t.context('account');
const greeting = account.msg('Hello {name}', { name: String });
I18nManager.configure({ languageId: 'fr' });
I18nManager.setTranslationLoader(() => french);
await I18nManager.init();
console.log(t.text(greeting, { name: 'Ada' }));
