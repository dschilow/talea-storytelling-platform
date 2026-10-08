// TEMPORARY preview harness for the doku reader (delete after use).
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import { OfflineClerkProvider } from './contexts/OfflineClerkProvider';
import { OfflineThemeProvider } from './contexts/ThemeContext';
import { DokuReaderView } from './screens/Doku/reader/DokuReaderView';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
try { localStorage.setItem('talea_theme', theme); } catch { /* preview only */ }

const Preview: React.FC = () => {
  const [doku, setDoku] = useState<any>(null);
  const [completed, setCompleted] = useState(false);
  useEffect(() => {
    fetch(`/__doku-fixtures/${params.get('fixture') || 'feuerwehr'}.json`).then((r) => r.json()).then(setDoku);
  }, []);
  if (!doku) return <p>lädt …</p>;
  return (
    <DokuReaderView
      doku={doku}
      dokuId={doku.id}
      isDark={theme === 'dark'}
      initialSectionIndex={null}
      onNavigate={() => undefined}
      completion={{ isCompleted: completed, isCompleting: false, error: null, onComplete: () => setCompleted(true) }}
    />
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <OfflineClerkProvider>
    <OfflineThemeProvider>
      <BrowserRouter>
        <Preview />
      </BrowserRouter>
    </OfflineThemeProvider>
  </OfflineClerkProvider>
);
