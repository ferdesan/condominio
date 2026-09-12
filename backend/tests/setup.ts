import 'reflect-metadata';

// Ambiente determinístico para os testes: SQLite em memoria, sem Redis,
// sem rate limit e com segredos fixos.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-32-characters';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.REDIS_ENABLED = 'false';
process.env.SWAGGER_ENABLED = 'true';
process.env.LOG_LEVEL = 'error';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.UPLOAD_DIR = 'uploads-test';

jest.setTimeout(30_000);
