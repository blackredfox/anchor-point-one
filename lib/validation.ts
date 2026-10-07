export type Result<T> = { ok: true; data: T } | { ok: false; message: string };

export function textField(value: unknown, label: string, min: number, max: number): Result<string> {
  if (typeof value !== "string") return { ok: false, message: `${label} is required.` };
  const data = value.trim().replace(/\s+/g, " ");
  if (data.length < min || data.length > max) {
    return { ok: false, message: `${label} must be between ${min} and ${max} characters.` };
  }
  return { ok: true, data };
}

export function optionalTextField(value: unknown, label: string, max: number): Result<string> {
  if (value === undefined || value === null || value === "") return { ok: true, data: "" };
  if (typeof value !== "string") return { ok: false, message: `${label} must be text.` };
  const data = value.trim().replace(/\s+/g, " ");
  if (!data) return { ok: true, data: "" };
  if (data.length > max) return { ok: false, message: `${label} must be ${max} characters or fewer.` };
  return { ok: true, data };
}

export function emailField(value: unknown): Result<string> {
  if (typeof value !== "string") return { ok: false, message: "Email is required." };
  const data = value.trim().toLowerCase();
  if (data.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(data)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  return { ok: true, data };
}

export function optionalEmailField(value: unknown): Result<string> {
  if (value === undefined || value === null || value === "") return { ok: true, data: "" };
  return emailField(value);
}

export function choiceField<T extends string>(value: unknown, choices: readonly T[], label: string): Result<T> {
  if (typeof value !== "string" || !choices.includes(value as T)) {
    return { ok: false, message: `Choose a valid ${label}.` };
  }
  return { ok: true, data: value as T };
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
