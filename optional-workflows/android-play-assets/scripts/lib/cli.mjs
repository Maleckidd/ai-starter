/**
 * Pulls `--name <value>` out of `args` and returns the value.
 *
 * Mutates `args`, so whatever is left can be handed to `parseSelectors`.
 */
export function takeOption(args, name) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) throw new Error(`--${name} requires a value`);
  args.splice(index, 2);
  return value;
}

export function parseSelectors(args, allowed) {
  const result = { selectors: [], locale: undefined };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--locale') {
      const value = args[++i];
      if (!value || value.startsWith('-')) throw new Error('--locale requires a value');
      if (!allowed.locales.includes(value)) throw new Error(`unknown locale: ${value}`);
      result.locale = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else if (!allowed.selectors.includes(arg)) {
      throw new Error(`unknown selector: ${arg}`);
    } else {
      result.selectors.push(arg);
    }
  }
  return result;
}
