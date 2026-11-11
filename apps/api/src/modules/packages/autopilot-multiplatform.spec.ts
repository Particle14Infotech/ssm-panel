import { AutopilotDetectorService } from './autopilot-detector.service';

describe('AutopilotMultiplatformRealTest', () => {
  let detector: AutopilotDetectorService;

  beforeAll(() => {
    detector = new AutopilotDetectorService();
  });

  it('should detect real Telegram public channel latest posts', async () => {
    const res = await detector.autoDetect('durov', 'TELEGRAM');
    expect(res).toBeDefined();
    expect(res.profile.platform).toBe('TELEGRAM');
    expect(res.profile.handle).toContain('durov');
    expect(res.latestMedia).toBeDefined();
    if (res.latestMedia && res.latestMedia.isLiveDetected) {
      expect(res.latestMedia.platform).toBe('TELEGRAM');
      expect(res.latestMedia.mediaKey).toContain('durov/');
      expect(res.latestMedia.url).toContain('t.me/');
    }
  });

  it('should auto-detect Telegram channel link', async () => {
    const res = await detector.autoDetect('https://t.me/s/telegram');
    expect(res.profile.platform).toBe('TELEGRAM');
    expect(res.profile.handle).toContain('telegram');
  });

  it('should auto-detect TikTok handle and video formats', async () => {
    const res = await detector.autoDetect('@tiktok', 'TIKTOK');
    expect(res.profile.platform).toBe('TIKTOK');
    expect(res.profile.handle).toBe('@tiktok');
    expect(res.latestMedia?.platform).toBe('TIKTOK');
  });

  it('should auto-detect YouTube channel', async () => {
    const res = await detector.autoDetect('@mkbhd', 'YOUTUBE');
    expect(res.profile.platform).toBe('YOUTUBE');
    expect(res.latestMedia?.platform).toBe('YOUTUBE');
  });
});
