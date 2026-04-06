export type JsonApiLink = string | null;

export type JsonApiResource<TAttributes extends Record<string, unknown>> = {
  type: string;
  id: string;
  attributes: TAttributes;
};

export type JsonApiDocument<TData> = {
  data?: TData;
  errors?: Array<{
    status: string;
    title: string;
    detail?: string;
  }>;
  meta?: Record<string, unknown>;
  links?: Record<string, JsonApiLink>;
};

export const jsonApiData = <TData>(
  data: TData,
  options?: {
    meta?: Record<string, unknown>;
    links?: Record<string, JsonApiLink>;
  },
): JsonApiDocument<TData> => ({
  data,
  meta: options?.meta,
  links: options?.links,
});

export const jsonApiMeta = (
  meta: Record<string, unknown>,
): JsonApiDocument<never> => ({
  meta,
});
