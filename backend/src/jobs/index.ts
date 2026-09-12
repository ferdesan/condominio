import { logger } from '@/config/logger';
import { isTest } from '@/config/env';
import { runOverdueJob } from './overdue.job';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 30_000;

let intervalHandle: NodeJS.Timeout | null = null;
let bootHandle: NodeJS.Timeout | null = null;

/**
 * Agendador embutido (sem dependencia externa de cron). Em deploys com varias
 * replicas, defina `SCHEDULER_ENABLED=false` em todas menos uma ou promova
 * estes jobs para um worker dedicado.
 */
export function startScheduledJobs(): void {
  if (isTest || process.env.SCHEDULER_ENABLED === 'false') {
    logger.info('Scheduled jobs disabled for this instance');
    return;
  }

  bootHandle = setTimeout(() => {
    void runOverdueJob().catch((error: Error) =>
      logger.error(`Overdue job (boot) failed: ${error.message}`),
    );
  }, BOOT_DELAY_MS);
  bootHandle.unref();

  intervalHandle = setInterval(() => {
    void runOverdueJob().catch((error: Error) =>
      logger.error(`Overdue job failed: ${error.message}`),
    );
  }, SIX_HOURS_MS);
  intervalHandle.unref();

  logger.info('Scheduled jobs started (overdue sweep every 6h)');
}

export function stopScheduledJobs(): void {
  if (bootHandle) clearTimeout(bootHandle);
  if (intervalHandle) clearInterval(intervalHandle);
  bootHandle = null;
  intervalHandle = null;
}

export { runOverdueJob };
