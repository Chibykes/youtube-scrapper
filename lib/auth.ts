export const AUTH_COOKIE = "yt_session";

export function getAppPin(): string {
  return process.env.APP_PIN ?? "1234";
}

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me";
}
