import React from 'react';
import ReactDOM from 'react-dom/client';
import Page from './app/page';
import i18n from './services/Localization'; // Import initialized i18n instance
import { I18nextProvider } from 'react-i18next';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nextProvider i18n={i18n}>
      <Page />
    </I18nextProvider>
  </React.StrictMode>
);