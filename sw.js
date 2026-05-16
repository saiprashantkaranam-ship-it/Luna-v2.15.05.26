let pendingInput = null;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (event.data.type === 'PYTHON_INPUT_REPLY') {
    if (pendingInput) {
      pendingInput(new Response(event.data.answer, { status: 200 }));
      pendingInput = null;
    }
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/__luna_python_input') {
    const promptText = url.searchParams.get('prompt') || '';
    
    event.respondWith(new Promise(resolve => {
      pendingInput = resolve;
      // Notify the main thread UI that Python is asking for input
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'PYTHON_INPUT_REQUEST', prompt: promptText });
        });
      });
    }));
  }
});
