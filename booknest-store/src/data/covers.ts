/**
 * Ảnh bìa sách theo id — Open Library (ISBN thật) + ảnh dự phòng chất lượng cao.
 * Admin có thể ghi đè qua upload / URL trong CMS.
 */

/**
 * Build URL bìa Open Library.
 *
 * `default=false` là BẮT BUỘC: không có tham số này, Open Library trả về HTTP 200
 * kèm một GIF trong suốt 1×1 (43 byte) khi thiếu bìa. Trình duyệt decode được ảnh
 * đó nên `onError` của <img> không bao giờ chạy → BookCover tưởng ảnh đã tải xong,
 * ẩn lớp gradient và hiển thị 1 pixel trong suốt kéo giãn = bìa trắng trơn.
 * Với `default=false`, ISBN thiếu bìa trả 404 → `onError` chạy → fallback đúng.
 */
function ol(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
}

function unsplash(photoId: string, size = 600): string {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${size}&q=80`;
}

export const BOOK_COVERS: Record<number, string> = {
  // Atomic Habits — James Clear
  1: ol("9780735211292"),
  // Đắc nhân tâm — How to Win Friends (bản Simon & Schuster)
  2: ol("9781439167342"),
  // The Alchemist
  3: ol("9780062315007"),
  // Rich Dad Poor Dad
  4: ol("9781612680194"),
  // Sapiens
  5: ol("9780062316097"),
  // Harry Potter 1
  6: ol("9780590353427"),
  // Atomic Habits Workbook (bản bìa khác để phân biệt với id 1)
  7: ol("9780593189641"),
  // Spiritual / life (Many Lives style substitute)
  8: ol("9780553376050"),
  // Totto-chan
  9: ol("9784770020673"),
  // Think and Grow Rich
  10: ol("9781585424337"),
  // Doraemon
  11: ol("9781591169253"),
  // English Grammar in Use
  12: ol("9781108457651"),
  // Clean Code
  13: ol("9780132350884"),
  // AI Superpowers
  14: ol("9781328546395"),
  // Story of Civilization style
  15: ol("9780671418007"),
  // Psychology of Money
  16: ol("9780857197689"),
  // Zero to One
  17: ol("9780804139298"),
  // Lean Startup
  18: ol("9780307887894"),
  // Cooking
  19: unsplash("photo-1466637574441-749b8f19452f"),
  // Parenting
  20: unsplash("photo-1503454537195-1dcabb73ffb9"),
  // Blockchain / crypto
  21: unsplash("photo-1639762681485-074b7f938ba0"),
  // Health
  22: unsplash("photo-1571019614242-c5c5dee9f50b"),
};

export function coverForBook(id: number) {
  return (
    BOOK_COVERS[id] ||
    `${unsplash("photo-1544947950-fa07a98d237f")}&sig=${id}`
  );
}
