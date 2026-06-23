// Service worker registration.
// Extracted from index.html to avoid inline scripts (CSP requires external script tags).
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (isLocalhost) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      return;
    }

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => console.log('SW registered:', registration.scope))
      .catch((err) => console.log('SW registration failed:', err));
  });
}