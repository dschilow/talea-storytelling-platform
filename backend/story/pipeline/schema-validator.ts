import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv2020 from "ajv/dist/2020";

const ajv = new Ajv2020({ allErrors: true, strict: false });

function loadSchema(fileName: string): any {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const filePath = path.join(currentDir, "schemas", fileName);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

const canonSchema = loadSchema("canon-fusion-pipeline-v2.schema.json");
const variantSchema = loadSchema("story-variant.schema.json");

ajv.addSchema(canonSchema, "canon-fusion");
ajv.addSchema(variantSchema, "story-variant");

const validateCastSetFn = ajv.getSchema("canon-fusion#/$defs/CastSet")!;
const validateSceneDirectiveFn = ajv.getSchema("canon-fusion#/$defs/SceneDirective")!;
const validateImageSpecFn = ajv.getSchema("canon-fusion#/$defs/ImageSpec")!;
const validateVariantPlanFn = ajv.getSchema("story-variant#")!;

export function validateCastSet(value: unknown): { valid: boolean; errors: string[] } {
  const valid = validateCastSetFn(value);
  return { valid: !!valid, errors: formatErrors(validateCastSetFn.errors) };
}

export function validateSceneDirective(value: unknown): { valid: boolean; errors: string[] } {
  const valid = validateSceneDirectiveFn(value);
  return { valid: !!valid, errors: formatErrors(validateSceneDirectiveFn.errors) };
}

export function validateImageSpec(value: unknown): { valid: boolean; errors: string[] } {
  const valid = validateImageSpecFn(value);
  return { valid: !!valid, errors: formatErrors(validateImageSpecFn.errors) };
}

export function validateVariantPlan(value: unknown): { valid: boolean; errors: string[] } {
  const valid = validateVariantPlanFn(value);
  return { valid: !!valid, errors: formatErrors(validateVariantPlanFn.errors) };
}

function formatErrors(errors: Ajv2020.ErrorObject[] | null | undefined): string[] {
  if (!errors) return [];
  return errors.map(err => `${err.instancePath || "(root)"} ${err.message ?? "invalid"}`.trim());
}
