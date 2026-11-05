import Ajv2020 from "ajv/dist/2020.js";
import type { Definition, Configuration } from "../../shared/types";
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  useDefaults: false,
  removeAdditional: false,
  coerceTypes: false,
  validateFormats: false,
});
ajv.addKeyword({ keyword: "x-image-slots", valid: true });
export function validateConfiguration(
  definition: Definition,
  configuration: Configuration,
): string | null {
  try {
    const schema = definition.configurationSchema;
    if (!schema || !Object.keys(schema).some((key) => key !== "x-image-slots"))
      return null;
    const valid = ajv.validate(schema, configuration);
    return valid
      ? null
      : (ajv.errors ?? [])
          .slice(0, 3)
          .map((error) => (error.instancePath || "/") + " " + error.message)
          .join("; ");
  } catch {
    return "This activity's configuration schema could not be checked. Please reload and try again.";
  }
}
