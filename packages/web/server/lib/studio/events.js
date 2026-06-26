/**
 * Events — Bridge between StudioOS internal event bus and external SSE hub.
 *
 * StudioOS publishes all events through its internal event bus.
 * This module bridges those events to the OpenChamber SSE hub
 * so the UI can consume them in real time.
 */

/**
 * Bridge StudioOS events to an external SSE hub.
 * @param {import('./runtime/event-bus.js').EventBus} eventBus
 * @param {Object} [eventHub] - The OpenChamber event hub (from event-stream)
 * @returns {() => void} Unsubscribe function
 */
export function bridgeEvents(eventBus, eventHub) {
  if (!eventHub) return () => {};

  const unsubscribe = eventBus.subscribeAll((event, payload) => {
    if (eventHub.emit) {
      eventHub.emit(`studio.${event}`, {
        ...payload,
        timestamp: Date.now(),
      });
    }
  });

  return unsubscribe;
}

/**
 * Create an SSE stream response for a specific project's events.
 * @param {import('./runtime/event-bus.js').EventBus} eventBus
 * @param {import('express').Response} res
 * @param {string} projectId
 * @returns {() => void} Cleanup function
 */
export function createProjectSSEStream(eventBus, res, projectId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial keepalive
  res.write(':ok\n\n');

  const sendEvent = (event, data) => {
    try {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      // Connection closed
    }
  };

  // Subscribe to all events and filter by projectId
  const unsubscribe = eventBus.subscribeAll((event, payload) => {
    const pId = payload?.projectId || payload?.task?.projectId;
    if (pId && pId !== projectId) return;

    sendEvent(`studio.${event}`, payload);
  });

  // Keepalive ping every 30s
  const keepalive = setInterval(() => {
    try {
      res.write(':keepalive\n\n');
    } catch {
      cleanup();
    }
  }, 30000);

  function cleanup() {
    unsubscribe();
    clearInterval(keepalive);
  }

  reqCleanup(res, cleanup);
  return cleanup;
}

/**
 * Register cleanup on connection close.
 */
function reqCleanup(res, cleanup) {
  res.on('close', cleanup);
  res.on('error', cleanup);
}
