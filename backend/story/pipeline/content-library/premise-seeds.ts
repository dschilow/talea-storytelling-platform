/**
 * Original Premise Seed Library
 *
 * These are NOT finished stories, fairy-tale templates, or Story/Fairy DNA.
 * They are high-concept children's-book sparks: concrete object/place + funny
 * rule + suspense pressure + emotional cost + memorable final-image potential.
 *
 * The Dev Mode idea lab uses a small rotating subset as launchpads, then asks
 * the LLM to mutate them heavily before any blueprint/prose is written.
 */

export type PremiseSeedCluster =
  | "school-comedy"
  | "domestic-magic"
  | "object-mischief"
  | "tiny-world"
  | "time-rule"
  | "social-mystery"
  | "creature-comedy"
  | "journey-place";

export type PremiseSeedAgeBand = "3-5" | "6-8" | "9-12";

export interface PremiseSeedCard {
  id: string;
  title: string;
  cluster: PremiseSeedCluster;
  ageBands: ReadonlyArray<PremiseSeedAgeBand>;
  genreSignals: ReadonlyArray<string>;
  settingSignals: ReadonlyArray<string>;
  keyMotifs: ReadonlyArray<string>;
  tags: ReadonlyArray<string>;
  baseStrength: number;
  artifactAffinity?: boolean;
  shelfHook: string;
  centralObjectOrPlace: string;
  wonderRule: string;
  comicEngine: string;
  suspenseEngine: string;
  emotionalEngine: string;
  personalCost: string;
  irreversibleMiddle: string;
  antagonistPressure: string;
  finalImage: string;
  mutationAxes: ReadonlyArray<string>;
  // ── Execution scaffolding (optional, additive) ──────────────────────────
  // These fields let a seed carry concrete *execution* guidance, not just
  // pitch material. When present, the dev-mode prompt builder surfaces them
  // to the drafting model so the resulting story actually exercises the
  // seed's wonder-rule, comic engine, and personal cost.
  //
  // All fields are optional — legacy seeds keep working unchanged.
  /** Toy-like operational rule the wonderRule must always honor (cause/effect). */
  toyeticRule?: string;
  /** Wrong fixes the children try first (sets up false attempts / complications). */
  wrongFixes?: ReadonlyArray<string>;
  /** Concrete tests the children run on the rule (visible cause→effect beats). */
  ruleTests?: ReadonlyArray<string>;
  /** Irreversible-middle options — pick one when drafting. */
  irreversibleMiddleOptions?: ReadonlyArray<string>;
  /** Personal-cost options anchored to a tangible, named object. */
  personalCostOptions?: ReadonlyArray<string>;
  /** Humor engine notes (timing, recurring gag, comic POV). */
  humorEngine?: string;
  /** Per-character voice / iconic dialogue opportunities. */
  voiceOpportunities?: ReadonlyArray<string>;
  /** Final-action options — the child's last visible choice in the finale. */
  finalActionOptions?: ReadonlyArray<string>;
  /** Anti-patterns: things the drafting model must NOT do for this seed. */
  antiPatterns?: ReadonlyArray<string>;
}

export interface SelectedPremiseSeedCard extends PremiseSeedCard {
  score: number;
  matchReasons: string[];
  recentOverlap: number;
  hardAvoidHits: string[];
}

export interface PremiseSeedSelectionInput {
  genre?: string;
  setting?: string;
  ageGroup?: string;
  length?: string;
  customPrompt?: string;
  noveltySeed?: string;
  creativeLane?: string;
  emotionalEngine?: string;
  wonderMechanic?: string;
  keyMomentLens?: string;
  hardAvoidMotifs?: ReadonlyArray<string>;
  recentStoryTexts?: ReadonlyArray<string>;
  matchedArtifactName?: string;
  round?: number;
}

