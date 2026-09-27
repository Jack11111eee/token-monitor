'use strict';

// The real usage worker with a scripted collector in place of tokscale scans.
// A worker has its own module registry, so the stub has to be installed inside
// the thread, before usageWorker.js takes its reference to startCollector.
// Everything past the collector — the transform, the session archive store and
// the message protocol — is the production code.

const collector = require('../../src/shared/collector');

collector.startCollector = (options) => {
  let stopped = false;
  let ticks = 0;
  let tokens = 100;
  const summary = () => {
    const period = {
      totalTokens: tokens,
      clients: { codex: tokens },
      sessions: { 'codex:c1': { client: 'codex', sessionId: 'c1', totalTokens: tokens } }
    };
    return {
      deviceId: 'scripted',
      updatedAt: '2026-07-09T08:15:00.000Z',
      today: period,
      month: period,
      allTime: period
    };
  };
  return {
    async tick(reason) {
      ticks += 1;
      if (reason === 'crash') {
        setImmediate(() => { throw new Error('scripted crash'); });
        return new Promise(() => {});
      }
      if (reason === 'fail') {
        options.onError?.(new Error('scripted failure'), reason);
        return false;
      }
      if (reason === 'preview') options.onPreview?.(summary(), 'progress');
      tokens += 10;
      options.logger?.(`tick ${reason}`);
      options.onDiagnosticEvent?.({ subsystem: 'collector', code: 'scripted-tick' });
      await options.onUpdate(summary(), reason);
      return true;
    },
    refreshClient(clientId) {
      if (clientId !== 'codex') throw new TypeError(`Unsupported targeted usage client: ${clientId}`);
      return Promise.resolve(true);
    },
    stop() { stopped = true; },
    whenIdle: () => Promise.resolve(),
    getDiagnostics() {
      const writeEnabled = options.dailyHistoryArchiveWriteEnabled;
      return {
        state: stopped ? 'stopped' : 'idle',
        ticks,
        clients: options.clients,
        archiveWriteEnabled: typeof writeEnabled === 'function' ? writeEnabled() : writeEnabled ?? null
      };
    }
  };
};

require('../../src/shared/usageWorker');
