import {
  AppError,
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '@/shared/errors';

describe('Hierarquia de erros da aplicacao', () => {
  it('mapeia cada erro para o status HTTP correto', () => {
    expect(new ValidationError().statusCode).toBe(422);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new BusinessRuleError('regra').statusCode).toBe(409);
  });

  it('monta a mensagem de recurso nao encontrado', () => {
    expect(new NotFoundError('Unidade').message).toBe('Unidade nao encontrado.');
  });

  it('preserva detalhes de validacao e marca o erro como operacional', () => {
    const error = new ValidationError('Falhou', [{ field: 'email', message: 'invalido' }]);

    expect(error).toBeInstanceOf(AppError);
    expect(error.isOperational).toBe(true);
    expect(error.details).toHaveLength(1);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});
