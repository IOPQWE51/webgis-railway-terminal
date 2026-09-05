// api/auth.js
// 🔐 轻登录与会话：用户名 + 密码（bcryptjs）+ JWT（jose，HS256，7 天）
// - 用户库与点位库均存 Vercel KV（Upstash Redis），键按用户名隔离：
//     user:<username>   → { hash, createdAt }
//     points:<username> → 点位数组（写入前经 validatePointsPayload 硬校验）
// - 会话 Cookie：et_session（HttpOnly / SameSite=Lax，生产追加 Secure）
// - 端点：POST ?action=register|login|logout、GET ?action=me（register/login 走 auth 限流防爆破）
// - 遗留迁移：首个注册用户自动认领旧全局池 earth_terminal_global_points 与
//   旧战术库 earth_terminal_dark2d_points（对称迁移，防孤儿键），旧键改名归档

import { Redis } from '@upstash/redis';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { randomBytes } from 'node:crypto';
import { withRateLimit } from './_lib/rateLimiter.js';
import { validatePointsPayload, getClientIp } from './_lib/validation.js';

export const COOKIE_NAME = 'et_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 天
const LEGACY_GLOBAL_KEY = 'earth_terminal_global_points';
const LEGACY_DARK2D_KEY = 'earth_terminal_dark2d_points';

// ---------- 纯函数层（tests/api-auth.test.js 覆盖） ----------

export function normalizeUsername(raw) {
    const u = String(raw ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,24}$/.test(u)) return null;
    return u;
}

// 已知限制：72 为字符数而非 bcrypt 的 72 字节，超长多字节密码会被截断
export function validatePassword(raw) {
    const p = String(raw ?? '');
    return p.length >= 8 && p.length <= 72 ? p : null;
}

export function validateCredentials(body) {
    if (!body || typeof body !== 'object') return { ok: false, error: '请求体格式错误' };
    const username = normalizeUsername(body.username);
    if (!username) return { ok: false, error: '用户名需为 3-24 位小写字母、数字、- 或 _' };
    const password = validatePassword(body.password);
    if (!password) return { ok: false, error: '密码长度需为 8-72 位' };
    return { ok: true, username, password };
}

// 📧 可选邮箱（找回通道）：未填/空白 → ok:null；填了就必须是合法形态，
// 避免把 "not-an-email" 之类的脏值写进库里（届时重置邮件会 4xx，用户被无辜判死刑）
export function resolveOptionalEmail(raw) {
    if (raw === undefined || raw === null) return { ok: true, email: null };
    if (typeof raw !== 'string') return { ok: false, error: '邮箱格式不正确' };
    const email = raw.trim().toLowerCase();
    if (email === '') return { ok: true, email: null };
    // 白名单字符集（RFC 5322 常见子集）：挡掉 < / " / 空格之类的注入字符
    if (email.length > 200 || !/^[a-z0-9._%+-]{1,64}@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) {
        return { ok: false, error: '邮箱格式不正确' };
    }
    return { ok: true, email };
}

// 🎲 找回随机密钥：96 bit 熵 → base64url 12 字符（无歧义字符，邮件复制友好）
export function generateRandomPassword() {
    return randomBytes(9).toString('base64url');
}

// 🔢 邮箱验证码：6 位纯数字（邮件里口头念，输入框好打），10 分钟有效由调用方 TTL 控制
export function generateEmailCode() {
    return String(100000 + randomBytes(4).readUInt32BE(0) % 900000);
}

// 📨 Resend 发信：密钥缺失或发信失败一律返回 false（交由调用方决定 UX，绝不静默吞）
export async function sendEmailViaResend(to, subject, html) {
    const key = process.env.RESEND_API_KEY;
    if (!key) return false;
    try {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'EarthTerminal 站长台 <onboarding@resend.dev>',
                to: [to],
                subject,
                html,
            }),
        });
        return res.ok === true;
    } catch {
        return false;
    }
}

