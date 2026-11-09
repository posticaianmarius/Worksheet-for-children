import { send } from "./http";
import { invalidateResources } from "./query";

/** Each feature explicitly lists the read models its writes affect. */
export function mutationSender(resources: readonly string[], context = false) {
  return async <T>(
    url: string,
    method = "POST",
    body?: unknown,
  ): Promise<T> => {
    const value = await send<T>(url, method, body);
    await invalidateResources(resources, context);
    return value;
  };
}
