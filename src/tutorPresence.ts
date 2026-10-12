export type TutorActivity = { focused: boolean; readingImages: boolean; hasError: boolean };
export type OrbState = 'idle' | 'focused' | 'processing' | 'responding' | 'error';
export const idleTutorActivity: TutorActivity = { focused: false, readingImages: false, hasError: false };
export function getTutorOrbState(activity: TutorActivity, responding: boolean, processing = false): OrbState {
  if (activity.hasError) return 'error';
  if (activity.readingImages || processing) return 'processing';
  if (responding) return 'responding';
  return activity.focused ? 'focused' : 'idle';
}
export const orbDescriptions: Record<OrbState, string> = {
  idle: 'Sẵn sàng cùng em khám phá bài toán',
  focused: 'Em đang soạn câu hỏi',
  processing: 'Đang chuẩn bị hoặc xử lý yêu cầu',
  responding: 'Đang hiển thị phản hồi vừa nhận được',
  error: 'Yêu cầu chưa thành công · xem lỗi bên dưới',
};