export async function sendResetEmail(to, username, newPassword) {
    const html = [
        `<p>你好，站长「${username}」：</p>`,
        `<p>你的 EarthTerminal 节点密钥已被重置，新的临时密钥是：</p>`,
        `<p style="font-size:20px;font-family:monospace;background:#f1f5f9;padding:12px 16px;border-radius:8px;display:inline-block"><strong>${newPassword}</strong></p>`,
        `<p>登录后可以在「数据解析与管理 → 作战身份卡」右上角断开旧链路。此密钥随机生成，请登录后尽快修改为你自己的密码……哦不对，这个系统还没做改密功能，那先记好它吧 😼</p>`,
        `<p style="color:#94a3b8;font-size:12px">如果这不是你的操作，说明有人在尝试重置你的账号——原旧密钥已失效，请立即使用新密钥登录。</p>`,
    ].join('');
    return sendEmailViaResend(to, '【EarthTerminal】节点密钥重置', html);
}

// ✉ 注册绑定确认邮件（防拿别人邮箱注册骚扰：收件人只有点开验证码才算数）
export async function sendVerifyEmail(to, username, code) {
    const html = [
        `<p>你好：</p>`,
        `<p>代号「${username}」正在 EarthTerminal（eterm.vercel.app）注册账号，并填了这个邮箱作为找回通道。</p>`,
        `<p>如果这就是你：回到注册弹窗，输入下面的验证码完成绑定（10 分钟内有效）：</p>`,
        `<p style="font-size:24px;letter-spacing:6px;font-family:monospace;background:#f1f5f9;padding:12px 20px;border-radius:8px;display:inline-block"><strong>${code}</strong></p>`,
        `<p style="color:#94a3b8;font-size:12px">如果这不是你的操作，直接忽略本邮件即可——不输入验证码，这个邮箱不会收到任何后续邮件（包括密钥重置）。</p>`,
    ].join('');
    return sendEmailViaResend(to, '【EarthTerminal】邮箱绑定验证码', html);
}

// 🚧 注册总量保险丝：防人肉/脚本灌库撑爆 KV。env REGISTRATION_CAP 可调；
// 极端并发下可能略超 1-2 个（keys 扫描非原子），作为滥用熔断足够
export const DEFAULT_REGISTRATION_CAP = 500;
export function parseRegistrationCap(raw) {
    const n = Number.parseInt(String(raw ?? ''), 10);
    return Number.isInteger(n) && n > 0 ? n : DEFAULT_REGISTRATION_CAP;
}

