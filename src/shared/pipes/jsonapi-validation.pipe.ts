import { ArgumentMetadata, Injectable, ValidationPipe } from '@nestjs/common';

type JsonApiBodyEnvelope = {
  data?: {
    type?: string;
    id?: string;
    attributes?: Record<string, unknown>;
  };
};

@Injectable()
export class JsonApiValidationPipe extends ValidationPipe {
  override transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.type === 'body' && value && typeof value === 'object') {
      const maybeEnvelope = value as JsonApiBodyEnvelope;
      if (maybeEnvelope.data && typeof maybeEnvelope.data === 'object') {
        const attrs = maybeEnvelope.data.attributes;
        if (attrs && typeof attrs === 'object') {
          return super.transform(attrs, metadata);
        }
      }
    }

    return super.transform(value, metadata);
  }
}
