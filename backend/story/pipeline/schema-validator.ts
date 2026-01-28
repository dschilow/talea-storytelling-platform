import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });

function loadSchema(fileName: string): any {
  const roots = [
    path.dirname(fileURLToPath(import.meta.url)),
    process.cwd(),
  ];
  const relativeCandidates = [
    path.join("schemas", fileName),
    path.join("story", "pipeline", "schemas", fileName),
    path.join("backend", "story", "pipeline", "schemas", fileName),
  ];

  const tried: string[] = [];
  for (const root of roots) {
    let current = root;
    for (let depth = 0; depth < 6; depth += 1) {
      for (const rel of relativeCandidates) {
        const candidate = path.join(current, rel);
        tried.push(candidate);
        if (fs.existsSync(candidate)) {
          const raw = fs.readFileSync(candidate, "utf-8");
          return JSON.parse(raw);
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  throw new Error(
    `Schema file not found: ${fileName}. Tried: ${tried.slice(0, 12).join(", ")}`
  );
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
