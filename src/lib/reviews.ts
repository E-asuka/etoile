import reviewsData from '../data/reviews.json';

export interface Review {
  id: string;
  /** 1〜5 */
  rating: number;
  comment: string;
  author: string;
  age: string;
  job: string;
  date: string;
}

export const REVIEWS: Review[] = reviewsData;

/** 新しい順にソート済み一覧 */
export function getReviews(): Review[] {
  return [...REVIEWS].sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** トップなど用に件数制限 */
export function getLatestReviews(limit = 3): Review[] {
  return getReviews().slice(0, limit);
}

export function stars(rating: number): string {
  const n = Math.min(5, Math.max(0, Math.round(rating)));
  return '\u2605'.repeat(n) + '\u2606'.repeat(5 - n);
}
