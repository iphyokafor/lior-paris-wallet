import { randomBytes } from 'node:crypto';

export const generateWalletTag = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '')
    .slice(0, 4);

  const suffix = randomBytes(2).toString('hex');

  return `${slug}-${suffix}`;
};
