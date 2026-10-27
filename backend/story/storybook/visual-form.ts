/** A talking place keeps its physical form; a face does not turn a path into a standing mascot. */
type FigureForm = { name: string; species: string; appearance: string; isHuman: boolean };

export function isTerrainFigure(figure: Omit<FigureForm, "name">): boolean {
  if (figure.isHuman) return false;
  // Stop before features and scenery: a fox "in a garden" stays a fox.
  const subject = figure.appearance.split(/[,;.]|\b(?:with|wearing|beside|behind|holding|standing|sitting|in|on|at|under|that)\b/i)[0].trim();
  const terrain = /\b(path|road|trail|river|stream|pond|lake|meadow|garden|field)\s*$/i;
  return /\b(terrain|landscape)\b/i.test(figure.species) || terrain.test(figure.species) || terrain.test(subject);
}

export function terrainIdentityLine(figure: FigureForm): string {
  if (!isTerrainFigure(figure)) return "";
  return `${figure.name}'s body is the actual wide, flat stretch of terrain in this scene, continuous with the ground or water surface. Its one face and distinctive features are embedded together at a single spot in that same surface. Its connected edges may bend or curl while the long surface remains its body; a bend is part of this one character. Keep this physical form even when translating a reference portrait into the scene.`;
}
