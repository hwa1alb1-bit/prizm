export type PasswordValidation = { ok: true } | { ok: false; reason: string }

const MIN_LENGTH = 10

export function validatePassword(value: string): PasswordValidation {
  if (value.length === 0) {
    return { ok: false, reason: 'Password is required.' }
  }
  if (value.length < MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${MIN_LENGTH} characters.` }
  }
  if (!/[A-Z]/.test(value)) {
    return { ok: false, reason: 'Password must include an uppercase letter.' }
  }
  if (!/[a-z]/.test(value)) {
    return { ok: false, reason: 'Password must include a lowercase letter.' }
  }
  if (!/\d/.test(value)) {
    return { ok: false, reason: 'Password must include a number.' }
  }
  return { ok: true }
}

export const PASSWORD_HINT = `${MIN_LENGTH}+ characters, with upper, lower, and a number.`
