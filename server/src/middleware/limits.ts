import { AIError } from "../errors.js";

/** Bounded process-local controls; production needs shared storage across instances. */
export class UsageLimits {
  private windows = new Map<string, { count: number; resetsAt: number }>();
  private active = new Map<string, number>();
  constructor(private now: () => number = Date.now, private maxKeys = 10000) {}
  private increment(key: string, max: number, durationMs: number, daily: boolean): void {
    const now = this.now();
    for (const [id, bucket] of this.windows) if (bucket.resetsAt <= now) this.windows.delete(id);
    let bucket = this.windows.get(key);
    if (!bucket) {
      if (this.windows.size >= this.maxKeys) throw new AIError("RATE_LIMITED", "Máy chủ đang bận. Vui lòng thử lại sau.", 429, true);
      bucket = { count: 0, resetsAt: now + durationMs }; this.windows.set(key, bucket);
    }
    if (bucket.count >= max) throw new AIError(daily ? "DAILY_LIMIT_REACHED" : "RATE_LIMITED", daily ? "Đã đạt giới hạn AI của tài khoản trong 24 giờ. Vui lòng thử lại sau." : "Bạn đang gửi quá nhanh. Vui lòng thử lại sau một phút.", 429, true);
    bucket.count += 1;
  }
  ip(identity: string, perMinute: number): void { this.increment(`ip:${identity}`, perMinute, 60000, false); }
  user(identity: string, perMinute: number): void { this.increment(`user:${identity}`, perMinute, 60000, false); }
  begin(identity: string, daily: number, concurrent: number): () => void {
    if ((this.active.get(identity) ?? 0) >= concurrent) throw new AIError("RATE_LIMITED", "Tài khoản đang có yêu cầu AI xử lý. Vui lòng đợi hoặc hủy yêu cầu trước.", 429, true);
    this.increment(`daily:${identity}`, daily, 24 * 60 * 60 * 1000, true);
    this.active.set(identity, (this.active.get(identity) ?? 0) + 1);
    let released = false;
    return () => { if (released) return; released = true; const count = (this.active.get(identity) ?? 1) - 1; if (count) this.active.set(identity, count); else this.active.delete(identity); };
  }
}
