import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../src/shared/pipes/zod-validation.pipe';

describe('ZodValidationPipe Unit Tests', () => {
  it('throws when schema for metadata.type is not provided', () => {
    const pipe = new ZodValidationPipe({ body: z.object({}).strict() } as any);

    expect(() =>
      pipe.transform({ any: 'value' }, {
        type: 'query',
        metatype: null,
        data: '',
      } as any),
    ).toThrow(BadRequestException);
  });

  it('parses JSON:API body envelope (data.attributes)', () => {
    const pipe = new ZodValidationPipe({
      body: z.object({ name: z.string() }).strict(),
    } as any);

    const parsed = pipe.transform({ data: { attributes: { name: 'Alice' } } }, {
      type: 'body',
      metatype: null,
      data: '',
    } as any);

    expect(parsed).toEqual({ name: 'Alice' });
  });

  it('throws with issues when validation fails', () => {
    const pipe = new ZodValidationPipe({
      body: z.object({ name: z.string().min(1) }).strict(),
    } as any);

    try {
      pipe.transform({ data: { attributes: { name: '' } } }, {
        type: 'body',
        metatype: null,
        data: '',
      } as any);
      fail('Expected validation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      const response = (err as BadRequestException).getResponse() as any;
      expect(response).toHaveProperty('message', 'Validation failed');
      expect(Array.isArray(response.issues)).toBe(true);
    }
  });
});
