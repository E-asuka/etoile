import sakura from '../assets/staff/staff-sakura.jpg';
import miki from '../assets/staff/staff-miki.jpg';
import yui from '../assets/staff/staff-yui.jpg';

/** スタッフID → 画像（src/assets/staff/staff-{id}.jpg） */
export const STAFF_IMAGES = {
  sakura,
  miki,
  yui,
} as const;

export type StaffImageId = keyof typeof STAFF_IMAGES;

export function getStaffImage(id: string) {
  if (id in STAFF_IMAGES) {
    return STAFF_IMAGES[id as StaffImageId];
  }
  return undefined;
}

/** React など URL 文字列が必要な場合用 */
export function getStaffImageSrcMap(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(STAFF_IMAGES).map(([id, img]) => [id, img.src]),
  );
}
