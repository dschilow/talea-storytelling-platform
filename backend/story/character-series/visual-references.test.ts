// @ts-ignore Bun test helpers are runtime-only in the Encore project.
import { describe, expect, test } from 'bun:test';
import type { VisualEntity } from '../storybook/illustration-stage';
import type { StorybookLlm } from '../storybook/llm';
import { StorybookSafetyBlock } from '../storybook/llm-guards';
import { prepareSeriesVisualReferences, readSeriesReferenceCandidates } from './visual-references';
import { seriesReferenceMention } from './identity';
import { generateSeriesImages, validateSeriesShots } from './pictures';
import { SERIES_POLICY } from './authoring';

const pages = [
  { order: 1, title: 'Fund', content: 'Nora hielt den roten Teddy fest.\n\nTilda legte den Teddy auf den Tisch.', paragraphs: [] },
  { order: 2, title: 'Hilfe', content: 'Tilda hob den roten Teddy aus der Kiste.\n\nNora drückte den Teddy glücklich an sich.', paragraphs: [] },
];
const proposal = (more = {}) => ({ kind: 'artifact', name: 'Teddy', aliases: ['roten Teddy'], species: 'object', isHuman: false,
  appearance: 'small red cloth teddy bear with rounded ears, no clothes', evidence: pages.map(p => ({page:p.order,quote:p.content.split('\n\n')[0]})), ...more });
const lead: VisualEntity = { id:'lead', name:'Tilda', kind:'character', role:'cast', species:'human', isHuman:true, appearance:'girl in blue overalls', forbidden:[], referenceUrl:'https://test/lead.webp' };
const hero: VisualEntity = { ...lead, id:'kid', name:'Nora', role:'hero', referenceUrl:'https://test/kid.webp' };
const response = (text: string): any => ({text,modelUsed:'test',usage:{prompt:10,completion:10,total:20,costUSD:0.001},durationMs:1});
const llmFor = (references: any[]): StorybookLlm => async request => {
  const segments = (request.user.split('FINISHED READING SEGMENTS:\n')[1] || '').split(/\n\n(?=PAGE \d+\n)/);
  return response(JSON.stringify({references:references.map(ref => ({...ref,evidence:ref.evidence.map((e: any) => {
    const segment = segments.find(s => s.includes(e.quote));
    return {...e,page:segment ? Number(segment.match(/^PAGE (\d+)/)?.[1]) : e.page};
  })}))}));
};
const prepare = (extra: Record<string, any> = {}) => prepareSeriesVisualReferences({pages,entities:[lead,hero],llm:llmFor([proposal()]), model:'test',seed:'story',
  provider:async () => ({url:'bucket://teddy',viewUrl:'https://test/teddy.webp',costUSD:0.0025}),readableReference:async url => `https://test/${url}`, ...extra});

