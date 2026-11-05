export class ApiError extends Error {
  constructor(status, data = {}) {
    super(data.message || "Something went wrong. Please try again.");
    this.name = "ApiError";
    this.status = status;
    this.code = data.code;
    this.fieldErrors = data.fieldErrors || {};
    this.requestId = data.requestId;
  }
}

async function readResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type");
  const hasJson = contentType?.includes("application/json");

  const data = hasJson ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data || {
        message: `The request failed with status ${response.status}.`,
      },
    );
  }

  return data;
}

async function getCsrfToken() {
  const response = await fetch("/api/auth/csrf", {
    method: "GET",
    credentials: "include",
  });

  return readResponse(response);
}

export async function apiRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers);

  const changesServerState = !["GET", "HEAD", "OPTIONS"].includes(method);

  try {
    if (changesServerState) {
      const csrf = await getCsrfToken();
      headers.set(csrf.headerName, csrf.token);
    }

    const response = await fetch(url, {
      ...options,
      method,
      headers,
      credentials: "include",
    });

    return await readResponse(response);
  } catch (error) {
    if (error.status === 401 && !url.startsWith("/api/auth/")) {
      window.dispatchEvent(new Event("session-expired"));
    }
    throw error;
  }
}

export function send(url, method = "POST", body) {
  return apiRequest(url, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  });
}
