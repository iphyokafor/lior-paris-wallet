import { PaginationQueryDto } from '../../../../src/features/users/dto/paginationQuery.input';

describe('PaginationQueryDto', () => {
  it('defaults to page=1 and limit=10', () => {
    const dto = new PaginationQueryDto();
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(10);
  });

  it('clamps page to minimum 1', () => {
    expect(new PaginationQueryDto(0, 10).page).toBe(1);
    expect(new PaginationQueryDto(-5, 10).page).toBe(1);
  });

  it('clamps limit to [1, 100]', () => {
    expect(new PaginationQueryDto(1, 0).limit).toBe(1);
    expect(new PaginationQueryDto(1, 1000).limit).toBe(100);
  });
});
