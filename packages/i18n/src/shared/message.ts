/** Treat source line wrapping as code formatting. Use `{break}` for a rendered line break. */
export function normalizeMessage(message: string): string {
  if (!/[\r\n]/.test(message)) return message;

  return message.replace(/\r\n?/g, '\n').replace(/[ \t]*\n(?:[ \t]*\n)*[ \t]*/g, ' ').trim();
}
