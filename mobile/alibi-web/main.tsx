import { bootstrap, post, reportError, request } from "./bridge";

async function start() {
  await bootstrap();
  const [{ default: React }, { createRoot }, { AlibiLauncher }, { director }] = await Promise.all([
    import("react"), import("react-dom/client"),
    import("../../frontend/screens/Game/alibi/AlibiLauncher"), import("../../frontend/screens/Game/alibi/audio"),
  ]);
  let controller: import("../../frontend/screens/Game/alibi/controller").AlibiController | null = null;
  let stage = false;
  let savedSound = true;
  let foreground = true;
  let saveTimer = 0;
  const save = () => {
    window.clearTimeout(saveTimer);
    if (!controller) return Promise.resolve();
    return request({ type: "save", key: "talea.alibi.session.v1", value: JSON.stringify({ ...controller.exportSession(), soundOn: foreground ? director.soundOn : savedSound }) });
  };
  const bind = (ctrl: NonNullable<typeof controller>) => {
    if (controller) return;
    controller = ctrl;
    if (import.meta.env.VITE_ALIBI_QA) {
      void import("../../frontend/screens/Game/alibi/lab/autoplay").then(({ playTo }) => {
        Object.assign(window, { __alibiTest: { ctrl, director, playTo: (stop: any, opt?: any) => playTo(ctrl, stop, opt) } });
      });
    }
    try {
      const raw = localStorage.getItem("talea.alibi.session.v1");
      if (raw) ctrl.restoreSession(JSON.parse(raw));
    } catch { /* Old or incomplete saves start at setup. */ }
    savedSound = director.soundOn;
    ctrl.subscribe(() => { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(() => { void save().catch(reportError); }, 150); });
  };
  const onStageChange = (open: boolean) => {
    const wasOpen = stage;
    stage = open;
    post({ type: "stage", open });
    if (open) controller?.resumeSession();
    else if (wasOpen) { controller?.suspendSession(); void save().catch(reportError); }
  };
  window.__alibiBack = () => {
    if (stage) window.dispatchEvent(new Event("alibi:back"));
    else void save().then(() => request({ type: "exit" })).catch(reportError);
  };
  window.__alibiLifecycle = active => {
    if (foreground === active) return;
    foreground = active;
    director.pauseAmbience(!active);
    if (!active) {
      savedSound = director.soundOn;
      director.soundOn = false;
      controller?.suspendSession();
      director.stop();
      void save().catch(reportError);
      document.documentElement.classList.add("alibi-paused");
    } else {
      director.soundOn = savedSound;
      document.documentElement.classList.remove("alibi-paused");
      if (stage) controller?.resumeSession();
    }
  };
  createRoot(document.getElementById("root")!).render(
    <React.Fragment>
      <header className="mobile-alibi-header"><button onClick={() => window.__alibiBack()} aria-label="Zurück zur Talea-App">‹ Zurück</button><span>Talea · Spiele</span></header>
      <main className="mobile-alibi-launcher"><AlibiLauncher onController={bind} onStageChange={onStageChange} /></main>
      <div className="mobile-alibi-privacy">Spiel pausiert</div>
    </React.Fragment>,
  );
  post({ type: "ready" });
}
void start().catch(reportError);
