import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export const DeviceToken = createParamDecorator(
  (data: unknown, context: ExecutionContext): string => {
    const gqlCtx = GqlExecutionContext.create(context);
    const req = gqlCtx.getContext()?.req;
    const headerValue: string | undefined = req?.headers?.['devicetoken'] as any || (req?.headers as any)?.['deviceToken'];

    if (!headerValue || typeof headerValue !== 'string' || headerValue.trim() === '') {
      throw new BadRequestException('Missing deviceToken header');
    }

    return headerValue;
  },
);


