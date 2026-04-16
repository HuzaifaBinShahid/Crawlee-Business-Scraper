/**
 * Structured progress events emitted on stdout for the backend to parse.
 * Format: [PROGRESS] {json-object}
 * Events: task_start, task_end, record_saved, record_skipped, record_duplicate, record_failed
 */

export function emitProgress(event, data = {}) {
  try {
    const payload = { event, ...data, timestamp: Date.now() };
    // Write directly to stdout to avoid winston formatting
    process.stdout.write('[PROGRESS] ' + JSON.stringify(payload) + '\n');
  } catch (_) { }
}

export default { emitProgress };
