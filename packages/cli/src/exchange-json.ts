// JSON.parse accepts duplicate keys. Scan its already-validated tokens to reject them,
// including escaped spellings of the same key and duplicates in nested metadata.
export function parseExchangeJson(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const stack: Array<Set<string> | null> = [];
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|[^\s{}\[\]:,]+/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === '{') stack.push(new Set());
    else if (token === '[') stack.push(null);
    else if (token === '}' || token === ']') stack.pop();
    else if (token.startsWith('"') && tokens[i + 1] === ':') {
      const key = JSON.parse(token) as string;
      const keys = stack.at(-1)!;
      if (keys?.has(key)) throw new Error(`Duplicate JSON key ${JSON.stringify(key)}`);
      keys?.add(key);
    }
  }
  return value;
}
