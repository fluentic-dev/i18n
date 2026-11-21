import type { Formats, Runtime } from './shared/runtime';
import type { Catalog } from './translation-manager';

export type I18nSnapshot = {
  languageId: string;
  fallbackLanguageId?: string;
  translations: Record<string, Catalog>;
  formats?: Partial<Formats>;
  compiledLanguages?: string[];
};

type HydrationController = {
  runtime: Runtime;
  state: {
    set(value: Partial<{ languageId: string; isLoading: boolean; ready: boolean; }>): void;
  };
  translations: {
    catalogs: Record<string, Catalog>;
    compiledCatalogs: Record<string, boolean>;
  };
  getFallbackLanguageId(): string | undefined;
  setFallbackLanguageId(languageId: string | undefined): void;
  invalidate(): void;
};

const controllers = new WeakMap<object, HydrationController>();

export function registerHydration(target: object, controller: HydrationController): void {
  controllers.set(target, controller);
}

export function getHydration(target: object): HydrationController {
  const controller = controllers.get(target);

  if (!controller) throw new TypeError('[i18n] hydration requires an i18n manager instance');

  return controller;
}
