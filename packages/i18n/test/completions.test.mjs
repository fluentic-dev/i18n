import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-language-service';

for (const entry of ['index', 'compiled']) {
  test(`${entry} descriptor parameters have editor completions in incomplete calls`, () => {
    const file = fileURLToPath(new URL('./completion-fixture.ts', import.meta.url));
    const message = entry === 'compiled' ? "['id', ['Revenue, by ', [0, 'value1']]]" : "'Revenue, by {value1}'";
    const source = `
      import { t } from '../src/${entry}';
      const messages = { revenueBy: t.msg(${message}, { value1: String }) };
      t.jsx(messages.revenueBy, { /*jsx*/ });
      t.text(messages.revenueBy, { /*text*/ });
      t.msg(messages.revenueBy, { /*bind*/ });
      const bound = t.msg(messages.revenueBy, { value1: 'stay' });
      t.msg(bound, { /*rebind*/ });
      t.jsx(bound, { /*override*/ });
      ${entry === 'index' ? "t.context('report').jsx(messages.revenueBy, { /*scoped*/ });" : ''}
    `;
    const options = {
      strict: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
    };
    const service = ts.createLanguageService({
      getScriptFileNames: () => [file],
      getScriptVersion: () => '0',
      getScriptSnapshot: (name) => {
        const content = name === file ? source : ts.sys.readFile(name);
        return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
      },
      getCurrentDirectory: () => path.dirname(file),
      getCompilationSettings: () => options,
      getDefaultLibFileName: ts.getDefaultLibFilePath,
      fileExists: ts.sys.fileExists,
      readFile: ts.sys.readFile,
      readDirectory: ts.sys.readDirectory,
    });
    try {
      for (
        const marker of entry === 'index'
          ? ['jsx', 'text', 'bind', 'rebind', 'override', 'scoped']
          : ['jsx', 'text', 'bind', 'rebind', 'override']
      ) {
        const completions = service.getCompletionsAtPosition(file, source.indexOf(`/*${marker}*/`), {});
        assert.ok(completions?.isMemberCompletion, `${marker} should suggest object properties`);
        assert.ok(completions.entries.some(({ name }) => name === 'value1'), `${marker} should suggest value1`);
      }
    } finally {
      service.dispose();
    }
  });
}