export const PREMISE_SEED_LIBRARY: ReadonlyArray<PremiseSeedCard> = [
  {
    id: "ps-001-homework-that-cheats-back",
    title: "Die Hausaufgabe, die zurückschummelte",
    cluster: "school-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "schule", "comedy", "komödie", "magic", "magisch"],
    settingSignals: ["classroom", "schule", "kinderzimmer", "desk", "schreibtisch"],
    keyMotifs: ["homework", "paper", "answers", "classroom", "mistake"],
    tags: ["comic escalation", "school pressure", "mistake becomes tool", "anti-shortcut"],
    baseStrength: 9.4,
    shelfHook: "A homework sheet starts filling itself in — but it answers every question with embarrassing honesty.",
    centralObjectOrPlace: "a worksheet whose lines wriggle like tiny impatient worms",
    wonderRule: "It completes any task instantly, but every shortcut writes one hidden truth out loud somewhere in school.",
    comicEngine: "The sheet is smug, literal, and terrible at understanding child logic; it proudly writes things like 'because I panicked'.",
    suspenseEngine: "Each wrong shortcut spreads to a bigger part of the classroom until the child risks a public confession.",
    emotionalEngine: "Wanting to look clever without admitting fear of failing.",
    personalCost: "The child must give up the perfect-looking answer and show the messy first try.",
    irreversibleMiddle: "The sheet copies itself onto the blackboard with a truth nobody can erase yet.",
    antagonistPressure: "A perfectionist object that believes neat answers matter more than brave thinking.",
    finalImage: "The class proudly displays the crossed-out, repaired answer that saved the day.",
    mutationAxes: ["swap school subject", "change the public-truth location", "make the object a notebook, ruler, or pencil case", "shift fear from grades to friendship"],
  },
  {
    id: "ps-002-umbrella-opens-indoors",
    title: "Der Regenschirm, der nur drinnen aufging",
    cluster: "domestic-magic",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["magic", "magical", "magisch", "fantasy", "family"],
    settingSignals: ["hallway", "flur", "school", "schule", "home", "zuhause"],
    keyMotifs: ["umbrella", "rain", "hallway", "indoors", "weather"],
    tags: ["visual chaos", "weather comedy", "small bravery", "rule reversal"],
    baseStrength: 9.2,
    artifactAffinity: true,
    shelfHook: "An umbrella refuses to open in the rain, but indoors it creates tiny storms with moods.",
    centralObjectOrPlace: "a yellow umbrella with a handle shaped like a worried duck",
    wonderRule: "It opens only under a roof; the weather it makes matches the feeling someone is hiding.",
    comicEngine: "Tiny indoor weather overreacts: a drizzle over a guilty chair, thunder in a lunchbox, fog around a sulking shoe.",
    suspenseEngine: "A secret feeling becomes a storm that may flood the important room unless named honestly.",
    emotionalEngine: "Being embarrassed by big feelings and trying to pretend they are not there.",
    personalCost: "The child must admit the feeling first, before helping anyone else with theirs.",
    irreversibleMiddle: "The hallway becomes a puddle-map of every hidden mood in the building.",
    antagonistPressure: "A cheerful object that thinks feelings are safer when made visible all at once.",
    finalImage: "Everyone walks through a last warm sunbeam indoors, carrying dry umbrellas outside.",
    mutationAxes: ["change weather to colors or sounds", "move from school to apartment building", "make the umbrella proud or shy", "tie the storm to apology, jealousy, or homesickness"],
  },
  {
    id: "ps-003-lost-and-found-that-loses",
    title: "Die Fundsache, die Dinge absichtlich verlor",
    cluster: "social-mystery",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["mystery", "school", "detective", "rätsel", "abenteuer"],
    settingSignals: ["lost and found", "fundkiste", "school", "schule", "library", "bibliothek"],
    keyMotifs: ["lost-and-found", "box", "missing", "objects", "clues"],
    tags: ["comic mystery", "object empathy", "detective clues", "belonging"],
    baseStrength: 9.5,
    shelfHook: "The lost-and-found box is secretly losing things again because it does not want to be emptied and forgotten.",
    centralObjectOrPlace: "a dented lost-and-found box with labels that rewrite themselves",
    wonderRule: "Anything placed inside returns only when someone remembers why it mattered to its owner.",
    comicEngine: "The box is dramatic, needy, and keeps disguising socks as 'rare striped snakes'.",
    suspenseEngine: "A crucial object vanishes before an event, and every clue points to an object with feelings.",
    emotionalEngine: "Wanting to be needed, even if that means causing trouble.",
    personalCost: "The child must return something they secretly hoped nobody would claim.",
    irreversibleMiddle: "The box swallows the entire label system; nobody can prove what belongs to whom.",
    antagonistPressure: "Loneliness wearing the mask of theft: the box hoards stories, not objects.",
    finalImage: "A new shelf called 'found stories' stands empty on purpose, ready for the next owner.",
    mutationAxes: ["make the container a locker, suitcase, or library cart", "change the missing object", "turn clues into smells, stickers, or tiny notes", "shift owner conflict from envy to guilt"],
  },
  {
    id: "ps-004-book-refuses-ending",
    title: "Das Buch, das sein Ende versteckte",
    cluster: "object-mischief",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["library", "book", "fantasy", "magical", "adventure"],
    settingSignals: ["library", "bibliothek", "bedroom", "bookshop", "bücherei"],
    keyMotifs: ["book", "ending", "pages", "bookmark", "library"],
    tags: ["meta mystery", "page-turn suspense", "ending earned", "reader pull"],
    baseStrength: 9.3,
    shelfHook: "A library book hides its ending because it thinks the reader is skipping the important scary bit.",
    centralObjectOrPlace: "a book whose last page keeps folding itself into smaller and smaller doors",
    wonderRule: "The ending appears only after the child completes the choice the hero inside keeps avoiding.",
    comicEngine: "The book interrupts with fussy footnotes, offended page numbers, and a bookmark that acts like a tiny traffic guard.",
    suspenseEngine: "The missing ending starts pulling real-world objects into the margins as clues.",
    emotionalEngine: "Wanting the happy ending without facing the hard middle.",
    personalCost: "The child must stop being a spectator and risk making the wrong choice for the character.",
    irreversibleMiddle: "A chapter escapes into the room and cannot be pushed back into the book unchanged.",
    antagonistPressure: "A protective book that mistakes suspense for danger and locks away growth.",
    finalImage: "The last page opens wide, but now it has one new sentence in the child's handwriting.",
    mutationAxes: ["change book genre", "make the missing part a map, recipe, or comic panel", "turn footnotes into riddles", "move from library to family attic"],
  },
  {
    id: "ps-005-birthday-cake-stage-fright",
    title: "Die Geburtstagstorte mit Lampenfieber",
    cluster: "domestic-magic",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["birthday", "party", "family", "comedy", "magic"],
    settingSignals: ["kitchen", "küche", "birthday", "party", "home", "zuhause"],
    keyMotifs: ["cake", "birthday", "candles", "party", "stage fright"],
    tags: ["party countdown", "performance anxiety", "food comedy", "warm chaos"],
    baseStrength: 9.1,
    shelfHook: "The birthday cake gets stage fright and keeps hiding its candles in impossible places.",
    centralObjectOrPlace: "a wobbly cake with icing cheeks that blush pinker every minute",
    wonderRule: "The candles light only when the cake hears a wish that is for someone else.",
    comicEngine: "The cake misinterprets compliments, practices bows, and leaves frosting footprints while trying to escape attention.",
    suspenseEngine: "The party countdown keeps shrinking while the candles scatter through the house.",
    emotionalEngine: "Wanting a perfect celebration but learning to notice another nervous heart.",
    personalCost: "The child gives up the biggest birthday wish to help the cake feel safe.",
    irreversibleMiddle: "One candle melts into the table and starts timing the party out loud.",
    antagonistPressure: "Expectation itself: everyone wants the moment to be perfect, so nothing can relax.",
    finalImage: "A crooked, brave cake glows with one shared candle and a room full of tiny wishes.",
    mutationAxes: ["swap cake for costume, song, or school presentation", "change countdown event", "make the nervous object overconfident instead", "tie cost to sharing spotlight"],
  },
  {
    id: "ps-006-queue-grows-when-complained-at",
    title: "Die Schlange, die bei jedem Meckern länger wurde",
    cluster: "social-mystery",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["comedy", "school", "social", "market", "realistic magic"],
    settingSignals: ["queue", "line", "market", "school", "museum", "bus stop"],
    keyMotifs: ["queue", "waiting", "complaining", "line", "patience"],
    tags: ["social comedy", "rule escalation", "public pressure", "patience without preaching"],
    baseStrength: 9.0,
    shelfHook: "A queue becomes physically longer every time someone complains — and the child is the first to notice why.",
    centralObjectOrPlace: "a line on the floor that quietly grows extra loops behind people's backs",
    wonderRule: "Complaints add steps; helpful actions remove steps, but only if nobody brags about them.",
    comicEngine: "The queue coils through ridiculous places: coat racks, under tables, around a very offended plant.",
    suspenseEngine: "The important turn at the front may vanish if the queue reaches the door before closing time.",
    emotionalEngine: "Wanting fairness while discovering that being right can still make things worse.",
    personalCost: "The child must quietly help someone who cut ahead instead of proving they were wrong.",
    irreversibleMiddle: "The queue loops around the child, making them both first and last until they choose differently.",
    antagonistPressure: "Collective impatience becomes a physical maze.",
    finalImage: "The shortest line is a circle of kids passing one small help forward.",
    mutationAxes: ["move to cafeteria, zoo, ticket booth, or bathroom line", "change complaints into sighs or eye-rolls", "make the rule reward jokes", "shift cost from fairness to pride"],
  },
  {
    id: "ps-007-monster-afraid-of-socks",
    title: "Das Monster, das Angst vor Socken hatte",
    cluster: "creature-comedy",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["monster", "bedtime", "comedy", "family", "fantasy"],
    settingSignals: ["bedroom", "kinderzimmer", "bed", "closet", "schrank"],
    keyMotifs: ["monster", "bed", "socks", "night", "fear"],
    tags: ["fear reversal", "bedtime comedy", "gentle suspense", "monster empathy"],
    baseStrength: 9.3,
    shelfHook: "The monster under the bed is not scary; it is terrified of the child's socks, and tonight the socks are missing.",
    centralObjectOrPlace: "the dark stripe under the bed where a tiny helmeted monster keeps a sock-warning chart",
    wonderRule: "The monster grows braver when someone names a silly fear, but shrinks when everyone pretends to be fearless.",
    comicEngine: "The monster treats socks like wild animals and whispers survival tips that make no sense.",
    suspenseEngine: "A mysterious sock trail leads toward a place both child and monster are afraid to enter.",
    emotionalEngine: "Learning that fear becomes smaller when shared, not mocked.",
    personalCost: "The child admits one fear they usually hide behind jokes.",
    irreversibleMiddle: "The monster accidentally becomes big enough for everyone to see, but still squeaks at a sock puppet.",
    antagonistPressure: "A rumor about what is 'too babyish' to fear.",
    finalImage: "Child and monster hang a brave sock flag under the bed.",
    mutationAxes: ["swap socks for broccoli, balloons, or vacuum cleaner", "move from under bed to closet or bath mat", "make monster bossy or scholarly", "change final flag/object"],
  },
  {
    id: "ps-008-backpack-packs-feelings",
    title: "Der Rucksack, der Gefühle einpackte",
    cluster: "school-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "emotional", "magic", "friendship"],
    settingSignals: ["school", "classroom", "bus", "hallway", "rucksack"],
    keyMotifs: ["backpack", "feelings", "heavy", "school", "secret"],
    tags: ["emotional object", "weight metaphor", "friendship tension", "visual escalation"],
    baseStrength: 9.4,
    artifactAffinity: true,
    shelfHook: "A backpack starts packing hidden feelings as real objects until it becomes too heavy to lift.",
    centralObjectOrPlace: "a backpack whose zippers whisper and whose pockets keep growing new labels",
    wonderRule: "Every feeling the child refuses to name turns into a strange school object inside the bag.",
    comicEngine: "Jealousy becomes squeaky gym shoes; guilt becomes a lunchbox that keeps clearing its throat.",
    suspenseEngine: "The bag may burst open in front of everyone at the worst possible moment.",
    emotionalEngine: "Trying to stay cool while carrying too much alone.",
    personalCost: "The child must unpack one private feeling in front of the friend it affects.",
    irreversibleMiddle: "The backpack opens by itself and one object rolls to the person it belongs to.",
    antagonistPressure: "The bag is not evil; it is aggressively organized and refuses emotional clutter.",
    finalImage: "The backpack is lighter, with one pocket left open for honest worries.",
    mutationAxes: ["swap backpack for lunchbox, coat, suitcase, or toy chest", "change feelings into animals, colors, or weather", "move conflict from friendship to sibling", "make the bag overly polite or grumpy"],
  },
  {
    id: "ps-009-elevator-to-yesterdays-mistake",
    title: "Der Aufzug zu gestern daneben",
    cluster: "time-rule",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["time", "mystery", "adventure", "magic", "emotional"],
    settingSignals: ["apartment", "wohnhaus", "elevator", "aufzug", "hotel", "mall"],
    keyMotifs: ["elevator", "yesterday", "mistake", "buttons", "time"],
    tags: ["time loop small", "mistake repair", "choice pressure", "contained setting"],
    baseStrength: 9.2,
    shelfHook: "An old elevator has a button for yesterday's mistake — but it only lets you change what you are willing to admit.",
    centralObjectOrPlace: "a rattly elevator with one button labeled 'Oops' in pencil",
    wonderRule: "It returns to the exact minute of a mistake, but each trip removes one excuse the child can use later.",
    comicEngine: "The elevator announces floors like a disappointed aunt and plays tiny apology music.",
    suspenseEngine: "Only three rides are possible before the elevator chooses the version of yesterday itself.",
    emotionalEngine: "Wanting to fix consequences without owning the choice that caused them.",
    personalCost: "The child must keep the embarrassing memory instead of erasing it.",
    irreversibleMiddle: "A changed yesterday creates a funnier but worse new problem in today.",
    antagonistPressure: "A machine that sells do-overs as if they were snacks.",
    finalImage: "The child leaves the 'Oops' button unpressed and uses the stairs to apologize.",
    mutationAxes: ["change elevator to bus, drawer, slide, or photo booth", "limit rides by coins or courage", "change mistake type", "move final image to ordinary action"],
  },
  {
    id: "ps-010-sneezing-garden-gnome",
    title: "Der Gartenzwerg, der den Garten verniest hat",
    cluster: "domestic-magic",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["garden", "family", "comedy", "magic", "outdoor"],
    settingSignals: ["garden", "garten", "yard", "allotment", "park"],
    keyMotifs: ["garden gnome", "sneeze", "garden", "plants", "allergy"],
    tags: ["slapstick", "garden chaos", "caregiving", "visual transformations"],
    baseStrength: 8.9,
    shelfHook: "A garden gnome sneezes so hard that plants swap places, jobs, and personalities.",
    centralObjectOrPlace: "a red-hatted garden gnome with moss in his mustache",
    wonderRule: "Every sneeze moves something living to where it secretly wishes to be.",
    comicEngine: "Carrots act important in flowerpots; roses demand raincoats; worms file complaints.",
    suspenseEngine: "One more sneeze could move the whole garden into the neighbor's yard before visitors arrive.",
    emotionalEngine: "Trying to control a messy situation instead of listening to what each part needs.",
    personalCost: "The child gives up the neat plan and lets the garden become usefully imperfect.",
    irreversibleMiddle: "The vegetable patch marches into the path and blocks the only gate.",
    antagonistPressure: "A tiny guardian who believes order means everyone staying exactly where assigned.",
    finalImage: "The garden is crooked, thriving, and labeled with jokes only the child understands.",
    mutationAxes: ["swap gnome for scarecrow, watering can, or balcony plant", "change sneezes to hiccups", "move setting to school garden", "tie cost to control/perfection"],
  },
  {
    id: "ps-011-chair-swaps-jobs",
    title: "Der Stuhl, der Berufe tauschte",
    cluster: "object-mischief",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["comedy", "school", "family", "magic", "role reversal"],
    settingSignals: ["classroom", "school", "kitchen", "office", "stuhl", "chair"],
    keyMotifs: ["chair", "job", "swap", "grown-up", "responsibility"],
    tags: ["role reversal", "adult world comedy", "responsibility", "identity"],
    baseStrength: 9.0,
    shelfHook: "Whoever sits on the chair gets the last person's job — including all the tiny impossible duties nobody mentioned.",
    centralObjectOrPlace: "a wooden chair with carved names that rearrange when nobody looks",
    wonderRule: "The chair swaps duties, not skills; you inherit the problem before you inherit the confidence.",
    comicEngine: "A child must handle absurd grown-up micro-tasks while adults discover how hard being small is.",
    suspenseEngine: "The wrong person may sit down before the swap is undone, multiplying the chaos.",
    emotionalEngine: "Wanting respect without understanding the hidden work behind it.",
    personalCost: "The child must return the power after finally being listened to.",
    irreversibleMiddle: "The chair writes the child's name into the duty list, making the swap official until one task is completed honestly.",
    antagonistPressure: "The chair rewards complaining by handing over exactly what was complained about.",
    finalImage: "Everyone stands for a moment and thanks the empty chair before choosing their own seats.",
    mutationAxes: ["swap chair for hat, badge, shoes, or apron", "change job environment", "make the swap emotional rather than practical", "tie final task to listening"],
  },
  {
    id: "ps-012-pocket-weather-bureau",
    title: "Das Taschenwetteramt",
    cluster: "domestic-magic",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["weather", "adventure", "school", "magic", "comedy"],
    settingSignals: ["pocket", "school", "home", "playground", "park"],
    keyMotifs: ["weather", "pocket", "forecast", "cloud", "mood"],
    tags: ["tiny authority", "weather jokes", "forecast suspense", "control vs trust"],
    baseStrength: 9.1,
    artifactAffinity: true,
    shelfHook: "A pocket-sized weather bureau predicts the child's day — then starts changing the forecast to feel important.",
    centralObjectOrPlace: "a matchbox weather office with a serious paperclip antenna",
    wonderRule: "Forecasts become true only if the child believes them more than the people nearby.",
    comicEngine: "Tiny meteorologists argue in squeaky voices and issue warnings about 'high chance of broccoli'.",
    suspenseEngine: "A fake disaster forecast could cancel something the child secretly wants to attempt.",
    emotionalEngine: "Wanting certainty before daring to try.",
    personalCost: "The child must act kindly without a guarantee that it will work.",
    irreversibleMiddle: "A forecast leaks out and everyone starts behaving as if the worst outcome already happened.",
    antagonistPressure: "A self-important little system that confuses prediction with control.",
    finalImage: "The bureau hangs a sign: 'Mostly brave, scattered giggles later.'",
    mutationAxes: ["change bureau to advice booth, calendar, or compass", "make forecasts about friendship instead of weather", "move to picnic, test day, or sports event", "swap tiny staff personalities"],
  },
  {
    id: "ps-013-map-draws-what-you-avoid",
    title: "Die Karte, die nur Umwege malte",
    cluster: "journey-place",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["adventure", "journey", "mystery", "fantasy", "map"],
    settingSignals: ["forest", "city", "school", "museum", "attic", "map"],
    keyMotifs: ["map", "avoid", "path", "apology", "maze"],
    tags: ["journey with emotional target", "avoidance", "map comedy", "causal path"],
    baseStrength: 9.4,
    artifactAffinity: true,
    shelfHook: "A map refuses to show where the child wants to go; it only draws the place they are avoiding.",
    centralObjectOrPlace: "a folding map that adds tiny judgmental arrows in red pencil",
    wonderRule: "It gets clearer when the child walks toward the difficult conversation and blurrier with every dodge.",
    comicEngine: "The map nags through symbols: a sighing bridge, a winking shortcut, a lake shaped like 'nice try'.",
    suspenseEngine: "The needed place disappears from the map as the avoided place grows dangerously detailed.",
    emotionalEngine: "Trying to outrun an apology, worry, or promise.",
    personalCost: "The child must spend their easiest shortcut to reach someone else's harder need.",
    irreversibleMiddle: "The map draws the child inside its paper streets for one choice they cannot skip.",
    antagonistPressure: "Avoidance itself becomes cartography.",
    finalImage: "The map has one blank corner labeled 'next brave route'.",
    mutationAxes: ["change avoided target", "make map digital, stitched, edible, or chalk", "move journey to school corridors or city bus route", "change emotional engine from apology to fear/change"],
  },
  {
    id: "ps-014-fridge-runs-for-class-president",
    title: "Der Kühlschrank kandidiert",
    cluster: "school-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "comedy", "family", "social", "election"],
    settingSignals: ["school", "kitchen", "classroom", "cafeteria", "fridge"],
    keyMotifs: ["fridge", "election", "snacks", "class president", "promise"],
    tags: ["social satire for kids", "snack comedy", "promise pressure", "leadership"],
    baseStrength: 8.8,
    shelfHook: "The class fridge runs for president and promises unlimited snacks — but every promise has to fit on one shelf.",
    centralObjectOrPlace: "a humming mini-fridge wearing campaign stickers and magnets like medals",
    wonderRule: "Promises become real only if there is room for their consequences inside the fridge.",
    comicEngine: "Campaign slogans become sandwiches; the fridge debates by blinking its light dramatically.",
    suspenseEngine: "A tempting promise may win before anyone notices what it pushed out.",
    emotionalEngine: "Wanting popularity through easy promises instead of honest responsibility.",
    personalCost: "The child must withdraw their own flashy promise and defend a less popular truthful one.",
    irreversibleMiddle: "The fridge wins a vote and starts rearranging everyone's lunch according to its platform.",
    antagonistPressure: "A crowd-pleasing machine that mistakes full shelves for happy people.",
    finalImage: "The fridge becomes a suggestion box, still humming but no longer campaigning.",
    mutationAxes: ["swap fridge for vending machine, plant, printer, or class pet", "change election to club rule", "make promise non-food", "shift cost from popularity to honesty"],
  },
  {
    id: "ps-015-broom-closet-office-hours",
    title: "Die Sprechstunde im Besenschrank",
    cluster: "tiny-world",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "mystery", "magic", "tiny world", "comedy"],
    settingSignals: ["broom closet", "besenschrank", "school", "hallway", "storage"],
    keyMotifs: ["broom closet", "office hours", "tools", "secret", "help"],
    tags: ["secret bureaucracy", "tiny world", "object council", "comic rules"],
    baseStrength: 9.2,
    shelfHook: "Every broom closet has office hours where lost tools complain about the humans using them wrong.",
    centralObjectOrPlace: "a broom closet with a waiting-room ticket machine made from a pencil sharpener",
    wonderRule: "Objects will help only after the child solves the complaint they filed against a human habit.",
    comicEngine: "Mops speak in damp sighs, dustpans demand respect, and a broom keeps scheduling emergency meetings.",
    suspenseEngine: "A tool strike spreads through the building right before something must be cleaned, fixed, or found.",
    emotionalEngine: "Learning to notice the small work that keeps a place functioning.",
    personalCost: "The child must do an unglamorous job without getting credit first.",
    irreversibleMiddle: "The closet stamps the child as 'temporary staff', and all object complaints become visible to them.",
    antagonistPressure: "A tiny bureaucracy that has a point but no sense of proportion.",
    finalImage: "The closet door closes on a neat sign: 'Thank you counts as maintenance.'",
    mutationAxes: ["move office hours to fridge, toolbox, library cart, or toy box", "change object complaint", "make bureaucracy pirate-like or royal", "tie cost to gratitude"],
  },
  {
    id: "ps-016-museum-of-almosts",
    title: "Das Museum der Fast-Sachen",
    cluster: "journey-place",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["museum", "adventure", "emotional", "magic", "mystery"],
    settingSignals: ["museum", "gallery", "attic", "school", "city"],
    keyMotifs: ["museum", "almost", "unfinished", "exhibit", "choice"],
    tags: ["unfinished attempts", "wonder rooms", "creative courage", "final image"],
    baseStrength: 9.5,
    shelfHook: "A hidden museum collects almost-finished things: almost-apologies, almost-inventions, almost-brave moments.",
    centralObjectOrPlace: "a museum wing behind a door marked 'Nearly' in smudged gold letters",
    wonderRule: "An exhibit leaves only when its owner finishes the tiny action they avoided.",
    comicEngine: "Almost-objects are ridiculous: a half-invented sandwich umbrella, a nearly-trained goldfish choir.",
    suspenseEngine: "The child's own almost-choice becomes the main exhibit before closing time.",
    emotionalEngine: "Fear of finishing because finished things can be judged.",
    personalCost: "The child must complete something imperfectly in front of someone who matters.",
    irreversibleMiddle: "The museum labels the child as an exhibit, and visitors begin reading their unfinished caption.",
    antagonistPressure: "A curator who preserves avoidance beautifully and calls it safety.",
    finalImage: "One empty display case glows with a label: 'Finished badly, bravely, wonderfully.'",
    mutationAxes: ["change museum to archive, shop, train, or garden", "choose different almost-action", "make curator funny-sinister or lonely", "swap public judgment for private fear"],
  },
  {
    id: "ps-017-polite-trapdoor",
    title: "Die sehr höfliche Falltür",
    cluster: "object-mischief",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["adventure", "mystery", "comedy", "magic"],
    settingSignals: ["floor", "attic", "school", "library", "old house"],
    keyMotifs: ["trapdoor", "polite", "please", "fall", "basement"],
    tags: ["danger made funny", "manners reversal", "underground secret", "choice gate"],
    baseStrength: 9.0,
    shelfHook: "A trapdoor is dangerously polite: it always asks permission before dropping someone — and people keep saying yes by accident.",
    centralObjectOrPlace: "a brass-handled trapdoor with a tiny welcome mat",
    wonderRule: "It opens for any sentence that sounds like permission, even if nobody meant it.",
    comicEngine: "The trapdoor says 'after you' while causing complete nonsense below the floorboards.",
    suspenseEngine: "A careless polite phrase could drop the wrong person into the hidden place at the worst moment.",
    emotionalEngine: "Learning the difference between being polite and saying what you really mean.",
    personalCost: "The child must interrupt politely-but-clearly, risking looking rude to protect someone.",
    irreversibleMiddle: "The trapdoor starts treating silence as consent.",
    antagonistPressure: "A rule-bound object that obeys manners more than meaning.",
    finalImage: "The trapdoor keeps its welcome mat, now embroidered with 'Ask twice.'",
    mutationAxes: ["swap trapdoor for elevator, revolving door, wardrobe, or slide", "change politeness trigger", "move hidden place", "tie cost to boundaries"],
  },
  {
    id: "ps-018-pillow-fort-treaty",
    title: "Der Kissenburg-Vertrag",
    cluster: "domestic-magic",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["family", "sibling", "comedy", "magic", "bedroom"],
    settingSignals: ["bedroom", "living room", "pillow fort", "home", "kinderzimmer"],
    keyMotifs: ["pillow fort", "treaty", "siblings", "blanket", "kingdom"],
    tags: ["sibling comedy", "tiny politics", "soft adventure", "sharing power"],
    baseStrength: 9.1,
    shelfHook: "A pillow fort becomes a real tiny kingdom, and every unfair rule turns into a wobbly wall.",
    centralObjectOrPlace: "a pillow fort with blanket flags and a throne made from laundry",
    wonderRule: "Rules spoken inside the fort become real until everyone affected gets a say.",
    comicEngine: "Stuffed animals enforce laws very literally; a teddy insists on parliamentary snack breaks.",
    suspenseEngine: "The fort may collapse before peace is made, trapping the best toy on the wrong side.",
    emotionalEngine: "Wanting control in shared play and learning that leadership means listening.",
    personalCost: "The child gives up being the only ruler to save the game.",
    irreversibleMiddle: "One unfair rule becomes a wall too high to climb over.",
    antagonistPressure: "The child's own bossy rule-making becomes the barrier.",
    finalImage: "The treaty is written on a blanket tag and signed with cookie crumbs.",
    mutationAxes: ["swap fort for treehouse, blanket cave, or cardboard spaceship", "change sibling/friend conflict", "make laws rhyme or backfire", "shift cost from control to inclusion"],
  },
  {
    id: "ps-019-last-crayon-refuses",
    title: "Der letzte Wachsmalstift streikt",
    cluster: "object-mischief",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["art", "school", "creativity", "comedy", "magic"],
    settingSignals: ["classroom", "desk", "art room", "kinderzimmer", "school"],
    keyMotifs: ["crayon", "color", "drawing", "strike", "art"],
    tags: ["creative pressure", "object voice", "visual payoff", "mistake acceptance"],
    baseStrength: 9.0,
    artifactAffinity: true,
    shelfHook: "The last crayon refuses to color anything ordinary because it wants one drawing to matter.",
    centralObjectOrPlace: "a stubby crayon with a wrapper cape and a heroic squeak",
    wonderRule: "It draws only what someone really means, not what they are trying to make look perfect.",
    comicEngine: "The crayon makes dramatic speeches from under the desk and draws tiny protest signs.",
    suspenseEngine: "A drawing must be finished before time runs out, but perfection makes the crayon shorter and grumpier.",
    emotionalEngine: "Wanting the picture to impress instead of tell the truth.",
    personalCost: "The child uses the last bit of color on someone else's unfinished corner.",
    irreversibleMiddle: "The crayon draws the child's hidden worry across the page in a line nobody can ignore.",
    antagonistPressure: "A proud art tool that refuses decorative work when honest work is needed.",
    finalImage: "A messy picture with one brave color is hung higher than the perfect ones.",
    mutationAxes: ["swap crayon for glue stick, brush, sticker sheet, or chalk", "change art deadline", "make object cowardly instead of proud", "tie final image to friendship"],
  },
  {
    id: "ps-020-sock-drawer-zoo",
    title: "Der geheime Zoo in der Sockenschublade",
    cluster: "tiny-world",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["animals", "tiny world", "family", "comedy", "magic"],
    settingSignals: ["drawer", "sock drawer", "bedroom", "laundry", "home"],
    keyMotifs: ["sock drawer", "zoo", "tiny animals", "laundry", "missing socks"],
    tags: ["miniature world", "animal comedy", "domestic mystery", "care responsibility"],
    baseStrength: 9.2,
    shelfHook: "Missing socks are not missing — they are habitats for a tiny zoo that has outgrown the drawer.",
    centralObjectOrPlace: "a sock drawer with a paper ticket booth hidden behind striped socks",
    wonderRule: "Every unmatched sock becomes a home for a creature that matches its pattern.",
    comicEngine: "Argyle giraffes, polka-dot beetles, and one very formal sock penguin cause tiny keeper chaos.",
    suspenseEngine: "Laundry day may pair the habitats and flatten the whole zoo unless the child acts.",
    emotionalEngine: "Learning that cute discoveries become real responsibilities.",
    personalCost: "The child must give up their favorite socks to make safe homes.",
    irreversibleMiddle: "The drawer bursts open and the tiny zoo stampedes into the room.",
    antagonistPressure: "A well-meaning laundry routine that sees order where the child now sees lives.",
    finalImage: "A sock safari map hangs inside the drawer, with one empty habitat waiting.",
    mutationAxes: ["swap drawer for glove box, coat closet, lunchbox, or pencil case", "change animal logic", "make threat cleaning/packing/moving", "shift cost from favorite object to keeping secret"],
  },
  {
    id: "ps-021-wednesday-would-not-end",
    title: "Der Mittwoch, der nicht Feierabend machte",
    cluster: "time-rule",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["time", "school", "comedy", "mystery", "magic"],
    settingSignals: ["school", "home", "calendar", "classroom", "week"],
    keyMotifs: ["wednesday", "day", "calendar", "loop", "routine"],
    tags: ["time stuck", "routine comedy", "midweek monster", "emotional bottleneck"],
    baseStrength: 9.1,
    shelfHook: "Wednesday refuses to end because nobody thanked it for carrying the week through the middle.",
    centralObjectOrPlace: "a calendar square that keeps growing corners whenever crossed out",
    wonderRule: "The day moves on only when someone finishes the small task they keep postponing.",
    comicEngine: "Wednesday acts like an underappreciated employee: clipboard, sighs, and surprise inspections.",
    suspenseEngine: "The same awkward moment keeps returning bigger, funnier, and harder to dodge.",
    emotionalEngine: "Avoiding a small responsibility until it becomes the whole day.",
    personalCost: "The child gives up one fun repeat of the day to finish the uncomfortable task.",
    irreversibleMiddle: "Wednesday stamps itself onto every clock and schedule in town.",
    antagonistPressure: "A tired weekday that weaponizes routine.",
    finalImage: "Thursday arrives yawning, wearing Wednesday's borrowed hat.",
    mutationAxes: ["change day to hour, recess, bedtime, or holiday", "make time stuck by a promise", "move from school to family trip", "change personified time voice"],
  },
  {
    id: "ps-022-invisible-dog-leash",
    title: "Die unsichtbare Hundeleine zur Wahrheit",
    cluster: "creature-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["animal", "mystery", "friendship", "magic", "comedy"],
    settingSignals: ["park", "street", "school", "home", "dog"],
    keyMotifs: ["invisible dog", "leash", "truth", "walk", "secret"],
    tags: ["invisible pet", "truth pull", "mystery walk", "comic tug-of-war"],
    baseStrength: 9.3,
    shelfHook: "An invisible dog leash appears in the child's hand and pulls only toward truths people are dodging.",
    centralObjectOrPlace: "a leash with no dog attached, except for muddy pawprints that appear when it tugs",
    wonderRule: "It pulls harder near a lie, but goes limp when someone tells the truth without being forced.",
    comicEngine: "The invisible dog behaves like a detective puppy: sniffs excuses, chases half-truths, sits on awkward pauses.",
    suspenseEngine: "The leash drags the child toward a secret that could hurt a friendship if handled badly.",
    emotionalEngine: "Wanting to expose the truth before understanding why someone hid it.",
    personalCost: "The child must choose kindness over the thrill of being right.",
    irreversibleMiddle: "The leash clips itself to the wrong person, revealing that the child has hidden something too.",
    antagonistPressure: "Curiosity without empathy becomes the danger.",
    finalImage: "Invisible pawprints circle two friends sitting honestly side by side.",
    mutationAxes: ["swap invisible dog for cat, kite, balloon, or compass", "change truth type", "make leash playful or strict", "move mystery to school club or family event"],
  },
  {
    id: "ps-023-classroom-plant-grades-adults",
    title: "Die Klassenpflanze bewertet Erwachsene",
    cluster: "school-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "plant", "comedy", "justice", "magic"],
    settingSignals: ["classroom", "school", "window", "plant", "desk"],
    keyMotifs: ["plant", "grades", "adults", "classroom", "fairness"],
    tags: ["role reversal", "fairness comedy", "school politics", "gentle rebellion"],
    baseStrength: 9.2,
    shelfHook: "The classroom plant starts giving adults report cards — and its red pen is a root.",
    centralObjectOrPlace: "a windowsill plant whose leaves curl into checkmarks and question marks",
    wonderRule: "It grows when adults listen fairly and wilts when they use rules without understanding.",
    comicEngine: "The plant writes feedback in pollen, gives stickers to janitors, and sighs leaves at bad explanations.",
    suspenseEngine: "A public plant-grade could embarrass someone unless the child finds a fairer way to be heard.",
    emotionalEngine: "Wanting justice but learning that fairness must include everyone, even wrong adults.",
    personalCost: "The child gives up a satisfying public win to solve the unfair rule privately and bravely.",
    irreversibleMiddle: "The plant posts a huge grade on the window where the whole school can see it.",
    antagonistPressure: "A fairness machine that is right but not always kind.",
    finalImage: "The plant's new rubric has one category: 'Did you ask the child?'",
    mutationAxes: ["swap plant for class pet, whiteboard, trophy, or clock", "change adult/system being graded", "make grades smells/colors/shadows", "shift cost from revenge to repair"],
  },
  {
    id: "ps-024-bus-stop-mood-destinations",
    title: "Die Bushaltestelle für schlechte Laune",
    cluster: "journey-place",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["journey", "city", "emotion", "magic", "adventure"],
    settingSignals: ["bus stop", "city", "street", "school", "haltestelle"],
    keyMotifs: ["bus stop", "mood", "destination", "ticket", "city"],
    tags: ["emotion journey", "urban magic", "destination suspense", "self-regulation"],
    baseStrength: 9.0,
    shelfHook: "A bus stop sends passengers where their mood is going, not where their ticket says.",
    centralObjectOrPlace: "a bus stop sign whose route numbers change into tiny facial expressions",
    wonderRule: "The bus arrives for the feeling you feed most; changing destination requires one different action before boarding.",
    comicEngine: "Grumpy buses honk in sarcasm, shy buses hide behind vans, and excited buses arrive early twice.",
    suspenseEngine: "The child may be taken to the wrong emotional place before an important meeting or apology.",
    emotionalEngine: "Feeling carried away by a mood and learning one small action can steer it.",
    personalCost: "The child gives up the satisfying grumble and does one generous thing while still upset.",
    irreversibleMiddle: "The bus doors close on the wrong mood-route, and the next stop is visible but not reachable by complaining.",
    antagonistPressure: "A transit system that treats feelings as destinations unless challenged by behavior.",
    finalImage: "The child writes a new route on the sign: 'Still mad, going kind.'",
    mutationAxes: ["swap bus stop for train platform, bike rack, hallway, or elevator", "change mood", "make vehicles animal-like", "tie destination to sibling/friend conflict"],
  },
  {
    id: "ps-025-sandwich-pickle-detective",
    title: "Das beleidigte Gurkenbrot",
    cluster: "social-mystery",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["lunch", "school", "mystery", "comedy", "food"],
    settingSignals: ["cafeteria", "lunchbox", "school", "kitchen", "picnic"],
    keyMotifs: ["sandwich", "pickle", "lunch", "accusation", "mystery"],
    tags: ["food detective", "false accusation", "lunch comedy", "friendship repair"],
    baseStrength: 8.9,
    shelfHook: "A sandwich accuses everyone of stealing its pickles, but its evidence keeps getting eaten.",
    centralObjectOrPlace: "a lunchbox courtroom with a sandwich judge and crumb witnesses",
    wonderRule: "Food can testify only until someone takes a bite; every bite changes the case.",
    comicEngine: "The sandwich is pompous, the raisins are unreliable, and the carrot sticks object to everything.",
    suspenseEngine: "A friend may be blamed for a silly crime that hides a real hurt feeling.",
    emotionalEngine: "Jumping to blame because admitting disappointment feels harder.",
    personalCost: "The child apologizes before all proof is available.",
    irreversibleMiddle: "The key witness is eaten, forcing the child to choose trust over winning the case.",
    antagonistPressure: "A tiny court of snacks that loves drama more than truth.",
    finalImage: "The lunchbox closes on a peace treaty written in mustard.",
    mutationAxes: ["swap food/case", "move to picnic or birthday buffet", "change accusation to missing joke/note/sticker", "make the courtroom pirate, royal, or scientific"],
  },
  {
    id: "ps-026-cloud-with-hiccups",
    title: "Die Wolke mit Schluckauf",
    cluster: "creature-comedy",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["weather", "nature", "comedy", "gentle", "magic"],
    settingSignals: ["garden", "park", "schoolyard", "window", "cloud"],
    keyMotifs: ["cloud", "hiccups", "rain", "sky", "tiny storm"],
    tags: ["weather creature", "body comedy", "caregiving", "gentle suspense"],
    baseStrength: 8.8,
    shelfHook: "A tiny cloud has hiccups, and each hiccup drops something that definitely is not rain.",
    centralObjectOrPlace: "a low-floating cloud with round cheeks and a nervous rumble",
    wonderRule: "It hiccups out whatever it last worried about, turning worries into falling objects or weather shapes.",
    comicEngine: "It hiccups mittens, spoons, confetti, and one very confused frog-sized thunderclap.",
    suspenseEngine: "The cloud's biggest worry may fall during an outdoor event unless someone helps it calm down.",
    emotionalEngine: "Trying to stop someone else's worry by giving instructions instead of comfort.",
    personalCost: "The child pauses their own plan to listen carefully to a small, silly fear.",
    irreversibleMiddle: "A worry-hiccup becomes big enough to shade the whole place.",
    antagonistPressure: "Worry that grows when rushed.",
    finalImage: "The cloud floats away leaving one tiny rainbow hiccup in a jar.",
    mutationAxes: ["swap cloud for moon, puddle, tree, or kite", "change hiccups to sneezes/yawns", "alter objects that fall", "tie worry to performance or separation"],
  },
  {
    id: "ps-027-hat-that-hears-compliments",
    title: "Der Hut, der nur Komplimente hörte",
    cluster: "object-mischief",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["comedy", "friendship", "school", "magic", "identity"],
    settingSignals: ["school", "stage", "party", "bedroom", "hat"],
    keyMotifs: ["hat", "compliments", "names", "attention", "forgetting"],
    tags: ["attention comedy", "identity", "compliment trap", "social stakes"],
    baseStrength: 8.9,
    artifactAffinity: true,
    shelfHook: "A hat grows taller with compliments but forgets the names of everyone who helped it.",
    centralObjectOrPlace: "a fancy hat with a feather that bows to applause",
    wonderRule: "Praise makes it powerful; specific thanks make it kind; vague compliments make it vain.",
    comicEngine: "The hat gives acceptance speeches for tiny achievements and tries to autograph foreheads.",
    suspenseEngine: "The child may win attention while losing the people who made the win possible.",
    emotionalEngine: "Wanting to be noticed and learning to notice others precisely.",
    personalCost: "The child redirects the biggest applause to someone quieter.",
    irreversibleMiddle: "The hat becomes so tall it blocks the view of the person who deserves credit.",
    antagonistPressure: "Attention that feeds on general praise and starves on gratitude.",
    finalImage: "The hat shrinks into a shared feather tucked behind a thank-you note.",
    mutationAxes: ["swap hat for medal, shoes, cape, or microphone", "change compliment source", "move to school play/sports day/family party", "shift cost from credit to friendship"],
  },
  {
    id: "ps-028-little-door-for-big-feelings",
    title: "Die kleine Tür für große Gefühle",
    cluster: "domestic-magic",
    ageBands: ["3-5", "6-8"],
    genreSignals: ["emotional", "family", "magic", "gentle", "picture book"],
    settingSignals: ["home", "bedroom", "hallway", "door", "kinderzimmer"],
    keyMotifs: ["little door", "big feelings", "room", "anger", "sadness"],
    tags: ["emotion architecture", "gentle wonder", "visual metaphor", "self-regulation"],
    baseStrength: 9.3,
    shelfHook: "A tiny door appears for feelings too big to fit in the room, but it will not open for anyone pretending to be fine.",
    centralObjectOrPlace: "a knee-high door in the wall with a doorknob warm as a hand",
    wonderRule: "It opens only when the feeling is named in a true-sized sentence, not made bigger or smaller.",
    comicEngine: "Feelings inside have odd habits: Anger folds socks badly; Sadness waters a cactus with soup.",
    suspenseEngine: "One unnamed feeling keeps pushing furniture across the real room.",
    emotionalEngine: "Learning that big feelings need space and names, not shame.",
    personalCost: "The child lets someone see the feeling before it is tidy.",
    irreversibleMiddle: "The tiny door becomes huge for one moment, revealing the feeling-room to everyone nearby.",
    antagonistPressure: "Pretending 'nothing is wrong' turns the room into a maze.",
    finalImage: "The little door stays visible, now with a welcome mat that says 'Knock first.'",
    mutationAxes: ["move door to classroom, tree, closet, or pocket", "choose specific feeling", "make feeling-room comic/strange", "change final boundary rule"],
  },
  {
    id: "ps-029-printer-goat-eats-excuses",
    title: "Die Druckerziege frisst Ausreden",
    cluster: "school-comedy",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["school", "comedy", "technology", "animal", "magic"],
    settingSignals: ["school", "printer", "office", "classroom", "homework"],
    keyMotifs: ["printer", "goat", "excuses", "paper", "homework"],
    tags: ["tech-animal absurdity", "excuse comedy", "responsibility", "deadline suspense"],
    baseStrength: 9.0,
    shelfHook: "The school printer contains a tiny goat that eats excuses before printing the truth underneath.",
    centralObjectOrPlace: "a rattling printer with hoofprints in the paper tray",
    wonderRule: "It jams on lies, prints half-truths sideways, and only works when someone feeds it an honest plan.",
    comicEngine: "The goat bleats in error codes and chews the most dramatic excuses first.",
    suspenseEngine: "A deadline approaches while every printed excuse becomes funnier and more revealing.",
    emotionalEngine: "Avoiding responsibility by making the excuse more interesting than the repair.",
    personalCost: "The child must print the honest plan even though it proves they were late or wrong.",
    irreversibleMiddle: "The goat prints a hallway poster of the excuse chain before anyone can unplug it.",
    antagonistPressure: "A truth-hungry machine-creature with no tact but excellent timing.",
    finalImage: "The printer tray holds one clean page titled 'What I will do next.'",
    mutationAxes: ["swap printer animal", "change excuse domain", "move from school to library/family office", "make machine gentle or chaotic"],
  },
  {
    id: "ps-030-postbox-for-unsent-words",
    title: "Der Briefkasten für ungesagte Sätze",
    cluster: "social-mystery",
    ageBands: ["6-8", "9-12"],
    genreSignals: ["friendship", "family", "mystery", "emotional", "magic"],
    settingSignals: ["street", "postbox", "school", "home", "mail"],
    keyMotifs: ["postbox", "unsent words", "letters", "secret", "apology"],
    tags: ["emotional mystery", "communication", "letters", "soft suspense"],
    baseStrength: 9.4,
    shelfHook: "A red postbox collects sentences people almost said, then delivers them to the wrong person unless claimed.",
    centralObjectOrPlace: "a postbox with a slot that sighs whenever someone swallows a sentence",
    wonderRule: "Unsaid words become letters at midnight; they can be reclaimed only by saying a truer version aloud.",
    comicEngine: "The postbox sorts whispers with tiny postal stamps: 'too proud', 'too scared', 'too snack-related'.",
    suspenseEngine: "A nearly-said sentence may reach someone before the child is ready to explain it.",
    emotionalEngine: "Holding back words to stay safe, then discovering silence also travels.",
    personalCost: "The child chooses the awkward spoken truth over the perfectly edited letter.",
    irreversibleMiddle: "The postbox spits out all unsent letters into the street during daylight.",
    antagonistPressure: "A mail system that believes all words deserve delivery, context optional.",
    finalImage: "The postbox wears a new sign: 'First-class courage accepted here.'",
    mutationAxes: ["swap postbox for voicemail, mailbox, drawer, or school locker", "change unsaid sentence type", "make delivery comic or dangerous", "tie cost to apology or gratitude"],
  },
];

