export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  roles: string[];
  roleNames: string[];
  permissions: string[];
  orgUnitName: string | null;
  mustChangePassword: boolean;
  passwordMinLength: number;
}
export class AuthApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function authRequest<T>(
  action: string,
  body?: object,
): Promise<T> {
  const response = await fetch("/api/auth/" + action, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok)
    throw new AuthApiError(
      Array.isArray(payload?.message)
        ? payload.message.join("; ")
        : payload?.message || "Không thể thực hiện yêu cầu.",
      response.status,
    );
  return payload as T;
}
 
