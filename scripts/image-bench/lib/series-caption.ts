import { TALEA_IMAGE_STYLE } from '../../../backend/ai/image-style';
import type { RunwareReferenceRegion } from '../../../backend/ai/runware-image-model-options';
import { withoutTextNegations, wordlessLine, type VisualEntity } from '../../../backend/story/storybook/illustration-stage';
import type { IllustrationShot } from '../../../backend/story/storybook/types';
import type { SeriesVisualBeat } from '../../../backend/story/character-series/pictures';

interface CaptionInput {
  shot: Pick<IllustrationShot, 'scene'> & { visualBeat?: SeriesVisualBeat };
  identities: VisualEntity[];
  regions: RunwareReferenceRegion[];
  individualReferences?: boolean;
  regionBound?: boolean;
}

/** A scene caption and appearance-bearing regions, rather than repeated instructions about the reference sheet. */
export function seriesSceneCaption(input: CaptionInput): { prompt: string; regions: RunwareReferenceRegion[] } {
  const { shot, identities, individualReferences = false, regionBound = true } = input;
  if (identities.length !== input.regions.length) throw new Error('Jede Bildfigur braucht genau eine Referenzregion.');
  const regions = input.regions.map((region, index) => {
    const entity = identities[index];
    return {
      ...region,
      description: `${entity.name}: ${entity.appearance}.${shot.visualBeat?.actorId === entity.id ? ` In this scene, ${shot.visualBeat.action}.` : ''}`,
    };
  });
  const aliases = new Map<string, string>();
  identities.forEach((entity, index) => {
    for (const name of [entity.name, ...entity.name.split(/\s+/).filter(part => part.length >= 3 && !/^(der|die|das|graf|captain|kapitän)$/i.test(part))]) {
      const key = name.toLocaleLowerCase('de-DE');
      const token = `<${regions[index].id}>`;
      aliases.set(key, aliases.has(key) && aliases.get(key) !== token ? '' : token);
    }
  });
  const names = [...aliases].filter(([, token]) => token).map(([name]) => name)
    .sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const bind = (text: string): string => regionBound && names.length
    ? text.replace(new RegExp(`(?<![\\p{L}\\p{N}_])(?:${names.join('|')})(?![\\p{L}\\p{N}_])`, 'giu'),
      name => aliases.get(name.toLocaleLowerCase('de-DE')) || name)
    : text;
  const source = (index: number): string => {
    if (individualReferences) return `image ${index + 1}`;
    if (identities.length === 1) return 'image 1';
    return `figure ${index + 1} from the left in image 1`;
  };
  const figures = identities.map((entity, index) => (
    `${regionBound ? `<${regions[index].id}> is ` : ''}${entity.name}, the same individual as ${source(index)}: ${entity.appearance}.`
  ));
  const actor = identities.find(entity => entity.id === shot.visualBeat?.actorId);
  const moment = shot.visualBeat && actor
    ? bind(`${actor.name} ${shot.visualBeat.action}; ${shot.visualBeat.result}. ${shot.visualBeat.framing} framing.`)
    : '';
  return {
    prompt: [
      `Create a new scene. ${TALEA_IMAGE_STYLE}.`,
      bind(withoutTextNegations(shot.scene).replace(/[:;\s]+$/, '.')),
      moment,
      ...figures,
      'The references supply each individual face, hair, species and clothing. The described scene supplies their new poses, surroundings and lighting.',
      `Exactly ${identities.length} named characters appear once each in one continuous setting, with separate readable silhouettes and eyes following the action.`,
      wordlessLine(shot.scene),
    ].filter(Boolean).join(' '),
    regions: regionBound ? regions : [],
  };
}
