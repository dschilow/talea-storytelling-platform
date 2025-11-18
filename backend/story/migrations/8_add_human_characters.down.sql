-- Rollback: Remove human characters added in migration 8

DELETE FROM character_pool
WHERE name IN (
  'König Wilhelm',
  'König Friedrich',
  'Königin Isabella',
  'Prinz Alexander',
  'Prinzessin Rosalinde',
  'Müller Hans',
  'Schmied Konrad',
  'Bäcker Wilhelm',
  'Hexe Griselda',
  'Zauberer Merlin',
  'Magierin Luna',
  'Räuber Rolf',
  'Stiefmutter Brunhilde',
  'Weise Frau Margarethe',
  'Gelehrter Professor Theodor',
  'Händler Gustav',
  'Wirtin Martha',
  'Diener Johann',
  'Magd Elsa',
  'Hirtenjunge Peter',
  'Bauerntochter Greta'
);
