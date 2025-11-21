
// Standalone test script to verify logic without Encore dependencies
// We copy the critical functions here to test their logic in isolation.

// --- MOCKS & TYPES ---

interface VisualProfile {
    imagePrompt?: string;
    description?: string;
    ageApprox?: number;
    gender?: string;
    hair?: { color?: string; length?: string; type?: string; style?: string };
    eyes?: { color?: string; size?: string; shape?: string };
    skin?: { tone?: string; features?: string[] };
    clothingCanonical?: { outfit?: string; top?: string; bottom?: string; footwear?: string };
    accessories?: string[];
    consistentDescriptors?: string[];
    species?: string;
    colorPalette?: string[];
}

interface AvatarDetail {
    id: string;
    name: string;
    description?: string;
    visualProfile?: VisualProfile;
}

interface CharacterTemplate {
    id: string;
    name: string;
    role: string;
    archetype: string;
    visualProfile: VisualProfile;
    emotionalNature: any;
}

// --- LOGIC UNDER TEST (Copied from FourPhaseOrchestrator) ---

function visualProfileToImagePrompt(vp: any): string {
    if (!vp) return 'no visual details available';

    // OPTIMIZATION: Use the pre-generated, consistent image prompt if available
    if (vp.imagePrompt && typeof vp.imagePrompt === 'string' && vp.imagePrompt.length > 10) {
        // Strip "Portrait of [Name], " prefix if present to fit into scene description
        let prompt = vp.imagePrompt;
        // Remove common prefixes that might have been generated
        prompt = prompt.replace(/^Portrait of [^,]+,\s*/i, '');
        prompt = prompt.replace(/^A portrait of [^,]+,\s*/i, '');

        return prompt;
    }

    const parts: string[] = [];

    // AGE FIRST (critical for size relationships)
    if (vp.ageApprox) {
        parts.push(`${vp.ageApprox} years old`);

        // Add explicit size constraints based on age
        if (vp.ageApprox <= 7) {
            parts.push('small child size');
        } else if (vp.ageApprox <= 10) {
            parts.push('child-sized');
        }
    }

    if (vp.gender) parts.push(vp.gender);

    if (vp.hair) {
        const hairParts = [];
        if (vp.hair.color) hairParts.push(vp.hair.color);
        if (vp.hair.length) hairParts.push(vp.hair.length);
        if (vp.hair.type) hairParts.push(vp.hair.type);
        if (vp.hair.style) hairParts.push(vp.hair.style);
        if (hairParts.length > 0) parts.push(`${hairParts.join(' ')} hair`);
    }

    if (vp.eyes?.color) parts.push(`${vp.eyes.color} eyes`);

    if (vp.skin?.tone) parts.push(`${vp.skin.tone} skin`);

    if (vp.clothingCanonical) {
        const clothingParts = [];
        if (vp.clothingCanonical.outfit) clothingParts.push(vp.clothingCanonical.outfit);
        else {
            if (vp.clothingCanonical.top) clothingParts.push(vp.clothingCanonical.top);
            if (vp.clothingCanonical.bottom) clothingParts.push(vp.clothingCanonical.bottom);
        }
        if (vp.clothingCanonical.footwear) clothingParts.push(vp.clothingCanonical.footwear);
        if (clothingParts.length > 0) parts.push(`wearing ${clothingParts.join(', ')}`);
    }

    if (vp.accessories && vp.accessories.length > 0) {
        parts.push(`with ${vp.accessories.join(', ')}`);
    }

    if (vp.consistentDescriptors && vp.consistentDescriptors.length > 0) {
        parts.push(vp.consistentDescriptors.join(', '));
    }

    return parts.join(', ');
}

