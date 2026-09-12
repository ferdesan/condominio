import type { DeepPartial, ObjectLiteral } from 'typeorm';
import type { Paginated, QueryOptions } from '@/shared/types/pagination';

/**
 * Row-level security envelope. Every repository call receives it, which makes
 * "forgot the tenant filter" impossible to express in the type system.
 */
export type TenantScope = {
  tenantId: string;
  /** Empty array = access to every condominium of the tenant. */
  condominiumIds?: string[];
  /** Bypasses tenant filtering. Only granted to platform operators. */
  superAdmin?: boolean;
};

export type RepositoryConfig = {
  /** Query builder alias, e.g. `unit`. */
  alias: string;
  /** Fields matched by the free-text `search` query param. */
  searchableFields: string[];
  /** Fields accepted as exact-match query params. */
  filterableFields: string[];
  /** Relations eagerly joined on read operations. */
  relations: string[];
  defaultSort: { field: string; order: 'ASC' | 'DESC' };
  /** Property holding the condominium id, when the entity is condominium-bound. */
  condominiumField?: string;
};

export interface ICrudRepository<T extends ObjectLiteral> {
  findMany(scope: TenantScope, options: QueryOptions): Promise<Paginated<T>>;
  findById(scope: TenantScope, id: string, withDeleted?: boolean): Promise<T | null>;
  findOneBy(scope: TenantScope, where: Partial<Record<keyof T, unknown>>): Promise<T | null>;
  create(scope: TenantScope, data: DeepPartial<T>): Promise<T>;
  update(scope: TenantScope, id: string, data: DeepPartial<T>): Promise<T | null>;
  softDelete(scope: TenantScope, id: string): Promise<boolean>;
  restore(scope: TenantScope, id: string): Promise<boolean>;
  count(scope: TenantScope, where?: Partial<Record<keyof T, unknown>>): Promise<number>;
  exists(scope: TenantScope, where: Partial<Record<keyof T, unknown>>): Promise<boolean>;
}
