import type { CompactMessage } from './compact';
import type { Engine } from './formatting';
const numberCache = new Map<string, Intl.NumberFormat>();
const dateCache = new Map<string, Intl.DateTimeFormat>();
const pluralCache = new Map<string, Intl.PluralRules>();
function cached<T>(map: Map<string, T>, key: string, create: () => T): T {
  let value = map.get(key);
  if (!value) {
    value = create();
    if (map.size >= 100) map.delete(map.keys().next().value!);
    map.set(key, value);
  }
  return value;
}
const numberDefaults = {
  integer: { maximumFractionDigits: 0 },
  currency: { style: 'currency' },
  percent: { style: 'percent' },
};
const dateDefaults = {
  short: { month: 'numeric', day: 'numeric', year: '2-digit' },
  medium: { month: 'short', day: 'numeric', year: 'numeric' },
  long: { month: 'long', day: 'numeric', year: 'numeric' },
  full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
};
const timeDefaults = {
  short: { hour: 'numeric', minute: 'numeric' },
  medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
  long: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'short' },
  full: { hour: 'numeric', minute: 'numeric', second: 'numeric', timeZoneName: 'long' },
};
export const interpret: Engine = (message, locale, formats, values) => {
  const number = (value: number, options?: Intl.NumberFormatOptions) =>
    cached(numberCache, JSON.stringify([locale, options]), () => new Intl.NumberFormat(locale, options)).format(value);
  function render(message: CompactMessage, pound?: number): unknown[] {
    if (typeof message === 'string') return [message];
    const output: unknown[] = [];
    function append(value: unknown) {
      if (Array.isArray(value)) { for (const part of value) append(part); }
      else if (typeof value === 'string' && typeof output[output.length - 1] === 'string') {
        output[output.length - 1] += value;
      } else output.push(value);
    }
    for (const part of message) {
      if (typeof part === 'string') {
        append(part);
        continue;
      }
      const op = part[0];
      if (op === 6) {
        if (pound !== undefined) append(number(pound));
        continue;
      }
      const name = part[1];
      if (!(name in values)) throw new Error('[i18n] Missing required message parameter: ' + name);
      const value = values[name];
      if (op === 0) {
        append(typeof value === 'string' || typeof value === 'number' ? String(value) : value || '');
        continue;
      }
      if (op >= 1 && op <= 3) {
        const style = part[2] as string | Record<string, unknown> | null;
        const kind = op === 1 ? 'number' : op === 2 ? 'date' : 'time';
        const defaults = op === 1 ? numberDefaults : op === 2 ? dateDefaults : timeDefaults;
        const options = (typeof style === 'string'
          ? formats[kind]?.[style] ?? (defaults as Record<string, object>)[style]
          : style ?? (op === 3 ? timeDefaults.medium : undefined)) as Record<string, unknown> | undefined;
        if (op === 1) {
          append(number(Number(value) * (Number(options?.scale ?? 1)), options));
        } else {append(
            cached(
              dateCache,
              JSON.stringify([locale, options]),
              () => new Intl.DateTimeFormat(locale, options as Intl.DateTimeFormatOptions),
            ).format(value as Date),
          );}
      } else if (op === 4) {
        const branches = part[2];
        append(
          render(
            Object.prototype.hasOwnProperty.call(branches, String(value)) ? branches[String(value)] : branches.other,
          ),
        );
      } else if (op === 5) {
        const count = Number(value);
        const adjusted = count - part[2];
        const branches = part[4];
        const exact = '=' + count;
        const key = Object.prototype.hasOwnProperty.call(branches, exact)
          ? exact
          : cached(
            pluralCache,
            locale + ':' + part[3],
            () => new Intl.PluralRules(locale, { type: part[3] ? 'ordinal' : 'cardinal' }),
          ).select(adjusted);
        append(render(branches[key] ?? branches.other, adjusted));
      } else if (op === 7) {
        if (typeof value !== 'function') throw new TypeError('[i18n] rich tag ' + name + ' requires a handler');
        append(value(render(part[2], pound)));
      }
    }
    return output;
  }
  return render(message);
};
