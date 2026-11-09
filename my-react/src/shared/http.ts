interface ErrorData {
  message?: string;
  code?: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;
}
export class ApiError extends Error {
  status: number;
  code?: string;
  fieldErrors: Record<string, string>;
  requestId?: string;
  constructor(status: number, data: ErrorData = {}) {
    super(data.message || "Something went wrong. Please try again.");
    this.name = "ApiError";
    this.status = status;
    this.code = data.code;
    this.fieldErrors = data.fieldErrors || {};
    this.requestId = data.requestId;
  }
}
let activeSpaceId: number | null = null;
export const setActiveSpace = (id: number | null) => {
  activeSpaceId = id;
};
export const getActiveSpace = () => activeSpaceId;
async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return null as T;
  const data = response.headers
    .get("content-type")
    ?.includes("application/json")
    ? await response.json()
    : null;
  if (!response.ok)
    throw new ApiError(
      response.status,
      data || { message: `The request failed with status ${response.status}.` },
    );
  return data as T;
}
export async function request<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (
    activeSpaceId !== null &&
    !/^\/api\/(auth\/(login|signup|logout)|play\/)/.test(url)
  )
    headers.set("X-Space-Id", String(activeSpaceId));
  try {
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = await readResponse<{ headerName: string; token: string }>(
        await fetch("/api/auth/csrf", {
          method: "GET",
          credentials: "include",
        }),
      );
      headers.set(csrf.headerName, csrf.token);
    }
    return await readResponse<T>(
      await fetch(url, { ...options, method, headers, credentials: "include" }),
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status === 401 &&
      !url.startsWith("/api/auth/")
    )
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
}
export function send<T>(url: string, method = "POST", body?: unknown) {
  return request<T>(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}