describe('story-local references from final prose', () => {
  test('one-off, invented and duplicate claims cannot trigger portrait purchases or replace an avatar', () => {
    const valid = proposal();
    const invalid = [proposal({evidence:[valid.evidence[0]]}), proposal({evidence:[valid.evidence[0],{page:2,quote:'Dieser Teddy kam in keinem Kapitel vor.'}]}),
      proposal({existingId:'kid',name:'Nora',kind:'character'})];
    expect(readSeriesReferenceCandidates({references:invalid},pages,[lead,hero])).toEqual([]);
    expect(readSeriesReferenceCandidates({references:[valid,valid]},pages,[lead,hero])).toHaveLength(1);
    expect(seriesReferenceMention('Die Bootsbauerin wartet.',{...lead,name:'Boot'})).toBe(false);
  });

  test('one recurring object is generated once and receives one stable asset for all later pictures', async () => {
    let purchases = 0, planned = 0;
    const result = await prepare({recordCall:() => {planned++;},provider:async (request: any) => {
      purchases++; expect(request.logStage).toBe('series-image-reference'); expect(request.prompt).toContain('red cloth teddy');
      expect(request.referenceImages).toEqual([]); return {url:'bucket://teddy',viewUrl:'https://test/teddy.webp',costUSD:0.0025};
    }});
    expect(purchases).toBe(1); expect(planned).toBe(1); expect(result.calls).toBe(1); expect(result.costUSD).toBe(0.0025);
    expect(result.assets).toHaveLength(1); expect(result.assets[0]).toMatchObject({kind:'artifact',referenceKey:'bucket://teddy',referenceUrl:'https://test/teddy.webp'});
    expect(result.entities.filter(e => e.name === 'Teddy')).toHaveLength(1);
  });

  test('an existing object portrait is reused instead of being generated again', async () => {
    const teddy = {...lead,id:'teddy',name:'Teddy',kind:'artifact' as const,role:'artifact' as const,isHuman:false,species:'object',referenceUrl:'https://test/existing.webp'};
    const result = await prepare({entities:[lead,hero,teddy],provider:async () => {throw new Error('must not buy a portrait');}});
    expect(result.calls).toBe(0); expect(result.assets[0].referenceUrl).toBe(teddy.referenceUrl);
    expect(result.entities.filter(e => e.id === 'teddy')).toHaveLength(1);
  });

  test('a retained episode asset gets a fresh transport URL; an unavailable original is never redesigned', async () => {
    const old = {...lead,id:'old-teddy',name:'Teddy',kind:'artifact' as const,role:'artifact' as const,isHuman:false,species:'object',referenceUrl:undefined,referenceKey:'bucket://old'};
    for (const available of [true,false]) {
      const result = await prepare({existing:[old],llm:llmFor([proposal({existingId:old.id})]), readableReference:async () => available ? 'https://test/fresh.webp' : undefined,
        provider:async () => {throw new Error('never redraw an unavailable existing identity');}});
      expect(result.calls).toBe(0);
      expect(result.assets).toHaveLength(available ? 1 : 0);
      if (available) expect(result.assets[0]).toMatchObject({id:'old-teddy',referenceUrl:'https://test/fresh.webp',referenceKey:'bucket://old'});
      else expect(result.portraits[0].status).toBe('existing-unreadable');
    }
  });

  test('a generic name in a later story is not silently matched to a different old person', () => {
    const old = {...lead,id:'old',name:'Teddy',kind:'artifact' as const,role:'artifact' as const};
    const [current] = readSeriesReferenceCandidates({references:[proposal()]},pages,[old],{scope:'next-story',inheritedIds:new Set(['old'])});
    expect(current.entity.id).not.toBe('old');
  });

  test('an additional person repeated in the text gets one whole-figure reference without changing the text cast', async () => {
    const person = {kind:'character',name:'Papiermacherin',species:'human',isHuman:true,appearance:'elderly woman with grey braid and plain green work apron',
      evidence:[{page:1,quote:'Die Papiermacherin faltete ein Blatt.'},{page:2,quote:'Die Papiermacherin hielt das Papier hoch.'}]};
    const personPages = [1,2].map((order,i) => ({order,title:'Papier',content:person.evidence[i].quote,paragraphs:[]}));
    const result = await prepare({pages:personPages,llm:llmFor([person]),provider:async (request: any) => {
      expect(request.prompt).toContain('full body'); return {url:'bucket://person',viewUrl:'https://test/person.webp'};
    }});
    expect(result.assets[0]).toMatchObject({name:'Papiermacherin',kind:'character',role:'cast',isHuman:true});
  });

  test('a failed reference is reported, billed once, and not attached as an imaginary available portrait', async () => {
    const result = await prepare({provider:async () => ({costUSD:0.0025,refused:true,httpStatus:402})});
    expect(result.calls).toBe(1); expect(result.costUSD).toBe(0.0025); expect(result.assets).toEqual([]);
    expect(result.entities).toHaveLength(2); expect(result.portraits[0].status).toBe('failed');
  });

  test('a provider safety block is propagated once without a retry or another model', async () => {
    const block = new StorybookSafetyBlock('test','series-visual-reference-plan','SAFETY');
    let calls = 0;
    await expect(prepare({llm:async () => {calls++;throw block;}})).rejects.toBe(block);
    expect(calls).toBe(1);
  });
});

