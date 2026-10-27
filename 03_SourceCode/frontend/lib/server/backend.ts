export const AUTH_COOKIE = "ctdt_access_token";
export function backendUrl(path: string) {
  return (
    (process.env.BACKEND_API_URL || "http://127.0.0.1:3002").replace(
      /\/$/,
      "",
    ) + path
  );
}
