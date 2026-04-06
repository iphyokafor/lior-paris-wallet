import { jsonApiData, jsonApiMeta } from '../../../src/shared/jsonapi/jsonapi';

describe('jsonapi helpers', () => {
  it('jsonApiData returns data with optional meta/links', () => {
    expect(jsonApiData({ ok: true } as any)).toEqual({
      data: { ok: true },
      meta: undefined,
      links: undefined,
    });

    expect(
      jsonApiData([{ id: '1' }] as any, {
        meta: { total: 1 },
        links: { next: '/x', prev: null },
      }),
    ).toEqual({
      data: [{ id: '1' }],
      meta: { total: 1 },
      links: { next: '/x', prev: null },
    });
  });

  it('jsonApiMeta returns meta-only document', () => {
    expect(jsonApiMeta({ a: 1 })).toEqual({ meta: { a: 1 } });
  });
});
