import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

if (
  typeof HTMLInputElement !== 'undefined' &&
  !('switch' in HTMLInputElement.prototype)
) {
  void import('input-switch-polyfill/input-switch-polyfill.css');
  void import('input-switch-polyfill');
}

if (
  typeof HTMLElement !== 'undefined' &&
  !Object.hasOwn(HTMLElement.prototype, 'focusGroup')
) {
  void import('@microsoft/focusgroup-polyfill').then(
    ({ polyfillBodyAndObserve }) => {
      polyfillBodyAndObserve();
    },
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
