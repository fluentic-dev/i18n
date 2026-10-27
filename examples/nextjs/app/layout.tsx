import { I18nProvider } from '@fluentic/i18n-nextjs';
import { ready } from '@fluentic/i18n-nextjs/server';
export default async function Layout({ children }: { children: React.ReactNode; }) {
  const snapshot = await ready();
  return (
    <html lang={snapshot.languageId}>
      <body>
        <I18nProvider snapshot={snapshot}>{children}</I18nProvider>
      </body>
    </html>
  );
}
