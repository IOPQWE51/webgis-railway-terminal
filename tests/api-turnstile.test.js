import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { turnstileEnforced, verifyTurnstile } from '../api/auth.js';

const SECRET = 'test-secret-32-chars-long-xxxxxxxx';

describe('Turnstile 人机验证门控', () => {
    const OLD = { ...process.env };
    beforeEach(() => {
        process.env.JWT_SECRET = SECRET;
        process.env.TURNSTILE_SECRET_KEY = 'ts-secret-key';
        vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => {
        process.env = { ...OLD };
        vi.unstubAllGlobals();
    });

    it('未配置密钥时不强制（本地开发/灰度期优雅跳过）', async () => {
        delete process.env.TURNSTILE_SECRET_KEY;
        expect(turnstileEnforced()).toBe(false);
        expect(await verifyTurnstile(undefined)).toBe(true);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('配置后强制；缺令牌/空令牌直接 false 且不发请求', async () => {
        expect(turnstileEnforced()).toBe(true);
        expect(await verifyTurnstile(undefined)).toBe(false);
        expect(await verifyTurnstile('')).toBe(false);
        expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('siteverify success=true → true，且 secret/response/remoteip 正确入参', async () => {
        globalThis.fetch = vi.fn(async () => ({ json: async () => ({ success: true }) }));
        expect(await verifyTurnstile('tok', '1.2.3.4')).toBe(true);
        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.method).toBe('POST');
        expect(init.body.get('secret')).toBe('ts-secret-key');
        expect(init.body.get('response')).toBe('tok');
        expect(init.body.get('remoteip')).toBe('1.2.3.4');
    });

    it('siteverify success=false → false', async () => {
        globalThis.fetch = vi.fn(async () => ({ json: async () => ({ success: false }) }));
        expect(await verifyTurnstile('tok')).toBe(false);
    });

    it('验证服务失联 → fail-closed false', async () => {
        globalThis.fetch = vi.fn(async () => { throw new Error('net down'); });
        expect(await verifyTurnstile('tok')).toBe(false);
    });
});
