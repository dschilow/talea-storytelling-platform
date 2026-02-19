/**
 * TaleaLearningPathSeedData.ts  –  Phase B
 * 3 Segmente: Weltraum, Freundschaft, Wetter
 */
import type { MapSegment, MapNode, NodeState, ProgressState } from './TaleaLearningPathTypes';

const SEG_SPACE: MapSegment = {
  segmentId: 'space-01', title: 'Weltraum & Sterne', index: 0,
  themeTags: ['space', 'stars'],
  recommendedDailyStops: ['sp-doku1', 'sp-quiz1', 'sp-story1'],
  edges: [
    { fromNodeId: 'sp-doku1',  toNodeId: 'sp-quiz1'   },
    { fromNodeId: 'sp-quiz1',  toNodeId: 'sp-story1'  },
    { fromNodeId: 'sp-story1', toNodeId: 'sp-mem1'    },
    { fromNodeId: 'sp-mem1',   toNodeId: 'sp-fork1'   },
    { fromNodeId: 'sp-fork1',  toNodeId: 'sp-audio1'  },
    { fromNodeId: 'sp-audio1', toNodeId: 'sp-quiz2'   },
  ],
  nodes: [
    { nodeId:'sp-doku1',  type:'DokuStop',    route:'mind',    title:'Sterne entdecken',     subtitle:'Was leuchtet da oben?',          x:50, y:8,  unlockRule:{kind:'always'},                    action:{type:'navigate',to:'/doku/create',params:{topicTags:'space,stars'}},        rewardPreview:{stamps:1} },
    { nodeId:'sp-quiz1',  type:'QuizStop',    route:'mind',    title:'Sterne-Quiz',          subtitle:'3 Fragen über den Kosmos',       x:30, y:22, unlockRule:{kind:'prevDone',nodeId:'sp-doku1'}, action:{type:'navigate',to:'/quiz',params:{tags:'space'}},                           rewardPreview:{stamps:1} },
    { nodeId:'sp-story1', type:'StoryGate',   route:'creative',title:'Reise zur Milchstraße',subtitle:'Lass dein Abenteuer beginnen!', x:65, y:36, unlockRule:{kind:'prevDone',nodeId:'sp-quiz1'}, action:{type:'navigate',to:'/story',params:{tags:'space,adventure'}},               rewardPreview:{chestPossible:true,stamps:2,label:'🎁 Truhe'} },
    { nodeId:'sp-mem1',   type:'MemoryFire',  route:'heart',   title:'Was habe ich gelernt?',subtitle:'1 Satz ins Tagebuch',           x:38, y:52, unlockRule:{kind:'prevDone',nodeId:'sp-story1'},action:{type:'sheet',content:'memory-reflection'},                                rewardPreview:{stamps:1} },
    { nodeId:'sp-fork1',  type:'Fork',        route:'courage', title:'Abzweigung',           subtitle:'Wohin führt dein Weg?',         x:55, y:66, unlockRule:{kind:'prevDone',nodeId:'sp-mem1'},  action:{type:'fork',options:[{id:'fh',label:'Herzen-Weg',icon:'❤️',routeTag:'heart',nextSegmentId:'friendship-01'},{id:'fc',label:'Mutiger Weg',icon:'🛡️',routeTag:'courage',nextSegmentId:'weather-01'}]} },
    { nodeId:'sp-audio1', type:'StudioStage', route:'creative',title:'Audio: Sonnensystem',  subtitle:'Hör 3 Minuten zu',              x:72, y:80, unlockRule:{kind:'prevDone',nodeId:'sp-fork1'}, action:{type:'navigate',to:'/doku',params:{mode:'audio',tags:'space'}},              rewardPreview:{stamps:1} },
    { nodeId:'sp-quiz2',  type:'QuizStop',    route:'mind',    title:'Experten-Quiz',        subtitle:'Alle 5 beantworten?',           x:40, y:92, unlockRule:{kind:'prevDone',nodeId:'sp-audio1'},action:{type:'navigate',to:'/quiz',params:{tags:'space,expert'}},                   rewardPreview:{stamps:2} },
  ],
};

