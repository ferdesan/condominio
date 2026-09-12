import winston from 'winston';
import { env, isProduction, isTest } from './env';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const developmentFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${ts} ${level}: ${stack ?? message}${extra}`;
  }),
);

const productionFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'condominio-api' },
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console({ silent: isTest })],
  exitOnError: false,
});

export const httpLoggerStream = {
  write: (message: string) => logger.http(message.trim()),
};
