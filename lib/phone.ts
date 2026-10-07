import type { Result } from "@/lib/validation";

export function normalizeUsPhone(value: unknown): Result<string> {
  if (typeof value !== "string") {
    return { ok: false, message: "Phone is required." };
  }

  const digits = value.replace(/\D/g, "");
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;

  if (national.length !== 10 || national.startsWith("0") || national.startsWith("1")) {
    return { ok: false, message: "Enter a valid 10-digit U.S. phone number." };
  }

  return { ok: true, data: `+1${national}` };
}

export function optionalUsPhone(value: unknown): Result<string> {
  if (value === undefined || value === null || value === "") return { ok: true, data: "" };
  return normalizeUsPhone(value);
}
