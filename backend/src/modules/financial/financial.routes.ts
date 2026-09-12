import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorize } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { idParamSchema, uuidSchema } from '@/shared/dto/common.schema';
import { created, ok, page } from '@/shared/http/api-response';
import { BaseCrudController } from '@/shared/http/base-crud.controller';
import { createCrudRouter } from '@/shared/http/crud-router';
import { parseQueryOptions } from '@/shared/http/query-parser';
import { buildRequestContext } from '@/shared/services/request-context';
import type { Charge } from './entities/charge.entity';
import type { Expense } from './entities/expense.entity';
import type { FinancialCategory } from './entities/financial-category.entity';
import { paymentRepository } from './repositories/payment.repository';
import {
  createChargeSchema,
  createExpenseSchema,
  createFinancialCategorySchema,
  financialSummaryQuerySchema,
  generateChargesSchema,
  payExpenseSchema,
  registerPaymentSchema,
  updateChargeSchema,
  updateExpenseSchema,
  updateFinancialCategorySchema,
  type CreateChargeDTO,
  type CreateExpenseDTO,
  type CreateFinancialCategoryDTO,
  type FinancialSummaryQuery,
  type GenerateChargesDTO,
  type PayExpenseDTO,
  type RegisterPaymentDTO,
  type UpdateChargeDTO,
  type UpdateExpenseDTO,
  type UpdateFinancialCategoryDTO,
} from './schemas/financial.schema';
import { chargeService } from './services/charge.service';
import { expenseService } from './services/expense.service';
import { financialCategoryService } from './services/financial-category.service';

export const financialRouter = Router();

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

financialRouter.use(
  '/categories',
  createCrudRouter({
    resource: 'financial-category',
    controller: new BaseCrudController<
      FinancialCategory,
      CreateFinancialCategoryDTO,
      UpdateFinancialCategoryDTO
    >(financialCategoryService),
    createSchema: createFinancialCategorySchema,
    updateSchema: updateFinancialCategorySchema,
  }),
);

// ---------------------------------------------------------------------------
// Cobrancas
// ---------------------------------------------------------------------------

const generateCharges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    created(res, await chargeService.generateMonthly(context, req.body as GenerateChargesDTO));
  } catch (error) {
    next(error);
  }
};

const registerPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const result = await chargeService.registerPayment(
      context,
      req.params.id,
      req.body as RegisterPaymentDTO,
    );
    created(res, result);
  } catch (error) {
    next(error);
  }
};

const cancelCharge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const { reason } = req.body as { reason?: string };
    ok(res, await chargeService.cancel(context, req.params.id, reason));
  } catch (error) {
    next(error);
  }
};

const chargeSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const query = req.query as unknown as FinancialSummaryQuery;
    ok(res, await chargeService.summary(context, query.condominiumId, query.referenceMonth));
  } catch (error) {
    next(error);
  }
};

const delinquency = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await chargeService.delinquency(context, String(req.query.condominiumId)));
  } catch (error) {
    next(error);
  }
};

const applyLateFees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const condominiumId = req.body?.condominiumId as string | undefined;
    ok(res, await chargeService.applyLateFees(context, condominiumId));
  } catch (error) {
    next(error);
  }
};

const myCharges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    ok(res, await chargeService.myCharges(buildRequestContext(req)));
  } catch (error) {
    next(error);
  }
};

financialRouter.use(
  '/charges',
  createCrudRouter({
    resource: 'charge',
    controller: new BaseCrudController<Charge, CreateChargeDTO, UpdateChargeDTO>(chargeService),
    createSchema: createChargeSchema,
    updateSchema: updateChargeSchema,
    extend: (router) => {
      router.get('/my', authorize('charge:read'), myCharges);
      router.get(
        '/summary',
        authorize('charge:read'),
        validate({ query: financialSummaryQuerySchema }),
        chargeSummary,
      );
      router.get(
        '/delinquency',
        authorize('charge:read'),
        validate({ query: z.object({ condominiumId: uuidSchema }) }),
        delinquency,
      );
      router.post(
        '/generate',
        authorize('charge:create'),
        validate({ body: generateChargesSchema }),
        generateCharges,
      );
      router.post(
        '/apply-late-fees',
        authorize('charge:manage'),
        validate({ body: z.object({ condominiumId: uuidSchema.optional() }) }),
        applyLateFees,
      );
      router.post(
        '/:id/payments',
        authorize('payment:create'),
        validate({ params: idParamSchema, body: registerPaymentSchema }),
        registerPayment,
      );
      router.post(
        '/:id/cancel',
        authorize('charge:update'),
        validate({
          params: idParamSchema,
          body: z.object({ reason: z.string().max(1000).optional() }),
        }),
        cancelCharge,
      );
    },
  }),
);

// ---------------------------------------------------------------------------
// Pagamentos (somente leitura: a baixa e feita pela cobranca)
// ---------------------------------------------------------------------------

financialRouter.get(
  '/payments',
  authorize('payment:read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const context = buildRequestContext(req);
      page(res, await paymentRepository.findMany(context.scope, parseQueryOptions(req)));
    } catch (error) {
      next(error);
    }
  },
);

// ---------------------------------------------------------------------------
// Despesas
// ---------------------------------------------------------------------------

const payExpense = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    ok(res, await expenseService.pay(context, req.params.id, req.body as PayExpenseDTO));
  } catch (error) {
    next(error);
  }
};

const expenseSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const context = buildRequestContext(req);
    const query = req.query as unknown as FinancialSummaryQuery;
    ok(res, await expenseService.summary(context, query.condominiumId, query.referenceMonth));
  } catch (error) {
    next(error);
  }
};

financialRouter.use(
  '/expenses',
  createCrudRouter({
    resource: 'expense',
    controller: new BaseCrudController<Expense, CreateExpenseDTO, UpdateExpenseDTO>(expenseService),
    createSchema: createExpenseSchema,
    updateSchema: updateExpenseSchema,
    extend: (router) => {
      router.get(
        '/summary',
        authorize('expense:read'),
        validate({ query: financialSummaryQuerySchema }),
        expenseSummary,
      );
      router.post(
        '/:id/pay',
        authorize('expense:update'),
        validate({ params: idParamSchema, body: payExpenseSchema }),
        payExpense,
      );
    },
  }),
);
