import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { InventoryItem, Skill } from "../avatar/avatar";
import { avatarDB } from "../avatar/db";

interface EvaluateRewardsRequest {
    avatarId: string;
    storyId: string;
    storyTags: string[]; // e.g. ["pirate", "adventure", "sea"]
    storyTitle: string;
}

interface EvaluateRewardsResponse {
    newItems: InventoryItem[];
    upgradedItems: InventoryItem[];
    newSkills: Skill[];
    message: string;
}

export const evaluateStoryRewards = api(
    { expose: true, auth: true, method: "POST", path: "/gamification/evaluate-rewards" },
    async (req: EvaluateRewardsRequest): Promise<EvaluateRewardsResponse> => {
        const { avatarId, storyId, storyTags, storyTitle } = req;
        console.log(`[Gamification] Evaluating rewards for avatar ${avatarId} from story ${storyId}`);

        // 1. Fetch current avatar inventory
        const row = await avatarDB.queryRow<{ inventory: string; skills: string }>`
      SELECT inventory, skills FROM avatars WHERE id = ${avatarId}
    `;

        if (!row) {
            throw APIError.notFound("Avatar not found");
        }

        let inventory: InventoryItem[] = JSON.parse(row.inventory || '[]');
        let skills: Skill[] = JSON.parse(row.skills || '[]');

        const newItems: InventoryItem[] = [];
        const upgradedItems: InventoryItem[] = [];

        // 2. LOGIC: Check for Evolution (Existing Items)
        // If we have an item with a matching tag, upgrade it.
        // Limit to 1 upgrade per story to avoid spam.
        let upgradeHappened = false;

        for (const item of inventory) {
            if (upgradeHappened) break;

            // Check if item tags overlap with story tags
            const hasOverlap = item.tags.some(tag => storyTags.includes(tag));
            if (hasOverlap && item.level < 3) {
                item.level += 1;
                item.name = evolveItemName(item.name, item.level);
                item.description = `Upgraded version of ${item.name}. More powerful!`;
                upgradedItems.push(item);
                upgradeHappened = true;
                console.log(`[Gamification] Upgraded item: ${item.name} to level ${item.level}`);
            }
        }

        // 3. LOGIC: New Item Drop (if no upgrade happened)
        if (!upgradeHappened) {
            // Create a new item based on the first tag
            const mainTag = storyTags[0] || "mystery";
            const newItem: InventoryItem = {
                id: crypto.randomUUID(),
                name: `Novice ${capitalize(mainTag)} Artifact`,
                type: 'TOOL', // Default, should be refined by AI later
                level: 1,
                sourceStoryId: storyId,
                description: `A memento from ${storyTitle}`,
                visualPrompt: `A magical ${mainTag} artifact, fantasy style, icon`,
                tags: [mainTag],
                acquiredAt: new Date().toISOString()
            };
            inventory.push(newItem);
            newItems.push(newItem);
            console.log(`[Gamification] Dropped new item: ${newItem.name}`);
        }

        // 4. LOGIC: Synergy Check (Simple Example)
        // If we have "Sword" and "Physics", make "Lightning Sword"
        // This is a placeholder for more complex logic
        const hasSword = inventory.some(i => i.tags.includes('sword') || i.name.toLowerCase().includes('sword'));
        const hasPhysics = inventory.some(i => i.tags.includes('physics') || i.tags.includes('storm'));

        if (hasSword && hasPhysics) {
            // Check if we already have the fusion
            const hasFusion = inventory.some(i => i.name === 'Lightning Sword');
            if (!hasFusion) {
                const fusionItem: InventoryItem = {
                    id: crypto.randomUUID(),
                    name: 'Lightning Sword',
                    type: 'WEAPON',
                    level: 5,
                    sourceStoryId: 'fusion',
                    description: 'A blade crackling with the power of the storm!',
                    visualPrompt: 'A sword made of lightning, glowing blue, epic fantasy',
                    tags: ['sword', 'physics', 'lightning', 'legendary'],
                    acquiredAt: new Date().toISOString()
                };
                inventory.push(fusionItem);
                newItems.push(fusionItem);
                console.log(`[Gamification] FUSION! Created Lightning Sword`);
            }
        }

        // 5. Save updates
        await avatarDB.exec`
      UPDATE avatars
      SET inventory = ${JSON.stringify(inventory)},
          skills = ${JSON.stringify(skills)},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${avatarId}
    `;

        return {
            newItems,
            upgradedItems,
            newSkills: [],
            message: "Rewards processed"
        };
    }
);

function evolveItemName(originalName: string, level: number): string {
    const base = originalName.replace(/Novice |Advanced |Master /g, '');
    if (level === 2) return `Advanced ${base}`;
    if (level === 3) return `Master ${base}`;
    return base;
}

function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}
