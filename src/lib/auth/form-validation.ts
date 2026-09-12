export const SIGN_IN_FAILURE_MESSAGE = "Unable to sign in. Please check your email and password.";
export const REGISTRATION_FAILURE_MESSAGE = "Unable to create your account. Please try again.";

export function getRegistrationValidationError(password: string, confirmPassword: string) {
  return password === confirmPassword ? undefined : "Passwords do not match.";
}
