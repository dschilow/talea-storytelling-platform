import type { AgentDefinition, AgentId, AgentMessages } from '../types/agent';

export const agentDefinitions: Record<AgentId, AgentDefinition> = {
  tavi: {
    id: 'tavi',
    name: 'Tavi',
    title: 'Dein Begleiter',
    role: 'Zentraler Begleiter und Orchestrator',
    description: 'Tavi begleitet dich durch jedes Abenteuer und sorgt dafür, dass alles zusammenpasst.',
    tone: 'freundlich, warm, klug',
    colorPalette: {
      primary: '#c88498',
      secondary: '#f2d8e4',
      glow: 'rgba(200, 132, 152, 0.35)',
      bg: '#fdf1f5',
      bgSubtle: 'rgba(200, 132, 152, 0.08)',
      text: '#5c3643',
      border: 'rgba(200, 132, 152, 0.25)',
      gradient: 'linear-gradient(135deg, #f2d8e4 0%, #f9e9ca 100%)',
      darkPrimary: '#d5a0b2',
      darkGlow: 'rgba(213, 160, 178, 0.3)',
      darkBg: 'rgba(213, 160, 178, 0.1)',
    },
    animationType: 'float-pulse',
    messages: {
      preparing: [
        'Tavi sammelt deine Wünsche …',
        'Tavi bereitet dein Abenteuer vor …',
        'Tavi denkt kurz nach …',
      ],
      active: [
        'Tavi kümmert sich darum …',
        'Gleich ist alles bereit …',
      ],
      success: [
        'Dein Abenteuer ist bereit!',
        'Alles ist bereit für dich!',
      ],
    },
    featureArea: 'orchestration',
    isPrimary: true,
    targetAudience: 'both',
  },

  fluesterfeder: {
    id: 'fluesterfeder',
    name: 'Flüsterfeder',
    title: 'Hüterin der Erinnerungen',
    role: 'Memory, Erinnerungen, vergangene Abenteuer',
    description: 'Die Flüsterfeder bewahrt jede Geschichte, jedes Erlebnis und jede wichtige Erinnerung.',
    tone: 'ruhig, poetisch, sanft',
    colorPalette: {
      primary: '#9a8dbb',
      secondary: '#ece6f9',
      glow: 'rgba(154, 141, 187, 0.3)',
      bg: '#f5f1fb',
      bgSubtle: 'rgba(154, 141, 187, 0.08)',
      text: '#3f3950',
      border: 'rgba(154, 141, 187, 0.2)',
      gradient: 'linear-gradient(135deg, #ece6f9 0%, #ddd2f4 100%)',
      darkPrimary: '#b8a5de',
      darkGlow: 'rgba(184, 165, 222, 0.25)',
      darkBg: 'rgba(184, 165, 222, 0.1)',
    },
    animationType: 'feather-trail',
    messages: {
      preparing: [
        'Die Flüsterfeder breitet sich aus …',
        'Leise Erinnerungen werden gesammelt …',
      ],
      active: [
        'Die Flüsterfeder erinnert sich an dein letztes Abenteuer …',
        'Die Feder schreibt deine Geschichte weiter …',
      ],
      success: [
        'Deine Erinnerung ist sicher aufbewahrt.',
        'Die Flüsterfeder hat alles notiert.',
      ],
    },
    featureArea: 'memory',
    isPrimary: false,
    targetAudience: 'child',
  },

  sternenweber: {
    id: 'sternenweber',
    name: 'Sternenweber',
    title: 'Architekt der Abenteuer',
    role: 'Story-Planung, Story-DNA, Abenteuer-Vorbereitung',
    description: 'Der Sternenweber spinnt Themen, Figuren und Stimmungen zu einem einzigartigen Abenteuer.',
    tone: 'kreativ, geheimnisvoll, strukturiert',
    colorPalette: {
      primary: '#7f9dc0',
      secondary: '#dfeaf7',
      glow: 'rgba(127, 157, 192, 0.3)',
      bg: '#eff6fb',
      bgSubtle: 'rgba(127, 157, 192, 0.08)',
      text: '#303f50',
      border: 'rgba(127, 157, 192, 0.2)',
      gradient: 'linear-gradient(135deg, #dfeaf7 0%, #c6d9ef 100%)',
      darkPrimary: '#93b0cf',
      darkGlow: 'rgba(147, 176, 207, 0.25)',
      darkBg: 'rgba(147, 176, 207, 0.1)',
    },
    animationType: 'star-connect',
    messages: {
      preparing: [
        'Der Sternenweber sammelt Ideen …',
        'Sterne beginnen sich zu ordnen …',
      ],
      active: [
        'Der Sternenweber webt deine nächste Reise …',
        'Fäden aus Sternenstaub verbinden sich …',
        'Dein Abenteuer nimmt Gestalt an …',
      ],
      success: [
        'Der Sternenweber hat dein Abenteuer gewoben!',
        'Die Sterne haben sich verbunden.',
      ],
    },
    featureArea: 'story-planning',
    isPrimary: false,
    targetAudience: 'child',
  },

  traumwaechter: {
    id: 'traumwaechter',
    name: 'Traumwächter',
    title: 'Beschützer der Träume',
    role: 'Kindersicherheit, Inhaltsprüfung, Altersanpassung',
    description: 'Der Traumwächter sorgt dafür, dass jede Geschichte sanft, sicher und passend ist.',
    tone: 'ruhig, beschützend, dezent',
    colorPalette: {
      primary: '#6fae9c',
      secondary: '#ddf1ea',
      glow: 'rgba(111, 174, 156, 0.25)',
      bg: '#eef8f5',
      bgSubtle: 'rgba(111, 174, 156, 0.08)',
      text: '#2a4540',
      border: 'rgba(111, 174, 156, 0.2)',
      gradient: 'linear-gradient(135deg, #ddf1ea 0%, #c3e3d7 100%)',
      darkPrimary: '#8ac0af',
      darkGlow: 'rgba(138, 192, 175, 0.2)',
      darkBg: 'rgba(138, 192, 175, 0.1)',
    },
    animationType: 'shield-glow',
    messages: {
      preparing: [
        'Der Traumwächter schaut genau hin …',
      ],
      active: [
        'Der Traumwächter macht alles sanft und passend …',
      ],
      success: [
        'Der Traumwächter ist zufrieden – alles passt!',
        'Sicher und geborgen.',
      ],
    },
    featureArea: 'safety',
    isPrimary: false,
    targetAudience: 'parent',
  },

  funkenwerkstatt: {
    id: 'funkenwerkstatt',
    name: 'Funkenwerkstatt',
    title: 'Schmiede der Neugier',
    role: 'Quiz, Reflexion, Lernfragen',
    description: 'Die Funkenwerkstatt schmiedet spannende Fragen und Lernimpulse aus deinen Abenteuern.',
    tone: 'spielerisch, aktivierend, neugierig',
    colorPalette: {
      primary: '#d79a73',
      secondary: '#fae6dc',
      glow: 'rgba(215, 154, 115, 0.3)',
      bg: '#fdf4ef',
      bgSubtle: 'rgba(215, 154, 115, 0.08)',
      text: '#643c2b',
      border: 'rgba(215, 154, 115, 0.2)',
      gradient: 'linear-gradient(135deg, #fae6dc 0%, #f3d2c1 100%)',
      darkPrimary: '#deab87',
      darkGlow: 'rgba(222, 171, 135, 0.25)',
      darkBg: 'rgba(222, 171, 135, 0.1)',
    },
    animationType: 'spark-bounce',
    messages: {
      preparing: [
        'Die Funkenwerkstatt heizt sich auf …',
        'Funken beginnen zu sprühen …',
      ],
      active: [
        'Funken der Neugier fliegen umher …',
        'Spannende Fragen entstehen …',
      ],
      success: [
        'Die Funkenwerkstatt hat Fragen vorbereitet!',
        'Neue Fragen warten auf dich!',
      ],
    },
    featureArea: 'quiz',
    isPrimary: false,
    targetAudience: 'child',
  },

  artefaktschmied: {
    id: 'artefaktschmied',
    name: 'Artefaktschmied',
    title: 'Meister der Schätze',
    role: 'Rewards, Belohnungen, Artefakte',
    description: 'Der Artefaktschmied formt einzigartige Belohnungen aus den Errungenschaften deiner Reisen.',
    tone: 'wertig, kraftvoll, magisch',
    colorPalette: {
      primary: '#c5a46e',
      secondary: '#f7eed6',
      glow: 'rgba(197, 164, 110, 0.35)',
      bg: '#fcf8ee',
      bgSubtle: 'rgba(197, 164, 110, 0.08)',
      text: '#4d3e24',
      border: 'rgba(197, 164, 110, 0.25)',
      gradient: 'linear-gradient(135deg, #f7eed6 0%, #eedcae 100%)',
      darkPrimary: '#d4b56d',
      darkGlow: 'rgba(212, 181, 109, 0.3)',
      darkBg: 'rgba(212, 181, 109, 0.1)',
    },
    animationType: 'crystal-forge',
    messages: {
      preparing: [
        'Der Artefaktschmied wählt sein Material …',
        'Das Feuer der Schmiede erwacht …',
      ],
      active: [
        'Der Artefaktschmied formt eine neue Belohnung …',
        'Etwas Wertvolles entsteht …',
      ],
      success: [
        'Der Artefaktschmied hat ein Artefakt geschaffen!',
        'Eine neue Belohnung wartet auf dich!',
      ],
    },
    featureArea: 'rewards',
    isPrimary: false,
    targetAudience: 'child',
  },

  pfadfinder: {
    id: 'pfadfinder',
    name: 'Pfadfinder',
    title: 'Wegweiser der Neugier',
    role: 'Empfehlungen, Lernpfade, nächstes Abenteuer',
    description: 'Der Pfadfinder kennt die besten Wege und schlägt dir neue Abenteuer vor.',
    tone: 'ermutigend, abenteuerlich, orientierend',
    colorPalette: {
      primary: '#739e86',
      secondary: '#e1eee4',
      glow: 'rgba(115, 158, 134, 0.25)',
      bg: '#f2f8f3',
      bgSubtle: 'rgba(115, 158, 134, 0.08)',
      text: '#293a31',
      border: 'rgba(115, 158, 134, 0.2)',
      gradient: 'linear-gradient(135deg, #e1eee4 0%, #cadecf 100%)',
      darkPrimary: '#8fb39d',
      darkGlow: 'rgba(143, 179, 157, 0.2)',
      darkBg: 'rgba(143, 179, 157, 0.1)',
    },
    animationType: 'compass-spin',
    messages: {
      preparing: [
        'Der Pfadfinder studiert die Karte …',
      ],
      active: [
        'Der Pfadfinder hat neue Reisen für dich entdeckt …',
      ],
      success: [
        'Der Pfadfinder hat den perfekten Weg gefunden!',
        'Neue Abenteuer liegen vor dir!',
      ],
    },
    featureArea: 'recommendations',
    isPrimary: false,
    targetAudience: 'child',
  },

  leuchtglas: {
    id: 'leuchtglas',
    name: 'Leuchtglas',
    title: 'Spiegel des Wachstums',
    role: 'Elternsicht, Zusammenfassungen, Entwicklung',
    description: 'Das Leuchtglas zeigt Eltern, wie ihr Kind wächst und was es auf seinen Reisen gelernt hat.',
    tone: 'klar, wertschätzend, informativ',
    colorPalette: {
      primary: '#5f9fb4',
      secondary: '#dceef3',
      glow: 'rgba(95, 159, 180, 0.25)',
      bg: '#eef7f9',
      bgSubtle: 'rgba(95, 159, 180, 0.08)',
      text: '#233e48',
      border: 'rgba(95, 159, 180, 0.2)',
      gradient: 'linear-gradient(135deg, #dceef3 0%, #bcdce6 100%)',
      darkPrimary: '#78b2c6',
      darkGlow: 'rgba(120, 178, 198, 0.2)',
      darkBg: 'rgba(120, 178, 198, 0.1)',
    },
    animationType: 'lens-shimmer',
    messages: {
      preparing: [
        'Das Leuchtglas sammelt Eindrücke …',
      ],
      active: [
        'Das Leuchtglas fasst die Reise zusammen …',
        'Wachstum wird sichtbar …',
      ],
      success: [
        'Das Leuchtglas zeigt dir die Entwicklung.',
      ],
    },
    featureArea: 'parent-insight',
    isPrimary: false,
    targetAudience: 'parent',
  },
};

export const agentList = Object.values(agentDefinitions);

export function getAgent(id: AgentId): AgentDefinition {
  return agentDefinitions[id];
}

export function pickMessage(id: AgentId, phase: keyof AgentMessages): string {
  const msgs = agentDefinitions[id].messages[phase];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// Legacy compat
export const getRandomStatusMessage = (id: AgentId, state: string): string => {
  const phase = state === 'idle' || state === 'warning' || state === 'completed' || state === 'hidden'
    ? 'preparing'
    : state as keyof AgentMessages;
  return pickMessage(id, phase);
};
