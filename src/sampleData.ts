export type LessonStatus = 'Hoàn thành' | 'Đang học' | 'Chưa học';

export interface CurriculumLesson {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly status: LessonStatus;
}

export interface CurriculumChapter {
  readonly id: string;
  readonly number: number;
  readonly title: string;
  readonly progress: number;
  readonly lessons: readonly CurriculumLesson[];
}

// Keep fixture identity and metadata independent of the order of search results.
export const curriculumChapters: readonly CurriculumChapter[] = [
  {
    id: 'chapter-01', number: 1, title: 'Căn bậc hai và căn bậc ba', progress: 64,
    lessons: [
      { id: 'lesson-01-01', number: 1, title: 'Căn thức bậc hai', status: 'Hoàn thành' },
      { id: 'lesson-01-02', number: 2, title: 'Biến đổi biểu thức chứa căn', status: 'Đang học' },
      { id: 'lesson-01-03', number: 3, title: 'Rút gọn biểu thức', status: 'Chưa học' },
    ],
  },
  {
    id: 'chapter-02', number: 2, title: 'Hàm số bậc nhất', progress: 72,
    lessons: [
      { id: 'lesson-02-01', number: 1, title: 'Khái niệm hàm số', status: 'Hoàn thành' },
      { id: 'lesson-02-02', number: 2, title: 'Hàm số bậc nhất', status: 'Đang học' },
      { id: 'lesson-02-03', number: 3, title: 'Đồ thị hàm số y = ax + b', status: 'Chưa học' },
    ],
  },
  {
    id: 'chapter-03', number: 3, title: 'Hệ hai phương trình bậc nhất hai ẩn', progress: 0,
    lessons: [
      { id: 'lesson-03-01', number: 1, title: 'Kiến thức nền tảng', status: 'Hoàn thành' },
      { id: 'lesson-03-02', number: 2, title: 'Các dạng bài cơ bản', status: 'Đang học' },
      { id: 'lesson-03-03', number: 3, title: 'Luyện tập tổng hợp', status: 'Chưa học' },
    ],
  },
  {
    id: 'chapter-04', number: 4, title: 'Hệ thức lượng trong tam giác vuông', progress: 0,
    lessons: [
      { id: 'lesson-04-01', number: 1, title: 'Kiến thức nền tảng', status: 'Hoàn thành' },
      { id: 'lesson-04-02', number: 2, title: 'Các dạng bài cơ bản', status: 'Đang học' },
      { id: 'lesson-04-03', number: 3, title: 'Luyện tập tổng hợp', status: 'Chưa học' },
    ],
  },
];

export type AdminRowStatus = 'Hoạt động' | 'Đã xuất bản' | 'Bản nháp';
export type AdminTableKind = 'student' | 'question' | 'content';

export interface AdminTableRow {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly groupOrTopic: string;
  readonly value: string | number;
  readonly status: AdminRowStatus;
  readonly updatedAt: string;
}

export interface AdminTableData {
  readonly kind: AdminTableKind;
  readonly totalCount: number;
  readonly rows: readonly AdminTableRow[];
}

const studentTable: AdminTableData = {
  kind: 'student', totalCount: 100,
  rows: [
    { id: 'hs001', title: 'Nguyễn Minh Anh', subtitle: 'hs001', groupOrTopic: '9A1', value: '78%', status: 'Hoạt động', updatedAt: '12/10/2026' },
    { id: 'hs002', title: 'Nguyễn Hoàng Nam', subtitle: 'hs002', groupOrTopic: '9A1', value: '70%', status: 'Hoạt động', updatedAt: '12/10/2026' },
    { id: 'hs003', title: 'Trần Bảo Ngọc', subtitle: 'hs003', groupOrTopic: '9A1', value: '62%', status: 'Hoạt động', updatedAt: '12/10/2026' },
    { id: 'hs004', title: 'Lê Thanh Hà', subtitle: 'hs004', groupOrTopic: '9A1', value: '54%', status: 'Bản nháp', updatedAt: '12/10/2026' },
    { id: 'hs005', title: 'Phạm Đức Huy', subtitle: 'hs005', groupOrTopic: '9A1', value: '46%', status: 'Hoạt động', updatedAt: '12/10/2026' },
  ],
};

const questionTable: AdminTableData = {
  kind: 'question', totalCount: 248,
  rows: [
    { id: 'CH-001', title: 'Tính giá trị y = 2x + 3 khi x = 2.', subtitle: 'CH-001 · Trắc nghiệm', groupOrTopic: 'Hàm số', value: 'Cơ bản', status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'CH-002', title: 'Tìm điều kiện xác định của √(x − 2).', subtitle: 'CH-002 · Trắc nghiệm', groupOrTopic: 'Căn thức', value: 'Thông hiểu', status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'CH-003', title: 'Giải phương trình x² − 5x + 6 = 0.', subtitle: 'CH-003 · Trắc nghiệm', groupOrTopic: 'Hàm số', value: 'Vận dụng', status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'CH-004', title: 'Rút gọn biểu thức chứa căn bậc hai.', subtitle: 'CH-004 · Trắc nghiệm', groupOrTopic: 'Căn thức', value: 'Nâng cao', status: 'Bản nháp', updatedAt: '12/10/2026' },
    { id: 'CH-005', title: 'Tính cạnh huyền của tam giác vuông.', subtitle: 'CH-005 · Trắc nghiệm', groupOrTopic: 'Hàm số', value: 'Cơ bản', status: 'Đã xuất bản', updatedAt: '12/10/2026' },
  ],
};

const testTable: AdminTableData = {
  kind: 'content', totalCount: 24,
  rows: [
    { id: 'test-01', title: 'Kiểm tra 15 phút · Chương 2', subtitle: 'Nội dung 01', groupOrTopic: 'Hàm số', value: 10, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'test-02', title: 'Thi thử vào lớp 10 · Đề 01', subtitle: 'Nội dung 02', groupOrTopic: 'Căn thức', value: 12, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'test-03', title: 'Kiểm tra 45 phút · Đại số', subtitle: 'Nội dung 03', groupOrTopic: 'Hàm số', value: 14, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'test-04', title: 'Ôn tập giữa học kỳ I', subtitle: 'Nội dung 04', groupOrTopic: 'Căn thức', value: 16, status: 'Bản nháp', updatedAt: '12/10/2026' },
  ],
};

const contentTable: AdminTableData = {
  kind: 'content', totalCount: 24,
  rows: [
    { id: 'content-01', title: 'Căn thức bậc hai', subtitle: 'Nội dung 01', groupOrTopic: 'Hàm số', value: 10, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'content-02', title: 'Biến đổi biểu thức chứa căn', subtitle: 'Nội dung 02', groupOrTopic: 'Căn thức', value: 12, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'content-03', title: 'Hàm số bậc nhất', subtitle: 'Nội dung 03', groupOrTopic: 'Hàm số', value: 14, status: 'Đã xuất bản', updatedAt: '12/10/2026' },
    { id: 'content-04', title: 'Đồ thị hàm số y = ax + b', subtitle: 'Nội dung 04', groupOrTopic: 'Căn thức', value: 16, status: 'Bản nháp', updatedAt: '12/10/2026' },
  ],
};

export function getAdminTableData(name: string): AdminTableData {
  if (name === 'Học sinh' || name === 'Nhóm học sinh' || name === 'Kết quả') return studentTable;
  if (name === 'Câu hỏi') return questionTable;
  if (name === 'Đề kiểm tra' || name === 'Phòng thi') return testTable;
  return contentTable;
}
