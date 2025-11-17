import { registerEnumType } from '@nestjs/graphql';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

registerEnumType(LogLevel, {
  name: 'LogLevel',
  description: 'Log level enum',
});
