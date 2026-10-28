import type { Story } from '../../types/story';

export function SeriesArtNotice({ story }: { story: Story }) {
  if (story.metadata?.characterSeriesArt?.state !== 'partial') return null;
  return (
    <p role="status" className="my-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
      Eure Geschichte ist fertig. {story.metadata.characterSeriesArt.approved === 0
        ? 'Zu dieser Geschichte sind derzeit keine geprüften Illustrationen verfügbar.'
        : `${story.metadata.characterSeriesArt.approved} von ${story.metadata.characterSeriesArt.planned} geplanten Illustrationen sind verfügbar.`} Wir zeigen nur geprüfte Bilder und starten keine weiteren kostenpflichtigen Bildversuche automatisch.
    </p>
  );
}