function buildEnhancedImagePrompt(
    baseDescription: string,
    avatarDetails: AvatarDetail[],
    characterAssignments: Map<string, CharacterTemplate>
): string {
    // OPTIMIZATION v2.4: Check imageDescription for genre keywords
    const genreKeywords = ['medieval', 'fantasy', 'magic', 'castle', 'knight', 'princess', 'dragon', 'fairy', 'wizard', 'witch', 'kingdom', 'ancient', 'steampunk', 'victorian', 'retro', 'historical', 'old world', 'village', 'steam', 'gear', 'clockwork', 'brass'];
    const descriptionLower = baseDescription.toLowerCase();
    const isGenreScene = genreKeywords.some(keyword => descriptionLower.includes(keyword));
    const isSteampunk = descriptionLower.includes('steampunk') || descriptionLower.includes('steam') || descriptionLower.includes('gear') || descriptionLower.includes('clockwork');

    // Build character lookup with AGE for sorting
    interface CharacterInfo {
        name: string;
        description: string;
        age: number;
    }

    const allCharacters = new Map<string, CharacterInfo>();

    // Add avatars with FULL descriptions + age
    for (const avatar of avatarDetails) {
        let visualContext = avatar.visualProfile
            ? visualProfileToImagePrompt(avatar.visualProfile)
            : (avatar.description || 'default appearance');

        // OPTIMIZATION v2.4: Apply genre-aware costume override
        if (isGenreScene && visualContext.includes('hoodie')) {
            if (isSteampunk) {
                visualContext = visualContext
                    .replace(/hoodie/gi, "vest with brass buttons")
                    .replace(/jeans/gi, "striped trousers")
                    .replace(/t-shirt/gi, "ruffled shirt")
                    .replace(/sneakers/gi, "heavy boots")
                    .replace(/casual jacket/gi, "victorian coat");
            } else {
                visualContext = visualContext
                    .replace(/hoodie/gi, "hooded tunic")
                    .replace(/jeans/gi, "breeches")
                    .replace(/t-shirt/gi, "linen shirt")
                    .replace(/sneakers/gi, "leather boots")
                    .replace(/casual jacket/gi, "medieval tunic");
            }
        }

        const age = avatar.visualProfile?.ageApprox || 8; // fallback

        allCharacters.set(avatar.name.toLowerCase(), {
            name: avatar.name,
            description: visualContext,
            age
        });
    }

    // Add supporting characters with FULL descriptions
    for (const char of characterAssignments.values()) {
        let fullDesc = visualProfileToImagePrompt(char.visualProfile);

        // OPTIMIZATION v2.4: Apply genre-aware costume override for pool characters too
        if (isGenreScene && fullDesc.includes('hoodie')) {
            if (isSteampunk) {
                fullDesc = fullDesc
                    .replace(/hoodie/gi, "vest with brass buttons")
                    .replace(/jeans/gi, "striped trousers")
                    .replace(/t-shirt/gi, "ruffled shirt")
                    .replace(/sneakers/gi, "heavy boots");
            } else {
                fullDesc = fullDesc
                    .replace(/hoodie/gi, "hooded tunic")
                    .replace(/jeans/gi, "breeches")
                    .replace(/t-shirt/gi, "linen shirt")
                    .replace(/sneakers/gi, "leather boots");
            }
        }

        const age = 30; // Adults default to 30

        allCharacters.set(char.name.toLowerCase(), {
            name: char.name,
            description: fullDesc,
            age
        });
    }

    // Extract character names mentioned in this scene
    const charactersInScene: CharacterInfo[] = [];

    for (const [charName, charInfo] of allCharacters.entries()) {
        if (descriptionLower.includes(charName)) {
            charactersInScene.push(charInfo);
        }
    }

    // If no characters found, include ALL (fallback)
    if (charactersInScene.length === 0) {
        charactersInScene.push(...allCharacters.values());
    }

    // CRITICAL: Sort by AGE (youngest first) to establish clear size hierarchy
    charactersInScene.sort((a, b) => a.age - b.age);

    // Add explicit age ordering instruction
    const characterBlock = charactersInScene
        .map(c => `${c.name}: ${c.description}`)
        .join("\n\n");

    const ageOrder = charactersInScene.length > 1
        ? `\nIMPORTANT: Characters listed from youngest to oldest. Maintain size relationships - ${charactersInScene[0].name} (${charactersInScene[0].age}y) must be SMALLER than any older character.`
        : '';

    return `
${baseDescription}

CHARACTERS IN THIS SCENE (lock face/outfit/age):
${characterBlock}${ageOrder}

Art style: watercolor illustration, Axel Scheffler style, warm colours, child-friendly
IMPORTANT: Keep each character's face, age, outfit, hair, and species consistent across all images. Do not add text or watermarks.
ENSURE SINGLE INSTANCE OF EACH CHARACTER. Do not generate twins or clones.
    `.trim();
}


// --- TESTS ---

