export function ok(value = undefined) {
  return { ok: true, value };
}

export function err(code, message, details = undefined) {
  return { ok: false, error: { code, message, details } };
}
