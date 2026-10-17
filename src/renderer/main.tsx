import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import './styles/global.scss';
import { App } from './App';
import { bootstrap } from './bootstrap';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

void bootstrap(window.loopy).then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
