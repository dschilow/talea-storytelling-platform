
// Create avatars for port 5178
const avatarId1 = 'test-avatar-1-' + Date.now();
const avatarId2 = 'test-avatar-2-' + Date.now(); 

const avatar1 = {
  id: avatarId1,
  userId: 'local-user',
  name: 'Max der Abenteurer',
  description: 'Ein mutiger Junge aus der Stadt, der gerne Abenteuer erlebt',
  physicalTraits: { eyeColor: 'blau', hairColor: 'braun', specialFeatures: ['Brille'] },
  personalityTraits: { base: 'neutral' },
  imageUrl: undefined,
  creationType: 'ai-generated',
  status: 'complete',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const avatar2 = {
  id: avatarId2,
  userId: 'local-user', 
  name: 'Luna die Weise',
  description: 'Eine kluge Zauberin mit großem Herzen für Tiere und Natur',
  physicalTraits: { eyeColor: 'grün', hairColor: 'silber', specialFeatures: ['Zauberstab'] },
  personalityTraits: { base: 'wise' },
  imageUrl: undefined,
  creationType: 'ai-generated',
  status: 'complete',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Store avatars
localStorage.setItem('avatar_' + avatarId1, JSON.stringify(avatar1));
localStorage.setItem('avatar_' + avatarId2, JSON.stringify(avatar2));

// Create avatars list
const avatarsList = [
  { id: avatarId1, name: avatar1.name },
  { id: avatarId2, name: avatar2.name }
];
localStorage.setItem('avatars_list', JSON.stringify(avatarsList));

console.log('Created avatars:', avatarsList);
console.log('Please navigate to http://localhost:5178/avatar to see your avatars!');
console.log('Note: You were accessing port 5173, but that server is not running.');
console.log('The correct server is running on port 5178.');

