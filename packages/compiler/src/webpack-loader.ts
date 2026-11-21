import remapping from '@jridgewell/remapping';
import { transform } from './index';
import { loadOptions } from './options';

export default function loader(this: any, code: string, inputMap: unknown) {
  this.cacheable?.();
  const options = loadOptions(this.getOptions?.() ?? {}, this.rootContext);

  if (options.configFile) this.addDependency(options.configFile);

  const result = transform(code, { filename: this.resourcePath, ...options });
  this.callback(
    null,
    result?.code ?? code,
    result?.map && inputMap ? remapping([result.map as any, inputMap as any], () => null) : result?.map ?? inputMap,
  );
}
