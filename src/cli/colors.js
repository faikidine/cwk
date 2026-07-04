/**
 * Minimal ANSI colors. Disabled automatically when stdout is not a
 * terminal or when NO_COLOR is set, so piped/JSON output stays clean.
 */
const enabled = process.stdout.isTTY === true && !('NO_COLOR' in process.env);

const wrap = (code) => (text) => (enabled ? `\x1b[${code}m${text}\x1b[0m` : String(text));

export const bold = wrap('1');
export const dim = wrap('2');
export const red = wrap('31');
export const green = wrap('32');
export const yellow = wrap('33');
export const cyan = wrap('36');
