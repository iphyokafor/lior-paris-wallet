import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
  Logger,
  Paramtype,
} from '@nestjs/common';
import { ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  private readonly logger = new Logger(ZodValidationPipe.name);
  constructor(private readonly schema: Partial<Record<Paramtype, ZodSchema>>) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const schema = this.schema[metadata.type];

    if (!schema) {
      this.logger.error('ZodValidationPipe error: ', {
        schema: this.schema,
        value,
        metadata,
      });
      throw new BadRequestException('Validation failed, schema not defined.');
    }
    let valueToParse = value;

    if (metadata.type === 'body' && value && typeof value === 'object') {
      const maybeEnvelope = value as any;
      if (
        maybeEnvelope.data &&
        typeof maybeEnvelope.data === 'object' &&
        maybeEnvelope.data.attributes &&
        typeof maybeEnvelope.data.attributes === 'object'
      ) {
        valueToParse = maybeEnvelope.data.attributes;
      }
    }

    const parsed = schema.safeParse(valueToParse);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        issues: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}
