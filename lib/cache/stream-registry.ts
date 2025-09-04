/**
 * In-memory registry for tracking active compare streams for cancellation
 * Uses globalThis to persist across module reloads in development
 */

interface StreamController {
  controller: AbortController;
  runId: string;
  modelId: string;
  createdAt: Date;
}

interface StreamRegistry {
  controllers: Map<string, StreamController>;
}

// Use globalThis to persist the registry across hot reloads
const REGISTRY_KEY = '__compare_stream_registry__';

declare global {
  var __compare_stream_registry__: StreamRegistry | undefined;
  var __stream_cleanup_interval__: NodeJS.Timeout | undefined;
}

function getRegistry(): StreamRegistry {
  if (!globalThis.__compare_stream_registry__) {
    globalThis.__compare_stream_registry__ = {
      controllers: new Map<string, StreamController>(),
    };
  }
  return globalThis.__compare_stream_registry__;
}

export function registerStreamController(
  runId: string,
  modelId: string,
  controller: AbortController,
) {
  const registry = getRegistry();
  const key = `${runId}:${modelId}`;

  registry.controllers.set(key, {
    controller,
    runId,
    modelId,
    createdAt: new Date(),
  });

  console.log(`[StreamRegistry] Registered ${key}`);
}

export function unregisterStreamController(runId: string, modelId: string) {
  const registry = getRegistry();
  const key = `${runId}:${modelId}`;

  const existed = registry.controllers.delete(key);
  if (existed) {
    console.log(`[StreamRegistry] Unregistered ${key}`);
  }
}

export function cancelStream(runId: string, modelId?: string): number {
  const registry = getRegistry();
  let canceledCount = 0;

  if (modelId) {
    // Cancel specific model
    const key = `${runId}:${modelId}`;
    const streamController = registry.controllers.get(key);

    if (streamController && !streamController.controller.signal.aborted) {
      streamController.controller.abort();
      registry.controllers.delete(key);
      canceledCount = 1;
      console.log(`[StreamRegistry] Canceled ${key}`);
    }
  } else {
    // Cancel all models for the run
    const keysToDelete: string[] = [];

    for (const [key, streamController] of registry.controllers.entries()) {
      if (
        streamController.runId === runId &&
        !streamController.controller.signal.aborted
      ) {
        streamController.controller.abort();
        keysToDelete.push(key);
        canceledCount++;
      }
    }

    keysToDelete.forEach((key) => registry.controllers.delete(key));
    console.log(
      `[StreamRegistry] Canceled ${canceledCount} streams for run ${runId}`,
    );
  }

  return canceledCount;
}

export function cleanupStaleControllers(maxAgeMs = 5 * 60 * 1000) {
  const registry = getRegistry();
  const now = new Date();
  const keysToDelete: string[] = [];

  for (const [key, streamController] of registry.controllers.entries()) {
    const ageMs = now.getTime() - streamController.createdAt.getTime();

    if (ageMs > maxAgeMs || streamController.controller.signal.aborted) {
      keysToDelete.push(key);
    }
  }

  keysToDelete.forEach((key) => registry.controllers.delete(key));

  if (keysToDelete.length > 0) {
    console.log(
      `[StreamRegistry] Cleaned up ${keysToDelete.length} stale controllers`,
    );
  }
}

// Cleanup stale controllers every 5 minutes
if (
  typeof globalThis !== 'undefined' &&
  !globalThis.__stream_cleanup_interval__
) {
  globalThis.__stream_cleanup_interval__ = setInterval(
    () => {
      cleanupStaleControllers();
    },
    5 * 60 * 1000,
  );
}
