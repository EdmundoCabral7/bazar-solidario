export interface Page<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function pageArgs({ page, pageSize }: { page: number; pageSize: number }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function toPage<T>(
  data: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
): Page<T> {
  return { data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
