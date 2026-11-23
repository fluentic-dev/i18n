import remapping from '@jridgewell/remapping';
import { createTransformFilter } from './filter';
import { transform } from './index';
import { loadOptions } from './options';

export default function loader(this: any, code: string, inputMap: unknown) {
  this.cacheable?.();
  const options = loadOptions(this.getOptions?.() ?? {}, this.rootContext);

  if (options.configFile) this.addDependency(options.configFile);

  const result = createTransformFilter(options)(this.resourcePath)
    ? transform(code, { ...options, filename: this.resourcePath })
    : null;
  this.callback(
    null,
    result?.code ?? code,
    result?.map && inputMap ? remapping([result.map as any, inputMap as any], () => null) : result?.map ?? inputMap,
  );
}
