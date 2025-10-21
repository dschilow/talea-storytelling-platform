import { z } from 'zod';

// Valid trait IDs based on your system
export const VALID_BASE_TRAITS = [
  'courage',
  'intelligence',
  'creativity',
  'empathy',
  'strength',
  'humor',
  'adventure',
  'patience',
  'curiosity',
  'leadership',
  'teamwork',
] as const;

export const VALID_KNOWLEDGE_SUBCATEGORIES = [
  'history',
  'biology',
  'physics',
  'geography',
  'astronomy',
  'mathematics',
  'chemistry',
] as const;

// Trait ID Schema - supports base traits and knowledge.* subcategories
export const TraitIdSchema = z.union([
  z.enum(VALID_BASE_TRAITS),
  z.string().regex(/^knowledge\.(history|biology|physics|geography|astronomy|mathematics|chemistry)$/),
]);

// Personality Change Schema
export const PersonalityChangeSchema = z.object({
  trait: TraitIdSchema,
  change: z.number().int().min(-10).max(10),
});

// Chapter Image Description Schema - flexible to accept strings or objects
export const ChapterImageDescriptionSchema = z.union([
  z.string().min(10), // Accept simple string descriptions
  z.object({
    scene: z.string().min(10),
    characters: z.union([
      z.array(z.string()), // Accept array of character names
      z.record(
        z.object({
          position: z.string().optional(),
          expression: z.string().optional(),
          action: z.string().optional(),
          clothing: z.string().optional(),
        })
      ),
    ]),
    environment: z.union([
      z.string(), // Accept simple string
      z.object({
        setting: z.string().optional(),
        lighting: z.string().optional(),
        atmosphere: z.string().optional(),
        objects: z.array(z.string()).optional(),
      }),
    ]),
    composition: z.union([
      z.string(), // Accept simple string
      z.object({
        foreground: z.string().optional(),
        background: z.string().optional(),
        focus: z.string().optional(),
      }).optional(),
    ]).optional(),
  }),
]);

// Cover Image Description Schema - flexible to accept strings or objects
export const CoverImageDescriptionSchema = z.union([
  z.string().min(10), // Accept simple string descriptions
  z.object({
    mainScene: z.string().min(10),
    characters: z.union([
      z.array(z.string()), // Accept array of character names
      z.record(
        z.object({
          position: z.string().optional(),
          expression: z.string().optional(),
          pose: z.string().optional(),
        })
      ),
    ]),
    environment: z.union([
      z.string(), // Accept simple string
      z.object({
        setting: z.string().optional(),
        mood: z.string().optional(),
        colorPalette: z.array(z.string()).optional(),
      }),
    ]),
    composition: z.union([
      z.string(), // Accept simple string
      z.object({
        layout: z.string().optional(),
        titleSpace: z.string().optional(),
        visualFocus: z.string().optional(),
      }).optional(),
    ]).optional(),
  }),
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
  name: z.string().min(1),
  changedTraits: z.array(PersonalityChangeSchema).min(0),
});

// Learning Outcome Schema (optional) - flexible to accept strings or objects
export const LearningOutcomeSchema = z.union([
  z.string(), // Accept simple string descriptions
  z.object({
    subject: z.string(),
    newConcepts: z.array(z.string()),
    reinforcedSkills: z.array(z.string()),
    difficulty_mastered: z.string(),
    practical_applications: z.array(z.string()),
  }),
]);

// Complete Story Response Schema
export const StoryResponseSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  chapters: z.array(ChapterSchema).min(1).max(20),
  coverImageDescription: CoverImageDescriptionSchema,
  avatarDevelopments: z.array(AvatarDevelopmentSchema).min(0),
  learningOutcomes: z.array(LearningOutcomeSchema).optional(),
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