const SEED_STOPWORDS = new Set([
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "und", "oder", "mit", "ohne", "von", "zum", "zur",
  "the", "and", "with", "from", "into", "that", "this", "story", "geschichte", "chapter", "kapitel", "magic", "magisch",
]);

function normalizeSeedText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeSeedText(value: string): string[] {
  return normalizeSeedText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !SEED_STOPWORDS.has(token));
}

function hashSeedText(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function includesAnySignal(signalText: string, values: ReadonlyArray<string>): boolean {
  return values.some((value) => {
    const normalized = normalizeSeedText(value);
    return normalized.length >= 3 && signalText.includes(normalized);
  });
}

function textOverlap(a: string, b: string): number {
  const left = new Set(tokenizeSeedText(a));
  const right = new Set(tokenizeSeedText(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  const union = left.size + right.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function seedFullText(seed: PremiseSeedCard): string {
  return [
    seed.title,
    seed.shelfHook,
    seed.centralObjectOrPlace,
    seed.wonderRule,
    seed.comicEngine,
    seed.suspenseEngine,
    seed.emotionalEngine,
    seed.keyMotifs.join(" "),
    seed.tags.join(" "),
  ].join(" ");
}

function scorePremiseSeed(seed: PremiseSeedCard, input: PremiseSeedSelectionInput): SelectedPremiseSeedCard {
  const signalText = normalizeSeedText([
    input.genre,
    input.setting,
    input.ageGroup,
    input.length,
    input.customPrompt,
    input.creativeLane,
    input.emotionalEngine,
    input.wonderMechanic,
    input.keyMomentLens,
    input.matchedArtifactName,
  ].filter(Boolean).join(" "));
  const seedText = normalizeSeedText(seedFullText(seed));
  const matchReasons: string[] = [];
  let score = seed.baseStrength;

  if (includesAnySignal(signalText, seed.genreSignals)) {
    score += 1.2;
    matchReasons.push("genre fit");
  }
  if (includesAnySignal(signalText, seed.settingSignals)) {
    score += 1.1;
    matchReasons.push("setting fit");
  }
  if (includesAnySignal(signalText, seed.tags)) {
    score += 0.8;
    matchReasons.push("theme/mechanic fit");
  }
  if (includesAnySignal(signalText, seed.keyMotifs)) {
    score += 0.6;
    matchReasons.push("motif requested");
  }
  if (input.ageGroup && seed.ageBands.includes(input.ageGroup as PremiseSeedAgeBand)) {
    score += 0.7;
    matchReasons.push("age fit");
  }
  if (input.matchedArtifactName && seed.artifactAffinity) {
    score += 0.9;
    matchReasons.push("artifact-friendly");
  }

  const hardAvoidHits = (input.hardAvoidMotifs || [])
    .map((motif) => normalizeSeedText(motif))
    .filter((motif) => motif.length >= 4 && !SEED_STOPWORDS.has(motif))
    .filter((motif) => seedText.includes(motif) || seed.keyMotifs.some((keyMotif) => normalizeSeedText(keyMotif).includes(motif)));
  if (hardAvoidHits.length > 0) {
    score -= 4 + hardAvoidHits.length * 1.5;
    matchReasons.push("penalized: hard-avoid motif overlap");
  }

  let recentOverlap = 0;
  for (const recentText of input.recentStoryTexts || []) {
    recentOverlap = Math.max(recentOverlap, textOverlap(seedText, recentText));
  }
  if (recentOverlap >= 0.18) {
    score -= recentOverlap * 8;
    matchReasons.push("penalized: recent-story overlap");
  }

  const jitterSeed = [input.noveltySeed, input.round || 1, input.genre, input.setting, seed.id].filter(Boolean).join(":");
  score += (hashSeedText(jitterSeed) % 100) / 1000;

  return {
    ...seed,
    score: Math.round(score * 100) / 100,
    matchReasons: matchReasons.length > 0 ? matchReasons : ["fresh wildcard"],
    recentOverlap: Math.round(recentOverlap * 100) / 100,
    hardAvoidHits: [...new Set(hardAvoidHits)].slice(0, 6),
  };
}

export function selectPremiseSeedsForIdeaLab(
  input: PremiseSeedSelectionInput,
  limit = 6,
): SelectedPremiseSeedCard[] {
  const scored = PREMISE_SEED_LIBRARY
    .map((seed) => scorePremiseSeed(seed, input))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const freshEnough = scored.filter((seed) => seed.hardAvoidHits.length === 0 || seed.score >= 7.2);
  const source = freshEnough.length >= limit ? freshEnough : scored;
  const selected: SelectedPremiseSeedCard[] = [];
  const clusterCounts = new Map<PremiseSeedCluster, number>();

  for (const seed of source) {
    const count = clusterCounts.get(seed.cluster) || 0;
    if (count >= 2 && selected.length < Math.min(limit, 4)) continue;
    selected.push(seed);
    clusterCounts.set(seed.cluster, count + 1);
    if (selected.length >= limit) break;
  }

  if (selected.length < limit) {
    for (const seed of source) {
      if (selected.some((existing) => existing.id === seed.id)) continue;
      selected.push(seed);
      if (selected.length >= limit) break;
    }
  }

  return selected.slice(0, limit);
}

function compactSeedLine(value: string, maxChars = 220): string {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= maxChars ? text : `${text.slice(0, Math.max(0, maxChars - 1)).trim()}…`;
}

export function buildPremiseSeedPromptBlock(
  seeds: ReadonlyArray<SelectedPremiseSeedCard>,
  options: { candidateCount: number; round?: number } = { candidateCount: 8 },
): string {
  if (seeds.length === 0) return "";
  const seedIds = seeds.map((seed) => seed.id).join(", ");
  return [
    `ORIGINAL PREMISE SEED LIBRARY${options.round && options.round > 1 ? ` — ROUND ${options.round}` : ""}:`,
    "- These are original premise sparks, not finished stories and not fairy-tale/story DNA.",
    "- Use them like a writers' room wall: steal the ENGINE, not the exact title, not the exact plot, not the exact object unless it perfectly fits.",
    `- Candidate field premiseSeedId must be one of: ${seedIds}, or \"wildcard\" if you invent a stronger premise from scratch.`,
    "- Candidate field premiseSeedMutation must state 2-3 concrete mutations you made from the seed.",
    `- Generate ${options.candidateCount} candidates. Use each listed seed at most once before using wildcard/combinations.`,
    "- To use a seed, mutate at least THREE axes: object/place, funny rule, antagonist pressure, personal cost, irreversible middle, or final image.",
    "- Keep the seed's quality contract: comic engine + suspense engine + emotional engine + personal cost + visible irreversible middle.",
    "- If a seed overlaps the novelty/hard-avoid brief, mutate away from the overlapping motif or use another seed.",
    "",
    ...seeds.flatMap((seed, index) => {
      const baseLines = [
        `SEED ${index + 1} (${seed.id}) — ${seed.title}`,
        `- Shelf hook: ${compactSeedLine(seed.shelfHook)}`,
        `- Object/place: ${compactSeedLine(seed.centralObjectOrPlace, 170)}`,
        `- Wonder rule: ${compactSeedLine(seed.wonderRule, 190)}`,
        `- Comedy engine: ${compactSeedLine(seed.comicEngine, 190)}`,
        `- Suspense engine: ${compactSeedLine(seed.suspenseEngine, 190)}`,
        `- Emotional engine: ${compactSeedLine(seed.emotionalEngine, 170)}`,
        `- Cost + irreversible middle: ${compactSeedLine(`${seed.personalCost} / ${seed.irreversibleMiddle}`, 220)}`,
        `- Final-image promise: ${compactSeedLine(seed.finalImage, 160)}`,
        `- Mutation axes: ${seed.mutationAxes.slice(0, 4).join("; ")}`,
      ];
      // Execution scaffolding — only emitted when the seed actually carries
      // it. Keeps the prompt small for legacy seeds while letting curated
      // seeds (ps-026, ...) push concrete drafting guardrails into the LLM.
      const exec: string[] = [];
      if (seed.toyeticRule) exec.push(`- Toyetic rule: ${compactSeedLine(seed.toyeticRule, 190)}`);
      if (seed.humorEngine) exec.push(`- Humor engine: ${compactSeedLine(seed.humorEngine, 190)}`);
      if (seed.wrongFixes && seed.wrongFixes.length > 0) {
        exec.push(`- Wrong fixes to try first: ${seed.wrongFixes.slice(0, 4).map((s) => compactSeedLine(s, 110)).join(" | ")}`);
      }
      if (seed.ruleTests && seed.ruleTests.length > 0) {
        exec.push(`- Rule tests: ${seed.ruleTests.slice(0, 4).map((s) => compactSeedLine(s, 110)).join(" | ")}`);
      }
      if (seed.irreversibleMiddleOptions && seed.irreversibleMiddleOptions.length > 0) {
        exec.push(`- Irreversible-middle options (pick one): ${seed.irreversibleMiddleOptions.slice(0, 4).map((s) => compactSeedLine(s, 130)).join(" | ")}`);
      }
      if (seed.personalCostOptions && seed.personalCostOptions.length > 0) {
        exec.push(`- Personal-cost options (named, tangible): ${seed.personalCostOptions.slice(0, 4).map((s) => compactSeedLine(s, 130)).join(" | ")}`);
      }
      if (seed.voiceOpportunities && seed.voiceOpportunities.length > 0) {
        exec.push(`- Voice opportunities: ${seed.voiceOpportunities.slice(0, 4).map((s) => compactSeedLine(s, 120)).join(" | ")}`);
      }
      if (seed.finalActionOptions && seed.finalActionOptions.length > 0) {
        exec.push(`- Final-action options (child-led): ${seed.finalActionOptions.slice(0, 4).map((s) => compactSeedLine(s, 130)).join(" | ")}`);
      }
      if (seed.antiPatterns && seed.antiPatterns.length > 0) {
        exec.push(`- DO NOT: ${seed.antiPatterns.slice(0, 4).map((s) => compactSeedLine(s, 120)).join(" | ")}`);
      }
      return [
        ...baseLines,
        ...exec,
        `- Selector notes: score ${seed.score}; ${seed.matchReasons.join(", ")}${seed.recentOverlap ? `; recentOverlap ${seed.recentOverlap}` : ""}`,
        "",
      ];
    }),
  ].join("\n");
}
