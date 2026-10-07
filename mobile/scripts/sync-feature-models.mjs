import { readFileSync, writeFileSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const header = '// AUTO-GENERATED from the web app by scripts/sync-feature-models.mjs.\n';
writeFileSync(new URL('mobile/src/lib/quizDeck.ts', root), header + readFileSync(new URL('frontend/screens/Game/quiz/quizDeck.ts', root), 'utf8'));
const tracking = readFileSync(new URL('frontend/screens/Cosmos/apiTrackingClient.ts', root), 'utf8');
const skillType = tracking.slice(tracking.indexOf('export type CosmosSkillType'), tracking.indexOf('export interface CosmosQuizAnswerDTO'));
const pureFunctions = tracking.slice(tracking.indexOf('export function inferDomainFromDokuTopic'));
if (/\b(fetch|window|document|localStorage)\b/.test(pureFunctions)) throw new Error('Cosmos model is no longer portable');
writeFileSync(new URL('mobile/src/lib/cosmosTracking.ts', root), header + skillType + pureFunctions);
for (const name of ['TaleaLearningPathTypes', 'TaleaLearningPathSeedData']) {
  writeFileSync(new URL(`mobile/src/lib/${name}.ts`, root), header + readFileSync(new URL(`frontend/screens/Journey/${name}.ts`, root), 'utf8'));
}
const segments = readFileSync(new URL('frontend/screens/Journey/hooks/useMapSegmentGenerator.ts', root), 'utf8');
const segmentModels = segments.slice(segments.indexOf('interface DokuItem'), segments.indexOf('// ─── Hook'))
  .replace('function buildDynamicSegments(', 'export function buildDynamicSegments(');
if (/\b(window|document|localStorage|useEffect|fetch)\b/.test(segmentModels)) throw new Error('Journey model is no longer portable');
writeFileSync(new URL('mobile/src/lib/journeySegments.ts', root), header + "import type { MapSegment, MapNode, MapEdge, RouteTag } from './TaleaLearningPathTypes';\n" + segmentModels);
const avatarEditor = readFileSync(new URL('frontend/screens/Avatar/EditAvatarScreen.tsx', root), 'utf8').replace(/\r\n/g, '\n');
const avatarImports = avatarEditor.slice(avatarEditor.indexOf('import {\n  AvatarVisualProfileRecord'), avatarEditor.indexOf("} from '../../types/avatarForm';") + "} from '../../types/avatarForm';".length).replace('../../types/avatarForm', '@/types/avatarForm');
let avatarFunctions = avatarEditor.slice(avatarEditor.indexOf('function parseAgeFromText'), avatarEditor.indexOf('const EditAvatarScreen:'));
for (const name of ['avatarToFormData', 'toCompleteFormData', 'getDirtyFormFields', 'formDataToBackendFormat', 'mergeAnalyzedVisualProfile']) avatarFunctions = avatarFunctions.replace(`function ${name}(`, `export function ${name}(`);
if (!avatarImports || /\b(window|document|localStorage|useEffect|fetch)\b/.test(avatarFunctions)) throw new Error('Avatar editor model is no longer portable');
writeFileSync(new URL('mobile/src/lib/avatarEditorModel.ts', root), header + avatarImports + '\n' + avatarFunctions);
