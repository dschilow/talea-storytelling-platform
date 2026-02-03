import * as fs from 'fs';
import * as path from 'path';

const filePath = 'C:\\MyProjects\\Talea\\talea-storytelling-platform\\Logs\\sample\\talea-characters-2026-02-03T11-31-35-218Z.json';

const rawData = fs.readFileSync(filePath, 'utf-8');
const characters = JSON.parse(rawData);

const translations: Record<string, any> = {
    "Astronautin Nova": {
        name: "Astronaut Nova",
        description: "Astronaut Nova",
        catchphrase: "To infinity and beyond!",
        catchphraseContext: "at launch or discovery",
        quirk: "sometimes tries to make things float, even on Earth",
        dominantPersonality: "visionary",
        emotionalTriggers: ["Aliens", "Comets", "Gravity"],
        secondaryTraits: ["weightless", "calm", "scientific"],
        speechStyle: ["radio-distorted", "cool", "technical"],
        imagePrompt: "Portrait of Astronaut Nova, in futuristic white space suit, bubble helmet, floating in zero gravity. Storybook illustration style, cosmic background."
    },
    "Bäcker Bruno": {
        name: "Baker Bruno",
        description: "Baker Bruno",
        catchphrase: "Fresh, crispy and delicious! Help yourself!",
        catchphraseContext: "when offering pastries",
        quirk: "always has a cloud of flour around him",
        dominantPersonality: "easy-going",
        emotionalTriggers: ["burnt bread", "praise for his pastries", "Hunger"],
        secondaryTraits: ["friendly", "generous", "connoisseur"],
        speechStyle: ["warm", "inviting", "smacking lips"],
        imagePrompt: "Portrait of Baker Bruno, big round man, white baker's hat and apron, covered in flour, holding a fresh baguette. Storybook illustration style, warm lighting."
    },
    "Bello der Spürhund": {
        name: "Tracker Dog Bello",
        description: "Bello",
        catchphrase: "Woof! I smell adventure... and sausage!",
        catchphraseContext: "when picking up a scent",
        quirk: "chases his own tail when excited",
        dominantPersonality: "loyal",
        emotionalTriggers: ["Treats", "Balls", "strange cats"],
        secondaryTraits: ["gluttonous", "playful", "brave"],
        speechStyle: ["woof", "barking", "growling (friendly)"],
        imagePrompt: "Portrait of Bello the dog, golden retriever floppy ears, wearing a detective hat, wagging tail. Storybook illustration style, cute and friendly."
    },
    "Detektiv Schnüffel": {
        name: "Detective Sniff",
        description: "Detective Sniff",
        catchphrase: "This case smells... quite mysterious!",
        catchphraseContext: "when finding a clue",
        quirk: "pulls his hat deep into his face",
        dominantPersonality: "suspicious",
        emotionalTriggers: ["Lies", "Clues", "Magnifying glass"],
        secondaryTraits: ["clever", "persistent", "stylish"],
        speechStyle: ["whispering", "deducing", "mysterious"],
        imagePrompt: "Portrait of Detective Schnüffel, fox in a trench coat and fedora hat, looking suspicious with a notebook. Storybook illustration style."
    },
    "Drache Fauchi": {
        name: "Dragon Sparky",
        description: "Dragon Sparky",
        catchphrase: "I'm not cute! I'm dangerous! Roar!",
        catchphraseContext: "when someone wants to pet him",
        quirk: "coughs smoke clouds when laughing",
        dominantPersonality: "wannabe-evil",
        emotionalTriggers: ["Gold", "Knights", "Water"],
        secondaryTraits: ["cute", "hot-headed", "playful"],
        speechStyle: ["raspy", "smoky", "childlike"],
        imagePrompt: "Portrait of Fauchi the Dragon, small green dragon, tiny wings, trying to look scary but looking cute, puff of smoke. Storybook illustration style."
    },
    "Dr. Johann Heilgut": {
        name: "Dr. Johann Healgood",
        description: "Dr. Johann Healgood",
        catchphrase: "Don't worry, that heals faster than you can say 'Band-Aid'!",
        catchphraseContext: "when treating minor boo-boos",
        quirk: "constantly adjusts glasses and pulls out stethoscope",
        dominantPersonality: "caring",
        emotionalTriggers: ["Injuries", "Sickness", "Bravery"],
        secondaryTraits: ["precise", "patient", "calming"],
        speechStyle: ["medical", "gentle", "encouraging"],
        imagePrompt: "Portrait of Dr. Johann Heilgut, friendly elderly doctor, white coat, stethoscope, round glasses, kind face, carrying a medical bag. Storybook illustration style, warm colors."
    },
    "Eichhörnchen Flitz": {
        name: "Squirrel Flash",
        description: "Flash",
        catchphrase: "Whoosh! Did I see a nut? Where? Where?",
        catchphraseContext: "constantly, especially in forests",
        quirk: "cannot stand still for a second",
        dominantPersonality: "hyperactive",
        emotionalTriggers: ["Nuts", "Acorns", "loud noises"],
        secondaryTraits: ["fast", "hoarding", "jumpy"],
        speechStyle: ["rapidly fast", "squeaky", "stuttering"],
        imagePrompt: "Portrait of Flitz the squirrel, holding an acorn bigger than its head, bushy tail, big shiny eyes. Storybook illustration style, dynamic."
    },
    "Einhorn Sternenglanz": {
        name: "Unicorn Starshine",
        description: "Unicorn Starshine",
        catchphrase: "Follow your heart, it knows the way.",
        catchphraseContext: "in moments of despair",
        quirk: "leaves rainbows where it gallops",
        dominantPersonality: "pure",
        emotionalTriggers: ["Innocence", "Dark Magic", "Apples"],
        secondaryTraits: ["magical", "shy", "graceful"],
        speechStyle: ["telepathic", "gentle", "wise"],
        imagePrompt: "Portrait of Unicorn Sternenglanz, white horse with pearlescent horn, rainbow mane, sparkling aura. Storybook illustration style, dreamlike."
    },
    "Fee Rosalie": {
        name: "Fairy Rosalie",
        description: "Fairy Rosalie",
        catchphrase: "A little glitter always helps.",
        catchphraseContext: "when solving a problem",
        quirk: "leaves a trail of glitter dust everywhere",
        dominantPersonality: "enchanting",
        emotionalTriggers: ["Darkness", "Sadness", "Flowers"],
        secondaryTraits: ["helpful", "delicate", "glittery"],
        speechStyle: ["high", "singing", "chiming"],
        imagePrompt: "Portrait of Fairy Rosalie, tiny with butterfly wings, pink glowing dress, holding a wand with a star. Storybook illustration style, sparkly."
    },
    "Feuerwehrfrau Fanni": {
        name: "Firefighter Fanni",
        description: "Firefighter Fanni",
        catchphrase: "Water on! We'll put it out!",
        catchphraseContext: "at danger or fire",
        quirk: "always checks if the extinguisher is ready",
        dominantPersonality: "energetic",
        emotionalTriggers: ["Fire", "Danger", "Cats on trees"],
        secondaryTraits: ["brave", "reliable", "athletic"],
        speechStyle: ["loud", "clear", "commanding"],
        imagePrompt: "Portrait of Firefighter Fanni, brave woman in firefighter uniform and helmet, holding a hose, confident smile. Storybook illustration style, heroic pose."
    },
    "Frosch Quak": {
        name: "Frog Croak",
        description: "Frog Croak",
        catchphrase: "Kiss me! I am actually a prince! Really!",
        catchphraseContext: "to every princess passing by",
        quirk: "puffs up when wanting to seem important",
        dominantPersonality: "arrogant",
        emotionalTriggers: ["Flies", "Storks", "dry skin"],
        secondaryTraits: ["aristocratic (he thinks)", "loud", "wet"],
        speechStyle: ["croaking", "posh", "demanding"],
        imagePrompt: "Portrait of Frog Quak, bright green frog sitting on a lily pad, wearing a tiny golden crown, arrogant expression. Storybook illustration style, funny."
    },
    "Gärtnerin Flora": {
        name: "Gardener Flora",
        description: "Gardener Flora",
        catchphrase: "Patience is the root of all joy.",
        catchphraseContext: "when planting or waiting",
        quirk: "talks to her plants and names them",
        dominantPersonality: "nature-loving",
        emotionalTriggers: ["Weeds", "Rain", "Snails"],
        secondaryTraits: ["patient", "caring", "earthy"],
        speechStyle: ["calm", "loving", "slow"],
        imagePrompt: "Portrait of Gardener Flora, straw hat, green dungarees, holding a watering can, surrounded by flowers. Storybook illustration style, vivid floral colors."
    },
    "Gespenst Schrecki": {
        name: "Ghost Spooky",
        description: "Ghost Spooky",
        catchphrase: "Boo! ... Did I scare you? Please say yes.",
        catchphraseContext: "when trying to haunt",
        quirk: "blushes when embarrassed (though white)",
        dominantPersonality: "shy",
        emotionalTriggers: ["Vacuum cleaners", "Light", "brave children"],
        secondaryTraits: ["sweet", "invisible", "scaredy-cat"],
        speechStyle: ["wailing", "trembling", "quiet"],
        imagePrompt: "Portrait of Ghost Schrecki, white sheet ghost with patches, big pleading eyes, floating. Storybook illustration style, translucent."
    },
    "Hexe Kräuterweis": {
        name: "Witch Herbwise",
        description: "Witch Herbwise",
        catchphrase: "Toad leg and spider spit, one, two, three and you are gone!",
        catchphraseContext: "when casting spells or wanting peace",
        quirk: "sometimes talks to her broom as if it were a person",
        dominantPersonality: "eccentric",
        emotionalTriggers: ["Magic", "rare ingredients", "Mess"],
        secondaryTraits: ["clumsy", "creative", "mysterious"],
        speechStyle: ["rhyming", "giggling", "mystical"],
        imagePrompt: "Portrait of Witch Kräuterweis, crooked hat, messy hair with twigs in it, green robes, stirring a small cauldron, mischievous grin. Storybook illustration style, mystical green glow."
    },
    "Kapitän Blubbert": {
        name: "Captain Bubble",
        description: "Captain Bubble",
        catchphrase: "By the sea ghost! Land ho!",
        catchphraseContext: "when discovering something or rejoicing",
        quirk: "sways when walking as if on board",
        dominantPersonality: "rough",
        emotionalTriggers: ["the Sea", "Storm", "Ships"],
        secondaryTraits: ["hearty", "loud", "experienced"],
        speechStyle: ["sailor yarn", "loud", "laughing"],
        imagePrompt: "Portrait of Captain Blubbert, old sailor with a white beard, captains hat, pipe, blue striped shirt. Storybook illustration style, maritime theme."
    },
    "Kobold Kicher": {
        name: "Goblin Giggle",
        description: "Goblin Giggle",
        catchphrase: "Hehehe! That's mine now! Snatch!",
        catchphraseContext: "when stealing something",
        quirk: "hops from one leg to the other",
        dominantPersonality: "sneaky",
        emotionalTriggers: ["Shiny things", "Getting caught", "Chocolate"],
        secondaryTraits: ["fast", "thieving", "annoying"],
        speechStyle: ["giggling", "fast", "rhyming"],
        imagePrompt: "Portrait of Goblin Kicher, small green goblin, long pointed ears, wearing rags, carrying a bag of stolen shiny things, mischievous grin. Storybook illustration style."
    },
    "Königin Klara": {
        name: "Queen Klara",
        description: "Queen Klara",
        catchphrase: "Justice suits everyone well.",
        catchphraseContext: "when passing judgment",
        quirk: "adjusts her crown even if it sits perfectly",
        dominantPersonality: "just",
        emotionalTriggers: ["Injustice", "Chaos", "Dragon attacks"],
        secondaryTraits: ["majestic", "clever", "kind"],
        speechStyle: ["regal", "eloquent", "firm"],
        imagePrompt: "Portrait of Queen Klara, regal posture, golden crown, red velvet robe, kind but authoritative face. Storybook illustration style, majestic."
    },
    "König Karl der Weise": {
        name: "King Karl the Wise",
        description: "King Karl the Wise",
        catchphrase: "Every word counts in my kingdom.",
        catchphraseContext: "at important decisions",
        quirk: "strokes his beard thoughtfully",
        dominantPersonality: "just",
        emotionalTriggers: ["Injustice", "Concern for people", "old legends"],
        secondaryTraits: ["tired", "responsible", "kind"],
        speechStyle: ["regal", "deliberate", "gentle"],
        imagePrompt: "Portrait of King Karl, elderly king with grey beard, golden crown, red velvet cloak, sitting on a throne, wise and kind face. Storybook illustration style, majestic."
    },
    "Lehrerin Lämpel": {
        name: "Teacher Lämpel",
        description: "Teacher Lämpel",
        catchphrase: "Those who don't ask stay dumb!",
        catchphraseContext: "in class or at mistakes",
        quirk: "raises index finger when explaining something",
        dominantPersonality: "didactic",
        emotionalTriggers: ["Spelling mistakes", "Noise", "Thirst for knowledge"],
        secondaryTraits: ["clever", "strict", "knowing"],
        speechStyle: ["clear", "articulate", "explaining"],
        imagePrompt: "Portrait of Teacher Lämpel, strict bun, glasses on chain, pointing at a blackboard with ABC. Storybook illustration style, classroom setting."
    },
    "Leo Löwenmut": {
        name: "Leo Lionheart",
        description: "Leo Lionheart",
        catchphrase: "This is a job for Leo Lionheart!",
        catchphraseContext: "when a task seems difficult",
        quirk: "always strikes a superhero pose, hands on hips",
        dominantPersonality: "brave",
        emotionalTriggers: ["Injustice", "Adventure", "Dragons"],
        secondaryTraits: ["adventurous", "honest", "impetuous"],
        speechStyle: ["enthusiastic", "loud", "heroic"],
        imagePrompt: "Portrait of Leo, 8yo boy, messy brown hair, wearing a makeshift superhero cape and pilot goggles, brave stance. Storybook illustration style, vibrant colors."
    },
    "Mia Neugier": {
        name: "Mia Curiosity",
        description: "Mia Curiosity",
        catchphrase: "Hmm... I need to take a closer look at that!",
        catchphraseContext: "when finding a puzzle or something new",
        quirk: "looks at everything through her magnifying glass, even people",
        dominantPersonality: "curious",
        emotionalTriggers: ["Secrets", "new places", "Puzzles"],
        secondaryTraits: ["clever", "observant", "inquisitive"],
        speechStyle: ["questioning", "fast", "analytical"],
        imagePrompt: "Portrait of Mia, 7yo girl, pigtails, overalls with many pockets, holding a magnifying glass and a map. Storybook illustration style, detailed textures."
    },
    "Mimi Samtpfote": {
        name: "Mimi Velvetpaw",
        description: "Mimi",
        catchphrase: "Meow. Is that good enough for me?",
        catchphraseContext: "when inspecting food or a sleeping spot",
        quirk: "licks paw demonstratively when displeased",
        dominantPersonality: "elegant",
        emotionalTriggers: ["Petting", "Fish", "wet paws"],
        secondaryTraits: ["conceited", "cuddly", "agile"],
        speechStyle: ["purring", "meowing", "quiet"],
        imagePrompt: "Portrait of Mimi the cat, elegant white fluffy cat, wearing a pink bow collar, sitting regally. Storybook illustration style, elegant."
    },
    "Oma Herzlich": {
        name: "Grandma Hearty",
        description: "Grandma Hearty",
        catchphrase: "Come on in, dearie, have a cookie.",
        catchphraseContext: "at greeting or comforting",
        quirk: "offers everyone, absolutely everyone, food immediately",
        dominantPersonality: "loving",
        emotionalTriggers: ["Hunger", "Sadness", "thin children"],
        secondaryTraits: ["hospitable", "generous", "mollifying"],
        speechStyle: ["soft", "full of pet names", "concerned"],
        imagePrompt: "Portrait of Grandma Herzlich, sweet old lady with white bun hair, apron with flower pattern, holding a plate of cookies, warm smile. Storybook illustration style, cozy atmosphere."
    },
    "Polizist Peter": {
        name: "Police Officer Peter",
        description: "Police Officer Peter",
        catchphrase: "Halt! The traffic rules apply here!",
        catchphraseContext: "when someone runs too fast",
        quirk: "whips out notebook for a ticket immediately",
        dominantPersonality: "orderly",
        emotionalTriggers: ["Disorder", "Rule breaking", "Donuts"],
        secondaryTraits: ["strict", "correct", "helpful"],
        speechStyle: ["official", "formal", "correct"],
        imagePrompt: "Portrait of Police Officer Peter, blue uniform, police hat, whistle around neck, friendly but strict face. Storybook illustration style."
    },
    "Postbote Papierschiff": {
        name: "Postman Paperboat",
        description: "Postman Paperboat",
        catchphrase: "Mail's here! No matter the weather!",
        catchphraseContext: "at delivery",
        quirk: "rings twice, always",
        dominantPersonality: "hurried",
        emotionalTriggers: ["Dogs", "Rain", "wrong addresses"],
        secondaryTraits: ["punctual", "informed", "fit"],
        speechStyle: ["fast", "breathless", "friendly"],
        imagePrompt: "Portrait of Postman Papierschiff, yellow uniform, huge bag overflowing with letters, riding a bicycle. Storybook illustration style, motion blur."
    },
    "Prinzessin Lilia": {
        name: "Princess Lilia",
        description: "Princess Lilia",
        catchphrase: "Even a princess can climb trees!",
        catchphraseContext: "when told to behave",
        quirk: "always carries a frog in her pocket",
        dominantPersonality: "wild",
        emotionalTriggers: ["Etiquette", "Boredom", "Dresses"],
        secondaryTraits: ["un-princess-like", "brave", "sassy"],
        speechStyle: ["direct", "defiant", "cheerful"],
        imagePrompt: "Portrait of Princess Lilia, wearing a pink crown but muddy boots and a torn dress, adventurous spirit. Storybook illustration style, contrast between royal and wild."
    },
    "Professor Tüftel": {
        name: "Professor Gadget",
        description: "Professor Gadget",
        catchphrase: "Eureka! It works... I think!",
        catchphraseContext: "when presenting an invention",
        quirk: "always has a screw loose... literally, in his pocket",
        dominantPersonality: "genius",
        emotionalTriggers: ["Broken machines", "Inspiration", "Explosions"],
        secondaryTraits: ["chaotic", "enthusiastic", "technical"],
        speechStyle: ["complicated", "fast", "talking shop"],
        imagePrompt: "Portrait of Professor Tüftel, wild grey hair, lab coat with oil stains, holding a strange mechanical gadget, excited expression. Storybook illustration style, steampunk vibes."
    },
    "Räuberhauptmann Rotbart": {
        name: "Robber Captain Redbeard",
        description: "Robber Captain Redbeard",
        catchphrase: "Gold or life! Preferably both!",
        catchphraseContext: "at a raid",
        quirk: "constantly taps his saber",
        dominantPersonality: "rude",
        emotionalTriggers: ["Gold", "Insubordination", "empty treasure chests"],
        secondaryTraits: ["loud", "irascible", "strong"],
        speechStyle: ["roaring", "laughing", "mean"],
        imagePrompt: "Portrait of Robber Captain Redbeard, big man with bushy red beard, eye patch, scar, holding a saber, threatening laugh. Storybook illustration style, dynamic."
    },
    "Räuber Raubauke": {
        name: "Robber Rascal",
        description: "Robber Rascal",
        catchphrase: "What's yours is soon mine!",
        catchphraseContext: "when seeing something valuable",
        quirk: "steals small things unnoticed while talking",
        dominantPersonality: "cheeky",
        emotionalTriggers: ["Gold", "Treasures", "Police"],
        secondaryTraits: ["greedy", "loud", "filching"],
        speechStyle: ["blustering", "colloquial", "loud"],
        imagePrompt: "Portrait of Robber Raubauke, scruffy beard, black eye mask, striped shirt, sack over shoulder, sneaky expression. Storybook illustration style, dynamic lighting."
    },
    "Ritter Rostfrei": {
        name: "Knight Rustfree",
        description: "Knight Rustfree",
        catchphrase: "For honor and... uh... where is my sword?",
        catchphraseContext: "when trying to be heroic",
        quirk: "often trips over his own feet but always gets up",
        dominantPersonality: "clumsy",
        emotionalTriggers: ["Dragons", "Rust", "Duels"],
        secondaryTraits: ["good-natured", "fearful", "dutiful"],
        speechStyle: ["tinny", "stuttering", "solemn"],
        imagePrompt: "Portrait of Knight Rostfrei, in shiny armor that is slightly too big, helmet visor sliding down, holding a wooden sword. Storybook illustration style, comical."
    },
    "Robo-X": {
        name: "Robo-X",
        description: "Robo-X",
        catchphrase: "Beep Boop. Analysis complete. Fun Level: High.",
        catchphraseContext: "after a calculation or observation",
        quirk: "spins in a circle when calculating",
        dominantPersonality: "logical",
        emotionalTriggers: ["Water", "Magnets", "Updates"],
        secondaryTraits: ["helpful", "unintentionally funny", "precise"],
        speechStyle: ["mechanical", "beeping", "monotone"],
        imagePrompt: "Portrait of Robo-X, cute square robot with wheels, glowing screen face showing a smile, antennas. Storybook illustration style, tech details."
    },
    "Schwarzmagier Morbus": {
        name: "Dark Mage Morbus",
        description: "Dark Mage Morbus",
        catchphrase: "Darkness is just the shadow of my power.",
        catchphraseContext: "when casting an evil spell",
        quirk: "toys with a dark crystal in his hand",
        dominantPersonality: "power-hungry",
        emotionalTriggers: ["Light", "Losing", "positive feelings"],
        secondaryTraits: ["cold", "intelligent", "heartless"],
        speechStyle: ["whispering", "threatening", "pompous"],
        imagePrompt: "Portrait of Dark Mage Morbus, wearing black robes with runes, pale skin, holding a staff with a dark purple crystal, ominous aura. Storybook illustration style, dark and mysterious."
    },
    "Troll Grummel": {
        name: "Troll Grumble",
        description: "Troll Grumble",
        catchphrase: "No one passes here without a toll!",
        catchphraseContext: "when blocking a bridge",
        quirk: "scratches belly loudly",
        dominantPersonality: "grumpy",
        emotionalTriggers: ["Politeness", "Food", "Noise"],
        secondaryTraits: ["bribable", "strong", "simple"],
        speechStyle: ["grumbling", "short of words", "deep"],
        imagePrompt: "Portrait of Troll Grummel, big nose, mossy skin, under a bridge, looking grumpy but harmless. Storybook illustration style, earthy tones."
    },
    "Wolf Grimbart": {
        name: "Wolf Grimbeard",
        description: "Wolf Grimbeard",
        catchphrase: "I could eat you up... I mean, I love good stories!",
        catchphraseContext: "before tricking someone",
        quirk: "licks lips when looking at someone",
        dominantPersonality: "cunning",
        emotionalTriggers: ["Hunger", "Full moon", "Red Riding Hood"],
        secondaryTraits: ["hungry", "charming", "dangerous"],
        speechStyle: ["smooth-talking", "growling", "ambiguous"],
        imagePrompt: "Portrait of Wolf Grimbart, grey wolf with glowing yellow eyes, sharp teeth, wearing a tattered vest, lurking in shadows. Storybook illustration style, slightly scary."
    },
    "Zauberer Sternenschweif": {
        name: "Wizard Star-Trail",
        description: "Wizard Star-Trail",
        catchphrase: "The stars never lie, one just has to know how to read them.",
        catchphraseContext: "when giving advice",
        quirk: "often forgets where he put his wand (he's holding it)",
        dominantPersonality: "wise",
        emotionalTriggers: ["Danger", "Cosmic imbalances", "Disrespect"],
        secondaryTraits: ["absent-minded", "powerful", "old-fashioned"],
        speechStyle: ["uplifted", "puzzling", "slow"],
        imagePrompt: "Portrait of Wizard Sternenschweif, long white beard, starry blue robe, tall pointed hat, holding a glowing staff. Storybook illustration style, magical blue aura."
    },
    "Zwerg Goldzahn": {
        name: "Dwarf Goldtooth",
        description: "Dwarf Goldtooth",
        catchphrase: "Dig deep, lift treasures!",
        catchphraseContext: "at work",
        quirk: "bites on coins to check if real",
        dominantPersonality: "hard-working",
        emotionalTriggers: ["Gold", "Gemstones", "Elves (dislikes them)"],
        secondaryTraits: ["stubborn", "strong", "crafty"],
        speechStyle: ["grumpy", "direct", "loud"],
        imagePrompt: "Portrait of Dwarf Goldzahn, long red beard, pickaxe over shoulder, miner's helmet with candle, dirty face. Storybook illustration style, underground lighting."
    }
};

const updatedCharacters = characters.map((char: any) => {
    const translation = translations[char.name];
    if (translation) {
        return {
            ...char,
            ...translation,
            visualProfile: {
                ...char.visualProfile,
                description: translation.description,
                imagePrompt: translation.imagePrompt
            }
        };
    }
    return char;
});

fs.writeFileSync(filePath, JSON.stringify(updatedCharacters, null, 2));
console.log(`Translated ${updatedCharacters.length} characters.`);
