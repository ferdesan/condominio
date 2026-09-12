import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import { env } from '@/config/env';
import { BadRequestError } from '@/shared/errors';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

export const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

function ensureDirectory(directory: string): void {
  if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
}

/**
 * Files are stored per tenant so a path traversal in one tenant can never reach
 * another. The original name is never used on disk.
 */
const storage = multer.diskStorage({
  destination: (req, _file, callback) => {
    const tenantId = req.auth?.tenantId ?? 'shared';
    const directory = path.join(uploadRoot, tenantId);
    ensureDirectory(directory);
    callback(null, directory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase().slice(0, 10);
    callback(null, `${randomUUID()}${extension}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.UPLOAD_MAX_SIZE_MB * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestError(`Tipo de arquivo nao permitido: ${file.mimetype}`));
      return;
    }
    callback(null, true);
  },
});

/** Relative path persisted in the database (never an absolute filesystem path). */
export function toStoredPath(file: Express.Multer.File): string {
  return path.relative(uploadRoot, file.path).split(path.sep).join('/');
}

export function resolveStoredPath(storedPath: string): string {
  const absolute = path.resolve(uploadRoot, storedPath);
  if (!absolute.startsWith(uploadRoot)) {
    throw new BadRequestError('Caminho de arquivo invalido.');
  }
  return absolute;
}
