export class PaginationQueryDto {
  page: number;
  limit: number;

  constructor(page: number = 1, limit: number = 10) {
    this.page = Math.max(page, 1);
    this.limit = Math.min(Math.max(limit, 1), 100);
  }
}
