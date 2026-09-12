import type { Response } from 'express';
import type { Paginated, PaginationMeta } from '@/shared/types/pagination';

export type ApiEnvelope<T> = {
  success: true;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
};

export type ApiErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    timestamp: string;
  };
};

export const ok = <T>(res: Response, data: T, meta?: Record<string, unknown>): Response =>
  res.status(200).json({ success: true, data, ...(meta ? { meta } : {}) });

export const created = <T>(res: Response, data: T): Response =>
  res.status(201).json({ success: true, data });

export const noContent = (res: Response): Response => res.status(204).send();

export const page = <T>(res: Response, result: Paginated<T>): Response =>
  res.status(200).json({ success: true, data: result.data, meta: result.meta });

export const accepted = <T>(res: Response, data: T): Response =>
  res.status(202).json({ success: true, data });
