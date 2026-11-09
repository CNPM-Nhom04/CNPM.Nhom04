interface OriginRequest {
  headers: Pick<Headers, "get">;
  nextUrl: { origin: string };
}

function originOf(value: string | null): string | null {
  if (!value || value === "null") return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

/** Explicit public origins take precedence over internal URLs and proxy headers. */
export function hasTrustedOrigin(
  request: OriginRequest,
  config: { appOrigin?: string; trustedOrigins?: string } = {
    appOrigin: process.env.APP_ORIGIN,
    trustedOrigins: process.env.TRUSTED_ORIGINS,
  },
): boolean {
  const origin = originOf(request.headers.get("origin"));
  if (!origin) return false;
  const configured = [config.appOrigin, config.trustedOrigins].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  if (configured.length) {
    return configured
      .flatMap((value) => value.split(","))
      .some((value) => originOf(value.trim()) === origin);
  }
  if (origin === originOf(request.nextUrl.origin)) return true;
  // Next.js can normalize 127.0.0.1 to localhost internally. Only direct
  // loopback hosts get this fallback; forwarded hosts/protocols are not trusted.
  const host = request.headers.get("host");
  if (!host || /[\s/@?#\\]/.test(host)) return false;
  try {
    const actual = new URL(
      `${new URL(request.nextUrl.origin).protocol}//${host}`,
    );
    return (
      ["localhost", "127.0.0.1", "[::1]"].includes(actual.hostname) &&
      actual.origin === origin
    );
  } catch {
    return false;
  }
}
