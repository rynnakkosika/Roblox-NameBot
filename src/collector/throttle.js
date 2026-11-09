// Sliding-window throttle that also honours Roblox's x-ratelimit-* response headers (research R6).

export const realClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export class Throttle {
  /** @param {{perWindow: number, windowMs: number, clock?: {now, sleep}}} options */
  constructor({ perWindow, windowMs, clock = realClock }) {
    this.perWindow = perWindow;
    this.windowMs = windowMs;
    this.clock = clock;
    this.stamps = [];
    this.pausedUntil = 0;
  }

  /** Waits until another request is allowed, then reserves it. */
  async take() {
    for (;;) {
      const now = this.clock.now();
      if (now < this.pausedUntil) {
        await this.clock.sleep(this.pausedUntil - now);
        continue;
      }
      while (this.stamps.length && this.stamps[0] <= now - this.windowMs) this.stamps.shift();
      if (this.stamps.length < this.perWindow) {
        this.stamps.push(now);
        return;
      }
      await this.clock.sleep(this.stamps[0] + this.windowMs - now);
    }
  }

  /** Pauses until the window resets when Roblox says no requests remain. */
  observe(headers) {
    const get = (name) => (typeof headers?.get === 'function' ? headers.get(name) : headers?.[name]);
    const remaining = parseInt(String(get('x-ratelimit-remaining') ?? ''), 10);
    const reset = parseInt(String(get('x-ratelimit-reset') ?? ''), 10);
    if (remaining === 0 && Number.isFinite(reset)) {
      this.pause(reset * 1000);
    }
  }

  pause(ms) {
    this.pausedUntil = Math.max(this.pausedUntil, this.clock.now() + ms);
  }
}
