import { useState } from 'react';
import { LoaderCircle, Send, Pin, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { useBackend } from '@/hooks/useBackend';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import type { NotificationKind } from '../../../backend/user/notification-model';
import { NOTIFICATION_TOPICS } from './notification-ui';

export default function AnnouncementComposer({ open, onOpenChange, onPublished }: {
  open: boolean; onOpenChange: (open: boolean) => void; onPublished: () => void;
}) {
  const backend = useBackend();
  const [kind, setKind] = useState<Exclude<NotificationKind, 'sharing'>>('update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [href, setHref] = useState('');
  const [actionLabel, setActionLabel] = useState('');
  const [pinned, setPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await backend.user.publishAnnouncement({
        kind, title, body, href: href.trim() || undefined,
        actionLabel: actionLabel.trim() || undefined, pinned,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      });
      toast.success('Die Neuigkeit wurde veröffentlicht.');
      setTitle(''); setBody(''); setHref(''); setActionLabel(''); setPinned(false); setExpiresAt('');
      onOpenChange(false);
      onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Neuigkeit konnte nicht veröffentlicht werden.');
    } finally { setBusy(false); }
  }

  const topic = NOTIFICATION_TOPICS.find((item) => item.kind === kind)!;
  const Icon = topic.icon;
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <DialogContent className="notifications-dialog notification-composer">
        <div>
          <span className="notification-eyebrow">FÜR ALLE TALEA-MITGLIEDER</span>
          <DialogTitle className="notification-dialog-title">Neuigkeit veröffentlichen</DialogTitle>
          <DialogDescription>Updates, neue Inhalte oder hilfreiche Hinweise – klar und persönlich.</DialogDescription>
        </div>
        <form onSubmit={publish} className="notification-composer-grid">
          <fieldset disabled={busy} className="notification-form-fields">
            <label>Mitteilungsart
              <select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
                {NOTIFICATION_TOPICS.filter((item) => item.kind !== 'sharing').map((item) => <option key={item.kind} value={item.kind}>{item.label}</option>)}
              </select>
            </label>
            <label>Titel <span className="notification-field-hint">{title.length}/140</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={140} placeholder="Was gibt es Neues?" />
            </label>
            <label>Mitteilung
              <textarea value={body} onChange={(event) => setBody(event.target.value)} required maxLength={3000} rows={5} placeholder="Erzähle, was sich geändert hat und was man damit entdecken kann …" />
            </label>
            <div className="notification-form-pair">
              <label>Talea-Link <span className="notification-field-hint">optional</span>
                <input value={href} onChange={(event) => setHref(event.target.value)} maxLength={500} placeholder="/doku?mode=audio" />
              </label>
              <label>Button-Text <span className="notification-field-hint">optional</span>
                <input value={actionLabel} onChange={(event) => setActionLabel(event.target.value)} maxLength={60} placeholder="Jetzt entdecken" disabled={!href || busy} />
              </label>
            </div>
            <label>Automatisch ausblenden ab <span className="notification-field-hint">optional</span>
              <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </label>
            <label className="notification-checkbox"><input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} /> Oben im Eingang anheften</label>
          </fieldset>
          <aside className="notification-preview">
            <span className="notification-eyebrow">SO WIRD'S ANGEZEIGT</span>
            <div className={`notification-preview-card notification-kind-${kind}`}>
              <span className="notification-topic"><Icon size={15} />{topic.label}</span>
              {pinned && <span className="notification-pin"><Pin size={12} /> Im Fokus</span>}
              <h3>{title.trim() || 'Deine nächste Neuigkeit'}</h3>
              <p>{body.trim() || 'Hier erscheint dein Text. Kurze Absätze und ein konkreter nächster Schritt machen die Mitteilung besonders hilfreich.'}</p>
              {href && <span className="notification-preview-action">{actionLabel.trim() || 'Mehr erfahren'} <ArrowUpRight size={15} /></span>}
            </div>
            <p className="notification-caption">Die Neuigkeit erscheint im Eingang aller Mitglieder, die diese Mitteilungsart aktiviert haben.</p>
          </aside>
          <div className="notification-composer-footer">
            {error && <p role="alert" className="notification-inline-error">{error}</p>}
            <button type="button" className="notification-button" disabled={busy} onClick={() => onOpenChange(false)}>Abbrechen</button>
            <button type="submit" className="notification-button notification-button-primary" disabled={busy || !title.trim() || !body.trim()}>
              {busy ? <LoaderCircle className="notification-spin" size={16} /> : <Send size={16} />} {busy ? 'Wird veröffentlicht …' : 'Jetzt veröffentlichen'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