async function runTests() {
    console.log("🧪 Starting Optimization Logic Tests (Standalone)...");

    // TEST 1: visualProfileToImagePrompt with pre-generated imagePrompt
    console.log("\n[Test 1] Testing visualProfileToImagePrompt with pre-generated prompt...");
    const vpWithPrompt = {
        imagePrompt: "Portrait of Baker Braun, a stout man with a white apron and flour on his nose.",
        description: "A baker",
        ageApprox: 45
    };

    const result1 = visualProfileToImagePrompt(vpWithPrompt);
    console.log("Input:", vpWithPrompt.imagePrompt);
    console.log("Output:", result1);

    if (result1 === "Baker Braun, a stout man with a white apron and flour on his nose." ||
        result1 === "Portrait of Baker Braun, a stout man with a white apron and flour on his nose.") {
        console.log("✅ Test 1 Passed: Used pre-generated prompt");
    } else {
        console.log("❌ Test 1 Failed: Did not use pre-generated prompt correctly");
    }

    // TEST 2: visualProfileToImagePrompt WITHOUT pre-generated prompt (fallback logic)
    console.log("\n[Test 2] Testing visualProfileToImagePrompt fallback logic...");
    const vpFallback = {
        ageApprox: 8,
        gender: "boy",
        hair: { color: "brown", style: "messy" },
        eyes: { color: "green" },
        clothingCanonical: { outfit: "blue overalls" }
    };
    const result2 = visualProfileToImagePrompt(vpFallback);
    console.log("Output:", result2);

    if (result2.includes("8 years old") && result2.includes("child-sized") && result2.includes("blue overalls")) {
        console.log("✅ Test 2 Passed: Generated correct fallback description");
    } else {
        console.log("❌ Test 2 Failed: Fallback description missing key elements");
    }

    // TEST 3: buildEnhancedImagePrompt with Age Sorting
    console.log("\n[Test 3] Testing buildEnhancedImagePrompt age sorting...");
    const avatarDetails = [
        { id: "a1", name: "Timmy", visualProfile: { ageApprox: 6, gender: "boy" } },
        { id: "a2", name: "Sarah", visualProfile: { ageApprox: 12, gender: "girl" } }
    ];
    const charAssignments = new Map<string, CharacterTemplate>();
    charAssignments.set("MENTOR", {
        id: "1", name: "Gandalf", role: "guide", archetype: "wizard",
        visualProfile: { description: "old wizard", ageApprox: 70, species: "human", colorPalette: [] },
        emotionalNature: { dominant: "wise", secondary: [] }
    } as CharacterTemplate);

    const prompt = buildEnhancedImagePrompt(
        "A magical forest scene with Timmy, Sarah and Gandalf.",
        avatarDetails,
        charAssignments
    );

    console.log("Generated Prompt Snippet:\n", prompt.substring(0, 500));

    if (prompt.includes("Timmy") && prompt.includes("Sarah") && prompt.includes("Gandalf")) {
        const charBlockIndex = prompt.indexOf("CHARACTERS IN THIS SCENE");
        const timmyIndex = prompt.indexOf("Timmy", charBlockIndex);
        const sarahIndex = prompt.indexOf("Sarah", charBlockIndex);
        const gandalfIndex = prompt.indexOf("Gandalf", charBlockIndex);

        if (timmyIndex < sarahIndex && sarahIndex < gandalfIndex) {
            console.log("✅ Test 3 Passed: Characters sorted by age (Youngest First)");
        } else {
            console.log("❌ Test 3 Failed: Character sorting incorrect", { timmyIndex, sarahIndex, gandalfIndex });
        }
    } else {
        console.log("❌ Test 3 Failed: Missing characters");
    }

    // TEST 4: Genre-Aware Costume Override
    console.log("\n[Test 4] Testing Genre-Aware Costume Override...");
    const avatarHoodie = [
        { id: "a3", name: "ModernKid", visualProfile: { ageApprox: 10, clothingCanonical: { outfit: "red hoodie and jeans" } } }
    ];
    const promptFantasy = buildEnhancedImagePrompt(
        "A medieval castle scene with ModernKid.",
        avatarHoodie,
        new Map()
    );

    if (promptFantasy.includes("hooded tunic") && !promptFantasy.includes("hoodie")) {
        console.log("✅ Test 4a Passed: Fantasy override applied (hoodie -> hooded tunic)");
    } else {
        console.log("❌ Test 4a Failed: Fantasy override not applied", promptFantasy);
    }

    const promptSteampunk = buildEnhancedImagePrompt(
        "A steampunk city with gears and ModernKid.",
        avatarHoodie,
        new Map()
    );

    if (promptSteampunk.includes("vest with brass buttons") && !promptSteampunk.includes("hoodie")) {
        console.log("✅ Test 4b Passed: Steampunk override applied");
    } else {
        console.log("❌ Test 4b Failed: Steampunk override not applied", promptSteampunk);
    }

    console.log("\n🏁 Tests Completed");
}

runTests().catch(console.error);