describe('objects travel with the scene without becoming people', () => {
  const teddy: VisualEntity = {...lead,id:'teddy',name:'Teddy',kind:'artifact',role:'artifact',isHuman:false,species:'object',appearance:'red cloth teddy',referenceUrl:'https://test/teddy.webp'};
  const shot = (page: number) => ({page,paragraph:1,storyQuote:pages[page - 1]?.content.split('\n\n')[0],onStage:['lead','kid'],elements:['teddy'],
    scene:'Tilda and Nora hold the Teddy between them on a quiet workshop table, their faces visible as they inspect the red fabric.',
    visualBeat:{actorId:'lead',action:'holds the red teddy',result:'the teddy rests on the table',framing:page===2?'close':'wide'}});
  test('only source-present props are attached and an object cannot fill a character slot', () => {
    const plan = validateSeriesShots({cover:shot(0),pages:[shot(1),shot(2)]},pages,[lead,hero,teddy],'lead');
    expect(plan.pages[0].elements).toEqual(['teddy']);
    const absent = {...teddy,id:'boat',name:'Boot'};
    const raw = {cover:shot(0),pages:[{...shot(1),elements:['boat']},shot(2)]};
    expect(validateSeriesShots(raw,pages,[lead,hero,teddy,absent],'lead').pages[0].elements).toEqual(['teddy']);
    expect(() => validateSeriesShots({cover:shot(0),pages:[{...shot(1),onStage:['lead','teddy']},shot(2)]},pages,[lead,hero,teddy],'lead')).toThrow();
  });

  test('each relevant image receives the same prop sheet cell; references consume the episode image budget', async () => {
    const plan = validateSeriesShots({cover:shot(0),pages:[shot(1),shot(2)]},pages,[lead,hero,teddy],'lead');
    const sheets: any[] = [], requests: any[] = [];
    const images = await generateSeriesImages({illustrations:plan,entities:[lead,hero,teddy],seed:'props',visionModel:'test',pageTexts:{1:pages[0].content,2:pages[1].content},
      reservedImageCalls:SERIES_POLICY.maxImageCalls - 3,
      buildReference:async slots => {sheets.push(slots);return {urls:['data:image/png;base64,dGVzdA=='],mode:'sprite',subjects:[]};},
      provider:async request => {requests.push(request);return {url:`https://test/${request.page}.webp`,costUSD:0.0025};},
      llm:async request => response(JSON.stringify({visibleIds:['lead','kid'],identityById:{lead:1,kid:1},sceneMatch:1,styleMatch:1,primaryActionClear:true,posing:false,defects:[]}))});
    expect(images.imageCalls).toBe(3);
    expect(sheets.every(s => s.map((cell: any) => cell.displayName).join(',') === 'Tilda,Nora,Teddy')).toBe(true);
    expect(requests.every(r => r.prompt.includes('OBJECT REFERENCES (not people'))).toBe(true);
    expect(requests.every(r => r.prompt.includes('Exactly 2 foreground characters'))).toBe(true);
    expect(images.pages.get(1)?.status).toBe('passed');
  });

  test('the chapter renderer cannot spend the calls already used by references', async () => {
    const plan = validateSeriesShots({cover:shot(0),pages:[shot(1),shot(2)]},pages,[lead,hero,teddy],'lead');
    let calls = 0;
    const images = await generateSeriesImages({illustrations:plan,entities:[lead,hero,teddy],seed:'cap',visionModel:'test',pageTexts:{},
      reservedImageCalls:SERIES_POLICY.maxImageCalls-2,buildReference:async () => ({urls:[],mode:'none',subjects:[]}),
      provider:async () => {calls++;return {url:'https://test/scene.webp'};},
      llm:async () => response(JSON.stringify({visibleIds:['lead','kid'],identityById:{lead:1,kid:1},sceneMatch:1,styleMatch:1,primaryActionClear:true,posing:false,defects:[]}))});
    expect(calls).toBe(2);
    expect(images.imageCalls).toBe(2);
    expect([images.cover,...images.pages.values()].some(outcome => outcome?.errors?.includes('series_image_budget_exhausted'))).toBe(true);
  });
});