export function serializeSessionCookie(token, isProduction) {
    const parts = [`${COOKIE_NAME}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', `Max-Age=${SESSION_MAX_AGE}`, 'SameSite=Lax'];
    if (isProduction) parts.push('Secure');
    return parts.join('; ');
}

export function serializeClearedCookie(isProduction) {
    const parts = [`${COOKIE_NAME}=`, 'HttpOnly', 'Path=/', 'Max-Age=0', 'SameSite=Lax'];
    if (isProduction) parts.push('Secure');
    return parts.join('; ');
}

export function parseSessionCookie(req) {
    const header = String(req.headers?.cookie || '');
    const m = header.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
    if (!m) return null;
    try {
        return decodeURIComponent(m[1]);
    } catch {
        // 🍪 Cookie 值客户端可控，畸形百分号编码（如裸 %）按无会话处理，绝不抛 URIError
        return null;
    }
}

// 🔑 弱密钥会让 HS256 签名可被暴力破解：任何入口遇到弱密钥立即拒绝，绝不静默降级
export function isStrongSecret(secret) {
    return typeof secret === 'string' && secret.length >= 32;
}

const assertSecret = (secret) => {
    if (!isStrongSecret(secret)) {
        throw new Error('JWT_SECRET 必须为至少 32 位的字符串');
    }
};

const secretKey = (secret) => new TextEncoder().encode(secret);

export async function signSession(username, secret, expiry = '7d') {
    assertSecret(secret);
    return new SignJWT({ sub: username })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiry)
        .sign(secretKey(secret));
}

export async function verifySessionToken(token, secret) {
    if (!token || !secret) return null;
    try {
        assertSecret(secret);
        const { payload } = await jwtVerify(token, secretKey(secret));
        // 🧭 sub 过 normalizeUsername 规范化，防大小写变体分裂出平行用户命名空间
        return normalizeUsername(payload.sub);
    } catch {
        return null;
    }
}

export async function getSessionUsername(req) {
    const token = parseSessionCookie(req);
    return verifySessionToken(token, process.env.JWT_SECRET);
}

export async function buildUserRecord(password, email = null) {
    const record = { hash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
    if (email) {
        // 📧 可选找回邮箱：注册即绑定但未验证（emailVerified=false）——完成 verify-email 前不触发重置邮件，
        //    防止拿别人邮箱注册骚扰：邮箱主人只会收到一封"确认验证码"，忽略它就永远安静
        record.email = email;
        record.emailVerified = false;
    }
    return record;
}

// 一次性迁移：旧全局池搬进新注册用户名下，旧键改名归档（先到先得）
export async function claimLegacyPool(kv, username) {
    // 全局认领锁：跨用户并发注册时保证"先到先得"——仅靠 nx 占坑只能防同名并发，
    // 两个不同用户会在对方写入前都 get 到遗留池并各自 set 到自己的 points:<user> 键，
    // 遗留池被复制进两个账户；ex TTL 兜底持锁方崩溃后锁可自动恢复
    const lockKey = 'lock:legacy_pool_claim';
    const locked = await kv.set(lockKey, username, { nx: true, ex: 60 });
    if (locked !== 'OK') return 0;
    const legacy = await kv.get(LEGACY_GLOBAL_KEY);
    if (!Array.isArray(legacy)) return 0;
    const result = validatePointsPayload(legacy);
    // 🚧 整包校验失败：不搬不删，保留现场待人工处理——一条脏数据绝不清空整个遗留池
    if (!result.ok) {
        // 尽力释放锁（失败由 ex TTL 兜底）：运营清完脏数据后其他用户仍有机会认领
        try { await kv.delete(lockKey); } catch { /* 释放失败 60s 后锁自动过期 */ }
        return -1;
    }
    const points = result.points;
    // 🏁 nx 占坑防同名竞态：全局锁已保证跨用户先到先得，这里占坑失败说明该用户名下
    // 已有自己的点位库：归档遗留池后放弃写入，绝不覆盖既有数据
    // 成功路径保留锁作为永久认领标记，防止锁过期后被重复迁移
    const claimed = await kv.set(`points:${username}`, points, { nx: true }) === 'OK';
    await kv.set(`earth_terminal_global_points_claimed_${Date.now()}`, points);
    await kv.delete(LEGACY_GLOBAL_KEY);

    // 🕳️ dark2d 战术库对称认领：旧战术库与主池是同一批遗留数据，只认领主池会把
    //    战术库云副本永久变成孤儿键。两个池共用同一把全局锁——一次注册一次锁，
    //    一起处理，避免主池认领后锁被标记占用导致战术库永远轮不到认领。
    //    （键名与 pointsKeyFor 的 dark2d 规则保持一致；此处不 import points.js，
    //    因为 points.js 依赖本模块，反向引用会造成循环依赖）
    const legacyDark2d = await kv.get(LEGACY_DARK2D_KEY);
    if (Array.isArray(legacyDark2d)) {
        const darkResult = validatePointsPayload(legacyDark2d);
        // 🚧 与主池脏数据同语义：不搬不删保留现场待人工处理，尽力释放锁（失败由
        //    ex TTL 兜底）让后续用户仍有机会处理；主池刚完成的认领是已落库的事实，
        //    不受战术库脏数据影响
        if (!darkResult.ok) {
            try { await kv.delete(lockKey); } catch { /* 释放失败 60s 后锁自动过期 */ }
            return -1;
        }
        // 🏁 nx 占坑：该用户名下已有战术库则放弃写入但照常归档旧键（数据不丢）
        await kv.set(`points:${username}:dark2d`, darkResult.points, { nx: true });
        await kv.set(`earth_terminal_dark2d_points_claimed_${Date.now()}`, darkResult.points);
        await kv.delete(LEGACY_DARK2D_KEY);
    }

    return claimed ? points.length : 0;
}

// ---------- KV 单例（与 points.js / rateLimiter.js 相同的进程内复用模式） ----------

let _redis = null;
let _redisChecked = false;
function getRedis() {
    if (_redisChecked) return _redis;
    _redisChecked = true;
    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;
    if (kvUrl && kvToken) {
        _redis = new Redis({ url: kvUrl, token: kvToken });
    }
    return _redis;
}

const isProduction = () => process.env.VERCEL_ENV === 'production';

async function readJsonBody(req) {
    // 防御纵深：注册/登录请求体不可能超过 10KB，超出即视为滥用
    if (Number(req.headers['content-length'] || 0) > 10_000) return null;
    // 🧩 Vercel Node 运行时没有 req.json()：平台已把 JSON 请求体解析进 req.body
    //    （与 points.js 同模式）；取不到说明体为空或畸形，按错误体统一拒绝
    return req.body ?? null;
}

// 🔑 密钥预检：缺失或弱密钥一律 503 fail-closed。不能等到 signSession 才暴露——
//    register 在签名之前就已写入 KV，半途抛错会留下"注册成功却拿不到会话"的半成品
function requireSecret(res) {
    if (!isStrongSecret(process.env.JWT_SECRET)) {
        res.status(503).json({ error: '认证服务暂不可用' });
        return false;
    }
    return true;
}

// ---------- 端点（register/login 走 auth 档防爆破） ----------

// 🤖 Turnstile 人机验证：配置了 TURNSTILE_SECRET_KEY 才强制校验（本地开发/灰度期优雅跳过）。
// 防的是"代理池换 IP 绕过 IP 限流"的分布式撞库——IP 限流挡不住的那一类。
export function turnstileEnforced() {
    return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

// Cloudflare 令牌单次有效：siteverify 会消费令牌，验证失败的调用方须重取新令牌
export async function verifyTurnstile(token, remoteip) {
    if (!turnstileEnforced()) return true;
    if (typeof token !== 'string' || token === '') return false;
    // 🧪 测试后门（与前端 ?test=1 配套）：官方测试站点密钥 1x00...AA 签发的令牌
    //    以 "XXXX.DUMMY.TOKEN.XXXX" 为固定形态——生产 widget 绝无可能签出这种值，
    //    故无需触碰真 secret 即可让自动化回归放行，且显式开启 TEST_BYPASS 才生效
    if (process.env.TURNSTILE_TEST_BYPASS === '1' && token.includes('DUMMY.TOKEN')) return true;
    try {
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: process.env.TURNSTILE_SECRET_KEY,
                response: token,
                ...(remoteip ? { remoteip } : {})
            })
        });
        const data = await res.json();
        return data?.success === true;
    } catch {
        return false; // 验证服务失联视为未通过（fail-closed）
    }
}

const registerHandler = withRateLimit('auth')(async (req, res) => {
    if (!requireSecret(res)) return;
    if (process.env.ALLOW_REGISTRATION === 'false') {
        return res.status(403).json({ error: '注册通道已关闭' });
    }
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    // 人机验证放在凭据校验之前：fail-fast 且不给撞库脚本任何探测信号
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });
    const mail = resolveOptionalEmail(body.email);
    if (!mail.ok) return res.status(400).json({ error: mail.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const cap = parseRegistrationCap(process.env.REGISTRATION_CAP);
    const existingCount = (await redis.keys('user:*')).length;
    if (existingCount >= cap) {
        return res.status(403).json({ error: `节点注册已达总量上限（${cap}），新节点暂停接入` });
    }

    const record = await buildUserRecord(creds.password, mail.email);
    // ⚛️ nx = 不存在才写入，规避"检查-写入"竞态（多实例并发注册同一代号）
    const created = await redis.set(`user:${creds.username}`, JSON.stringify(record), { nx: true });
    if (created !== 'OK') return res.status(409).json({ error: '该节点代号已被注册' });

    // ✉ 邮箱绑定验证：注册成功后立刻发验证码（emailVerified 默认 false）。
    // 发信失败不影响注册本身——用户可在登录弹层重发（verify-email?resend=1）
    if (mail.email && process.env.RESEND_API_KEY) {
        try {
            const code = generateEmailCode();
            await redis.set(`emailcode:${creds.username}`, code, { ex: 600 });
            const sent = await sendVerifyEmail(mail.email, creds.username, code);
            if (!sent) await redis.delete(`emailcode:${creds.username}`);
        } catch (e) {
            console.error('验证码邮件发送失败（不影响注册）:', e.message);
        }
    }

    // 迁移是机会性收益（3 次 KV 往返）：任一网络抖动抛错若冒泡到顶层 catch 会 500，
    // 而用户行已写入——用户重试只会撞 409，留下"已注册但收到 500"的半成品；
    // 故认领失败只记日志，不影响注册结果
    try {
        await claimLegacyPool(redis, creds.username);
    } catch (e) {
        console.error('遗留池认领失败（不影响注册）:', e.message);
    }

    const token = await signSession(creds.username, process.env.JWT_SECRET);
    res.setHeader('Set-Cookie', serializeSessionCookie(token, isProduction()));
    return res.status(201).json({ ok: true, username: creds.username });
});

const loginHandler = withRateLimit('auth')(async (req, res) => {
    if (!requireSecret(res)) return;
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const creds = validateCredentials(body);
    if (!creds.ok) return res.status(400).json({ error: creds.error });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    // Upstash REST 可能返回反序列化对象或原始字符串，两种形态都兼容
    const raw = await redis.get(`user:${creds.username}`);
    let record = null;
    try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
    const valid = Boolean(record && typeof record.hash === 'string') && (await bcrypt.compare(creds.password, record.hash));
    // 🎭 统一 401 文案：不区分"代号不存在/密钥错误"，堵死用户枚举侧信道
    if (!valid) return res.status(401).json({ error: '认证失败，节点代号或访问密钥有误' });

    const token = await signSession(creds.username, process.env.JWT_SECRET);
    res.setHeader('Set-Cookie', serializeSessionCookie(token, isProduction()));
    return res.status(200).json({ ok: true, username: creds.username });
});

// 📧 密钥找回：填用户名 → 若账号绑过已验证邮箱，生成随机新密钥并邮件送达
//    也支持只填邮箱（username 留空）→ 反查代号并把"代号+新密钥"一起邮件送达（用户名遗忘自救）
const resetHandler = withRateLimit('auth')(async (req, res) => {
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    // 人机验证：找回端点是"邮件轰炸机"最恶心的入口，无一例外
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const email = resolveOptionalEmail(body.email);
    const username = normalizeUsername(body.username);
    // 代号与邮箱至少给一个：都给以代号为准（精确），只给邮箱则反查（模糊）
    if (!username && !(email.ok && email.email)) {
        return res.status(400).json({ error: '请输入节点代号，或注册时绑定的邮箱' });
    }

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    let targetUser = null;
    let record = null;
    if (username) {
        const raw = await redis.get(`user:${username}`);
        try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
        if (record && typeof record === 'object') targetUser = username;
    } else {
        // 🧭 邮箱反查：扫 user:* 找 email 匹配的记录（用户库 ≤500，keys 扫描成本可接受）
        const users = await redis.keys('user:*');
        for (const key of users) {
            const raw = await redis.get(key);
            let r = null;
            try { r = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { r = null; }
            if (r && typeof r === 'object' && r.email === email.email) {
                targetUser = key.slice('user:'.length);
                record = r;
                break;
            }
        }
    }

    // 🎭 枚举面说明：账号存在性已由注册端 409 天然公开，此处 404 不新增泄露
    if (!targetUser) {
        return res.status(404).json({ error: '没有找到匹配的账号——请核对代号或注册邮箱' });
    }
    if (typeof record.email !== 'string' || record.email === '') {
        return res.status(400).json({ error: '该账号注册时未绑定邮箱，无法邮件找回——请联系站长手动处理' });
    }
    if (record.emailVerified !== true) {
        return res.status(400).json({ error: '该邮箱尚未完成绑定验证（注册后收到的验证码邮件未输入），无法邮件找回' });
    }
    if (!process.env.RESEND_API_KEY) {
        return res.status(503).json({ error: '邮件服务暂不可用' });
    }

    const newPassword = generateRandomPassword();
    // 📤 先发信后落库：若先落库后发信失败，旧密码已失效新密码又收不到 = 用户被锁死
    // 邮箱反查场景下把代号一并写进邮件——用户忘了代号的正是这封信要解决的
    const sent = await sendResetEmail(record.email, targetUser, newPassword);
    if (!sent) return res.status(502).json({ error: '发信失败，旧密钥仍然有效，请稍后重试' });
    // 旧记录整体保留（email / createdAt / 未来字段），仅替换 hash
    const updated = { ...record, hash: await bcrypt.hash(newPassword, 12) };
    await redis.set(`user:${targetUser}`, JSON.stringify(updated));
    return res.status(200).json({ ok: true, message: '重置邮件已发送，请查收' });
});

// ✉ 邮箱验证：注册后输入邮件里的 6 位验证码完成绑定（body.code）；resend=1 重发验证码
const verifyEmailHandler = withRateLimit('auth')(async (req, res) => {
    const body = await readJsonBody(req);
    if (body === null) return res.status(413).json({ error: '请求体过大或格式错误' });
    if (!(await verifyTurnstile(body.turnstileToken, getClientIp(req)))) {
        return res.status(400).json({ error: '人机验证未通过，请刷新后重试' });
    }
    const username = normalizeUsername(body.username);
    if (!username) return res.status(400).json({ error: '请输入有效的节点代号' });

    const redis = getRedis();
    if (!redis) return res.status(503).json({ error: '存储服务暂不可用' });

    const raw = await redis.get(`user:${username}`);
    let record = null;
    try { record = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { record = null; }
    if (!record || typeof record !== 'object') {
        return res.status(404).json({ error: '节点代号不存在' });
    }
    if (typeof record.email !== 'string' || record.email === '') {
        return res.status(400).json({ error: '该账号未绑定邮箱，无需验证' });
    }
    if (record.emailVerified === true) {
        return res.status(200).json({ ok: true, message: '该邮箱已验证通过' });
    }
    if (!process.env.RESEND_API_KEY) {
        return res.status(503).json({ error: '邮件服务暂不可用' });
    }

    // 🔁 重发验证码（code 留空 + resend=1）：同账号 60s 冷却，防轰炸
    if (body.resend === true || body.resend === '1') {
        const cooldownKey = `emailresend:${username}`;
        const locked = await redis.set(cooldownKey, '1', { nx: true, ex: 60 });
        if (locked !== 'OK') return res.status(429).json({ error: '验证码发送过于频繁，请 1 分钟后再试' });
        const code = generateEmailCode();
        const sent = await sendVerifyEmail(record.email, username, code);
        if (!sent) return res.status(502).json({ error: '发信失败，请稍后重试' });
        await redis.set(`emailcode:${username}`, code, { ex: 600 });
        return res.status(200).json({ ok: true, message: '验证码已重新发送，请查收邮箱' });
    }

    // ✅ 收码验证：6 位数字，与 KV 里存的码比对（取到即焚，防重放）
    const code = String(body.code ?? '').trim();
    if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: '请输入邮件中的 6 位验证码' });
    const stored = await redis.get(`emailcode:${username}`);
    if (!stored || String(stored) !== code) {
        return res.status(400).json({ error: '验证码不正确或已过期' });
    }
    await redis.delete(`emailcode:${username}`);
    const updated = { ...record, emailVerified: true };
    await redis.set(`user:${username}`, JSON.stringify(updated));
    return res.status(200).json({ ok: true, message: '邮箱绑定完成，从此可自助找回密钥' });
});

const logoutHandler = withRateLimit('general')(async (req, res) => {
    res.setHeader('Set-Cookie', serializeClearedCookie(isProduction()));
    return res.status(200).json({ ok: true });
});

const meHandler = withRateLimit('general')(async (req, res) => {
    const username = await getSessionUsername(req);
    if (!username) return res.status(401).json({ error: '未登录' });
    return res.status(200).json({ username });
});

export default async function handler(req, res) {
    try {
        const action = req.query?.action;
        if (req.method === 'POST' && action === 'register') return await registerHandler(req, res);
        if (req.method === 'POST' && action === 'login') return await loginHandler(req, res);
        if (req.method === 'POST' && action === 'reset') return await resetHandler(req, res);
        if (req.method === 'POST' && action === 'verify-email') return await verifyEmailHandler(req, res);
        if (req.method === 'POST' && action === 'logout') return await logoutHandler(req, res);
        if (req.method === 'GET' && action === 'me') return await meHandler(req, res);
        return res.status(405).json({ error: 'Method Not Allowed' });
    } catch (error) {
        // 只记录服务端日志，不向客户端泄露内部细节
        console.error('认证服务故障:', error.message);
        return res.status(500).json({ error: '认证服务暂不可用' });
    }
}
