import remapping from '@jridgewell/remapping';
import { transform } from '../compiler';
import { loadOptions } from './options';

export default function loader(this: any, code: string, inputMap: unknown) {
  this.cacheable?.();
  const options = loadOptions(this.getOptions?.() ?? {}, this.rootContext);

  if (options.configFile) this.addDependency(options.configFile);
  if (this.resourcePath.endsWith('.jsonl')) {
    this.callback(null, 'export default ' + JSON.stringify(code));

    return;
  }

  const result = options.compiled ? transform(code, { filename: this.resourcePath, ...options }) : null;
  this.callback(
    null,
    result?.code ?? code,
    result?.map && inputMap ? remapping([result.map as any, inputMap as any], () => null) : result?.map ?? inputMap,
  );
}
