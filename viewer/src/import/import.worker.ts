/// <reference lib="webworker" />
import { handleRequest } from './worker-handler';
import { importError } from './errors';
const scope = self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage = async (event: MessageEvent<unknown>) => {
  const response = await handleRequest(event.data);
  try { scope.postMessage(response); }
  catch {
    // If even this cannot be delivered, the controller's finite deadline terminates us.
    try { scope.postMessage({ protocol: 1, id: response.id, result: { ok: false, error: importError('WorkerError') } }); }
    catch { scope.close(); }
  }
};