const SEG_FRIENDSHIP: MapSegment = {
  segmentId: 'friendship-01', title: 'Freundschaft & Zusammenhalt', index: 1,
  themeTags: ['friendship', 'emotions'],
  recommendedDailyStops: ['fr-doku1', 'fr-story1'],
  edges: [
    { fromNodeId:'fr-doku1',  toNodeId:'fr-quiz1'  },
    { fromNodeId:'fr-quiz1',  toNodeId:'fr-story1' },
    { fromNodeId:'fr-story1', toNodeId:'fr-mem1'   },
    { fromNodeId:'fr-mem1',   toNodeId:'fr-audio1' },
    { fromNodeId:'fr-audio1', toNodeId:'fr-fork1'  },
  ],
  nodes: [
    { nodeId:'fr-doku1',  type:'DokuStop',    route:'heart',   title:'Was ist Freundschaft?',subtitle:'Lies und entdecke',          x:45, y:8,  unlockRule:{kind:'always'},                     action:{type:'navigate',to:'/doku/create',params:{topicTags:'friendship,emotions'}}, rewardPreview:{stamps:1} },
    { nodeId:'fr-quiz1',  type:'QuizStop',    route:'heart',   title:'Freundschafts-Quiz',   subtitle:'Wer ist ein guter Freund?',  x:65, y:24, unlockRule:{kind:'prevDone',nodeId:'fr-doku1'},  action:{type:'navigate',to:'/quiz',params:{tags:'friendship'}},                      rewardPreview:{stamps:1} },
    { nodeId:'fr-story1', type:'StoryGate',   route:'creative',title:'Die beste Freundin',   subtitle:'Abenteuer in der Schule',    x:38, y:40, unlockRule:{kind:'prevDone',nodeId:'fr-quiz1'},  action:{type:'navigate',to:'/story',params:{tags:'friendship,school'}},              rewardPreview:{chestPossible:true,stamps:2,label:'🎁 Badge'} },
    { nodeId:'fr-mem1',   type:'MemoryFire',  route:'heart',   title:'Mein bester Moment',   subtitle:'Schreib ins Tagebuch',       x:58, y:58, unlockRule:{kind:'prevDone',nodeId:'fr-story1'}, action:{type:'sheet',content:'memory-reflection'},                                rewardPreview:{stamps:1} },
    { nodeId:'fr-audio1', type:'StudioStage', route:'heart',   title:'Streiten & Versöhnen', subtitle:'Hör die Geschichte',         x:35, y:74, unlockRule:{kind:'prevDone',nodeId:'fr-mem1'},   action:{type:'navigate',to:'/doku',params:{mode:'audio',tags:'friendship'}},         rewardPreview:{stamps:1} },
    { nodeId:'fr-fork1',  type:'Fork',        route:'courage', title:'Welcher Weg?',         subtitle:'Nächster Schritt',           x:55, y:90, unlockRule:{kind:'prevDone',nodeId:'fr-audio1'}, action:{type:'fork',options:[{id:'fc',label:'Kreativ weiter',icon:'🎨',routeTag:'creative',nextSegmentId:'weather-01'},{id:'fm',label:'Mehr Wissen',icon:'🧠',routeTag:'mind',nextSegmentId:'space-01'}]} },
  ],
};

const SEG_WEATHER: MapSegment = {
  segmentId: 'weather-01', title: 'Wetter & Natur', index: 2,
  themeTags: ['weather', 'nature', 'science'],
  recommendedDailyStops: ['we-doku1', 'we-quiz1'],
  edges: [
    { fromNodeId:'we-doku1',  toNodeId:'we-quiz1'  },
    { fromNodeId:'we-quiz1',  toNodeId:'we-story1' },
    { fromNodeId:'we-story1', toNodeId:'we-mem1'   },
    { fromNodeId:'we-mem1',   toNodeId:'we-audio1' },
  ],
  nodes: [
    { nodeId:'we-doku1',  type:'DokuStop',    route:'mind',    title:'Wie entsteht Regen?',   subtitle:'Der Wasserkreislauf',       x:50, y:8,  unlockRule:{kind:'always'},                     action:{type:'navigate',to:'/doku/create',params:{topicTags:'weather,nature'}},      rewardPreview:{stamps:1} },
    { nodeId:'we-quiz1',  type:'QuizStop',    route:'mind',    title:'Wolken-Quiz',           subtitle:'Erkenne Wolkentypen',       x:32, y:26, unlockRule:{kind:'prevDone',nodeId:'we-doku1'},  action:{type:'navigate',to:'/quiz',params:{tags:'weather'}},                         rewardPreview:{stamps:1} },
    { nodeId:'we-story1', type:'StoryGate',   route:'creative',title:'Das große Gewitter',    subtitle:'Mut bei Sturm und Blitz',   x:62, y:44, unlockRule:{kind:'prevDone',nodeId:'we-quiz1'},  action:{type:'navigate',to:'/story',params:{tags:'weather,adventure'}},              rewardPreview:{chestPossible:true,stamps:2,label:'🎁 Truhe'} },
    { nodeId:'we-mem1',   type:'MemoryFire',  route:'heart',   title:'Mein Lieblingswetter',  subtitle:'Ein Satz fürs Tagebuch',    x:42, y:62, unlockRule:{kind:'prevDone',nodeId:'we-story1'}, action:{type:'sheet',content:'memory-reflection'},                                rewardPreview:{stamps:1} },
    { nodeId:'we-audio1', type:'StudioStage', route:'creative',title:'Audio: Der Sturm',      subtitle:'Naturgeräusche & Story',    x:58, y:80, unlockRule:{kind:'prevDone',nodeId:'we-mem1'},   action:{type:'navigate',to:'/doku',params:{mode:'audio',tags:'weather,nature'}},     rewardPreview:{stamps:1} },
  ],
};

export const SEED_SEGMENTS: MapSegment[] = [SEG_SPACE, SEG_FRIENDSHIP, SEG_WEATHER];

/** Berechnet locked/available/done für alle Nodes eines Segments */
export function computeNodeStates(
  segment: MapSegment,
  progress: Pick<ProgressState, 'doneNodeIds' | 'inventoryArtifacts' | 'quizResultsById'>,
): { segment: MapSegment; nodesWithState: Array<{ node: MapNode; state: NodeState }> } {
  const done = new Set(progress.doneNodeIds);
  const nodesWithState = segment.nodes.map((node) => {
    if (done.has(node.nodeId)) return { node, state: 'done' as NodeState };
    const rule = node.unlockRule;
    let unlocked = false;
    switch (rule.kind) {
      case 'always':     unlocked = true; break;
      case 'prevDone':   unlocked = done.has(rule.nodeId); break;
      case 'quizScore':  { const r = progress.quizResultsById[rule.quizId]; unlocked = r ? r.correctCount >= rule.minCorrect : false; break; }
      case 'hasArtifact':unlocked = progress.inventoryArtifacts.some((a) => a.id === rule.artifactId); break;
      case 'doneCount':  unlocked = segment.nodes.filter((n) => done.has(n.nodeId)).length >= rule.min; break;
    }
    return { node, state: (unlocked ? 'available' : 'locked') as NodeState };
  });
  return { segment, nodesWithState };
}

