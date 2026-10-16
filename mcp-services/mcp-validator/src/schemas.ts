import { z } from 'zod';

// The 9 base traits of the backend (backend/constants/personalityTraits.ts)
export const VALID_BASE_TRAITS = [
  'knowledge',
  'creativity',
  'vocabulary',
  'courage',
  'curiosity',
  'teamwork',
  'empathy',
  'persistence',
  'logic',
] as const;

// Trait ID Schema - a base trait or a free subcategory of one
// (knowledge.history, knowledge.dinosaurs). Subcategories are created by the AI.
export const TraitIdSchema = z.union([
  z.enum(VALID_BASE_TRAITS),
  z.string().regex(/^(knowledge|creativity|vocabulary|courage|curiosity|teamwork|empathy|persistence|logic)\.[a-z0-9_]+$/),
]);

// Personality Change Schema
export const PersonalityChangeSchema = z.object({
  trait: TraitIdSchema,
  change: z.number().int().min(-10).max(10),
  // Why the trait changed; shown to the child, so it must survive validation.
  description: z.string().optional(),
});

// Chapter Image Description Schema - extremely flexible to accept any format from OpenAI
export const ChapterImageDescriptionSchema = z.union([
  z.string().min(1), // Accept any string
  z.record(z.any()), // Accept any object structure
  z.any(), // Accept anything else as fallback
]);

// Cover Image Description Schema - extremely flexible to accept any format from OpenAI
export const CoverImageDescriptionSchema = z.union([
  z.string().min(1), // Accept any string
  z.record(z.any()), // Accept any object structure
  z.any(), // Accept anything else as fallback
]);

// Chapter Schema
export const ChapterSchema = z.object({
  title: z.string().min(3),
  content: z.string().min(50),
  order: z.number().int().min(0),
  imageDescription: ChapterImageDescriptionSchema,
});

// Avatar Development Schema
export const AvatarDevelopmentSchema = z.object({
  avatarId: z.string().optional(),
  name: z.string().min(1),
  changedTraits: z.array(PersonalityChangeSchema).min(0),
});

// Learning Outcome Schema (optional) - extremely flexible to accept any format from OpenAI
export const LearningOutcomeSchema = z.union([
  z.string(), // Accept any string
  z.record(z.any()), // Accept any object structure
  z.any(), // Accept anything else as fallback
]);

// Complete Story Response Schema
export const StoryResponseSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  chapters: z.array(ChapterSchema).min(1).max(20),
  coverImageDescription: CoverImageDescriptionSchema.nullable().optional(),
  avatarDevelopments: z.array(AvatarDevelopmentSchema).min(0),
  learningOutcomes: z.union([
    z.array(LearningOutcomeSchema),
    z.record(z.any()), // Accept object (will convert to array)
    z.null(), // Accept null explicitly
  ]).optional().nullable(),
});

// Validation Error Response
export interface ValidationError {
  path: string[];
  message: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  normalized?: any;
}
