import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsAttachmentsEnabled(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAttachmentsEnabled',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (value === true) {
            const attachmentsConfigService = (args.object as any).attachmentsConfigService;
            if (attachmentsConfigService) {
              return attachmentsConfigService.isEnabled;
            }
          }
          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Attachments are currently disabled, cannot save to server';
        },
      },
    });
  };
}
