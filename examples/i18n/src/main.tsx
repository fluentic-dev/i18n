import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nDemo, ready } from './screen';
import './dropdowns.css';
import './styles.css';

ready.then(() =>
  createRoot(document.querySelector('#root')!).render(
    <StrictMode>
      <I18nDemo />
    </StrictMode>,
  )
);
