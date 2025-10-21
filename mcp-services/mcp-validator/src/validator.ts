import { ZodError } from 'zod';
import {
  StoryResponseSchema,
  AvatarDevelopmentSchema,
  ChapterSchema,
  type ValidationResult,
  type ValidationError,
} from './schemas.js';
import { normalizeAvatarDevelopments, normalizeTraitChanges } from './traitMapping.js';

/**
 * Convert Zod errors to readable format
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    path: err.path.map(String),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate complete story response from OpenAI
 */
export function validateStoryResponse(data: any): ValidationResult {
  try {
    // First, normalize avatar developments
    if (data.avatarDevelopments) {
      data.avatarDevelopments = normalizeAvatarDevelopments(data.avatarDevelopments);
    }

    // Validate against schema
    const validated = StoryResponseSchema.parse(data);

    return {
      isValid: true,
      normalized: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        isValid: false,
        errors: formatZodErrors(error),
      };
    }

    return {
      isValid: false,
      errors: [
        {
          path: [],
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validate avatar developments only
 */
export function validateAvatarDevelopments(developments: any[]): ValidationResult {
  try {
    // Normalize first
    const normalized = normalizeAvatarDevelopments(developments);

    // Validate each development
    const validated = normalized.map((dev) => AvatarDevelopmentSchema.parse(dev));

    return {
      isValid: true,
      normalized: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        isValid: false,
        errors: formatZodErrors(error),
      };
    }

    return {
      isValid: false,
      errors: [
        {
          path: [],
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Validate single chapter
 */
export function validateChapter(chapter: any): ValidationResult {
  try {
    const validated = ChapterSchema.parse(chapter);

    return {
      isValid: true,
      normalized: validated,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        isValid: false,
        errors: formatZodErrors(error),
      };
    }

    return {
      isValid: false,
      errors: [
        {
          path: [],
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'UNKNOWN_ERROR',
        },
      ],
    };
  }
}

/**
 * Normalize trait updates (for use in Encore backend)
 */
export function normalizeTraitUpdates(updates: Array<{ trait: string; change: number }>): ValidationResult {
  try {
    const normalized = normalizeTraitChanges(updates);

    return {
      isValid: true,
      normalized,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [
        {
          path: [],
          message: error instanceof Error ? error.message : 'Unknown validation error',
          code: 'NORMALIZATION_ERROR',
        },
      ],
    };
  }
}

/**
 * Get detailed validation report
 */
export function getValidationReport(data: any): {
  overall: boolean;
  storyStructure: boolean;
  chapters: boolean;
  avatarDevelopments: boolean;
  learningOutcomes: boolean;
  errors: ValidationError[];
  warnings: string[];
} {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Validate story structure
  const storyResult = validateStoryResponse(data);
  if (!storyResult.isValid && storyResult.errors) {
    errors.push(...storyResult.errors);
  }

  // Additional warnings
  if (data.chapters && data.chapters.length < 3) {
    warnings.push('Story has fewer than 3 chapters - recommended minimum is 3');
  }

  if (data.avatarDevelopments && data.avatarDevelopments.length === 0) {
    warnings.push('No avatar developments detected - characters should grow through stories');
  }

  // Check for missing image descriptions
  if (data.chapters) {
    data.chapters.forEach((chapter: any, index: number) => {
      if (!chapter.imageDescription) {
        errors.push({
          path: ['chapters', String(index), 'imageDescription'],
          message: 'Missing image description for chapter',
          code: 'MISSING_IMAGE_DESCRIPTION',
        });
      }
    });
  }

  return {
    overall: errors.length === 0,
    storyStructure: storyResult.isValid,
    chapters: data.chapters?.every((c: any) => validateChapter(c).isValid) ?? false,
    avatarDevelopments:
      data.avatarDevelopments?.every((d: any) =>
        validateAvatarDevelopments([d]).isValid
      ) ?? true,
    learningOutcomes: true, // Optional field
    errors,
    warnings,
  };
}
