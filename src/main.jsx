import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { inject } from '@vercel/analytics';
import App from './App.jsx';
import './styles.css';

// Visitor counts (Vercel Web Analytics: no cookies). Share links and verification codes are recorded
// without their secret part, and query strings are dropped.
inject({
  beforeSend: (event) => {
    const url = new URL(event.url);
    url.pathname = url.pathname
      .replace(/^\/shared\/[^/]+/, '/shared/[token]')
      .replace(/^\/verify\/[^/]+/, '/verify/[code]');
    url.search = '';
    return { ...event, url: url.toString() };
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes cache
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
