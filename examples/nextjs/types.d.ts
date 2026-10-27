declare module '*.jsonl' {
  const rows: import('@fluentic/i18n/adapter').CompiledTranslationItem[];
  export default rows;
}
