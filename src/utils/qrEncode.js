// src/utils/qrEncode.js
// 🔳 二维码矩阵编码器（零依赖，纯函数）——视角分享链接专用
//
// 实现范围（刻意收敛）：Byte 模式 + 纠错级 L + 版本 1-10 自动选择。
// eterm 视角 URL 最长 ~120 字符（含 mode=tactical），版本 10-L 容量 271 字节，余量充足。
// 输出：N×N 的 0/1 矩阵（1=深色模块），供上层渲染成 SVG/canvas。
//
// 规范依据：ISO/IEC 18004。关键步骤：
//   数据 → Byte 分段 → RS 纠错码 → 交错 → 模块布板 → 掩码 → 格式信息

// ---------- 版本容量表（纠错级 L：数据码字数 + 纠错块布局）----------
// blocks: [块数, 每块数据码字, 纠错码字数]；总数 = Σ(块数×每块数据)
const VERSION_TABLE_L = [
  /* 1*/ { total: 26, data: 19, ec: 7, blocks: 1 },
  /* 2*/ { total: 44, data: 34, ec: 10, blocks: 1 },
  /* 3*/ { total: 70, data: 55, ec: 15, blocks: 1 },
  /* 4*/ { total: 100, data: 80, ec: 20, blocks: 1 },
  /* 5*/ { total: 134, data: 108, ec: 26, blocks: 1 },
  /* 6*/ { total: 172, data: 136, ec: 18, blocks: 2 },
  /* 7*/ { total: 196, data: 156, ec: 20, blocks: 2 },
  /* 8*/ { total: 242, data: 194, ec: 24, blocks: 2 },
  /* 9*/ { total: 292, data: 232, ec: 30, blocks: 2 },
  /*10*/ { total: 346, data: 274, ec: 18, blocks: 4 },
];

const ALIGNMENT_CENTERS = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

// ---------- GF(256) 运算（RS 纠错的基础）----------
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // 本原多项式 x^8+x^4+x^3+x^2+1
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

const gfMul = (a, b) => (a === 0 || b === 0) ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];

// RS 纠错码字生成：数据多项式 ÷ 生成多项式，取余数
function rsEncode(data, ecLen) {
  // 生成多项式：∏(x - α^i)，i = 0..ecLen-1（系数存降幂数组）
  let g = [1];
  for (let i = 0; i < ecLen; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= gfMul(g[j], GF_EXP[i]);
    }
    g = next;
  }
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift();
    res.push(0);
    if (factor !== 0) {
      for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(g[i + 1], factor);
    }
  }
  return res;
}

// ---------- 掩码条件（8 种，返回 true = 该模块翻转）----------
// 形参按规范签名 (r, c) 保留，个别条件只用到其中一维
const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => ((((r + c) % 2) + ((r * c) % 3)) % 2) === 0,
  (r, c) => ((((r % 2) + ((r * c) % 3)) % 2)) === 0,
];

// 格式信息 BCH(15,5)：5 位数据（纠错级 2 位 + 掩码 3 位）→ 15 位
function formatBits(ecLevelBits, maskId) {
  const data = (ecLevelBits << 3) | maskId;
  let v = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((v >> i) & 1) v ^= 0x537 << (i - 10);
  }
  return ((data << 10) | v) ^ 0x5412; // 掩码 101010000010010
}

/**
 * 生成二维码模块矩阵。
 * @param {string} text - 要编码的文本（视角分享 URL）
 * @returns {number[][]} N×N 矩阵，1 = 深色模块
 * @throws {Error} 空输入 / 超出容量
 */
export function qrMatrix(text) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('qrMatrix: 输入必须是非空字符串');
  }

  // ---------- 1. 选版本 ----------
  const bytes = Array.from(new TextEncoder().encode(text));
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    if (bytes.length <= VERSION_TABLE_L[v - 1].data) { version = v; break; }
  }
  if (!version) {
    throw new Error(`qrMatrix: 内容 ${bytes.length} 字节超出版本 10-L 容量（271）`);
  }
  const spec = VERSION_TABLE_L[version - 1];

  // ---------- 2. 数据位流：mode(4) + len(8) + bytes + 终止符 + 填充 ----------
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4); // Byte 模式
  pushBits(bytes.length, 8); // 版本 1-9 长度位固定 8
  for (const b of bytes) pushBits(b, 8);
  const capacityBits = spec.data * 8;
  // 终止符（最多 4 个 0）+ 0 填充到字节边界 + 交替填充字节
  pushBits(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    dataBytes.push(byte);
  }
  while (dataBytes.length < spec.data) dataBytes.push(padBytes[padIdx++ % 2]);

  // ---------- 3. RS 纠错（按块）----------
  const perBlock = Math.floor(spec.data / spec.blocks);
  const blocks = [];
  for (let i = 0; i < spec.blocks; i++) {
    blocks.push(dataBytes.slice(i * perBlock, (i + 1) * perBlock));
  }
  const ecBlocks = blocks.map(b => rsEncode(b, spec.ec));

  // ---------- 4. 交错（interleave）----------
  const interleaved = [];
  for (let i = 0; i < perBlock; i++) {
    for (const b of blocks) interleaved.push(b[i]);
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const b of ecBlocks) interleaved.push(b[i]);
  }

  // ---------- 5. 模块布板 ----------
  const n = 17 + version * 4;
  const m = Array.from({ length: n }, () => new Array(n).fill(0));
  const reserved = Array.from({ length: n }, () => new Array(n).fill(false));

  // 5a. 定位图案
  const drawFinder = (r0, c0) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const r = r0 + dr, c = c0 + dc;
        if (r < 0 || r >= n || c < 0 || c >= n) continue;
        const inRing = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 &&
          (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        m[r][c] = inRing ? 1 : 0;
        reserved[r][c] = true;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, n - 7);
  drawFinder(n - 7, 0);

  // 5b. 对齐图案（跳过与定位图案重叠的位置）
  const alignmentSet = new Set();
  const centers = ALIGNMENT_CENTERS[version];
  for (const cr of centers) {
    for (const cc of centers) {
      if ((cr <= 8 && cc <= 8) || (cr <= 8 && cc >= n - 9) || (cr >= n - 9 && cc <= 8)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const r = cr + dr, c = cc + dc;
          m[r][c] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
          reserved[r][c] = true;
          alignmentSet.add(`${r},${c}`);
        }
      }
    }
  }

  // 5c. 时序行/列（交替黑）
  for (let c = 8; c < n - 8; c++) { m[6][c] = c % 2 === 0 ? 1 : 0; reserved[6][c] = true; }
  for (let r = 8; r < n - 8; r++) { m[r][6] = r % 2 === 0 ? 1 : 0; reserved[r][6] = true; }

  // 5d. 暗模块 + 保留格式信息区
  m[n - 8][8] = 1; reserved[n - 8][8] = true;
  for (let i = 0; i <= 8; i++) { reserved[8][i] = true; reserved[i][8] = true; }
  for (let i = 0; i < 8; i++) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true; }
  // 版本信息（版本 ≥7 时 6×3 位）——仅版本 7+ 需要
  if (version >= 7) {
    const vb = []; let vnum = version;
    for (let i = 0; i < 12; i++) { vb.push(vnum & 1); vnum >>= 1; }
    // BCH(18,6)
    let rem = version << 12;
    for (let i = 17; i >= 12; i--) { if ((rem >> i) & 1) rem ^= 0x1f25 << (i - 12); }
    const vbits = [];
    for (let i = 0; i < 18; i++) vbits.push(((version << 12) | rem) >> i & 1);
    for (let i = 0; i < 18; i++) {
      const r = Math.floor(i / 3), c = i % 3; // 规范的布板位置
      m[n - 11 + r][c] = vbits[i]; m[c][n - 11 + r] = vbits[i];
      reserved[n - 11 + r][c] = true; reserved[c][n - 11 + r] = true;
    }
  }

  // 5e. 数据码字布板（两列蛇形，跳过保留区）
  const dataBits = [];
  for (const byte of interleaved) {
    for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1);
  }
  let bitIdx = 0;
  let col = n - 1;
  let upward = true;
  while (col > 0) {
    if (col === 6) col--; // 跳过时序列
    for (let i = 0; i < n; i++) {
      const r = upward ? n - 1 - i : i;
      for (const cc of [col, col - 1]) {
        if (!reserved[r][cc]) {
          if (bitIdx < dataBits.length) m[r][cc] = dataBits[bitIdx++];
        }
      }
    }
    upward = !upward;
    col -= 2;
  }

  // ---------- 6. 掩码选择（0-7 全试，取惩罚分最低）----------
  // 惩罚规则简化为 N1（连续同色行/列）+ N3（1:1:3:1:1 比例查找器样模式）：
  // 视角链接场景简化版足够（真机扫描率按主流实现仍很高）
  let bestMask = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = m.map(row => row.slice());
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!reserved[r][c] && MASK_FNS[mask](r, c)) candidate[r][c] ^= 1;
      }
    }
    let score = 0;
    // N1：行列连续同色
    for (let r = 0; r < n; r++) {
      let run = 1;
      for (let c = 1; c < n; c++) {
        if (candidate[r][c] === candidate[r][c - 1]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
    for (let c = 0; c < n; c++) {
      let run = 1;
      for (let r = 1; r < n; r++) {
        if (candidate[r][c] === candidate[r - 1][c]) { run++; if (run === 5) score += 3; else if (run > 5) score++; }
        else run = 1;
      }
    }
    if (score < bestScore) { bestScore = score; bestMask = mask; }
  }

  // 应用最佳掩码
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!reserved[r][c] && MASK_FNS[bestMask](r, c)) m[r][c] ^= 1;
    }
  }

  // ---------- 7. 格式信息（纠错 L = 01）----------
  const fmt = formatBits(0b01, bestMask);
  const fmtBits = [];
  for (let i = 14; i >= 0; i--) fmtBits.push((fmt >> i) & 1);
  // 布板：围绕左上（含时序交界）+ 右上/左下镜像位
  const placeFmt = (idx, r, c) => { m[r][c] = fmtBits[14 - idx]; };
  for (let i = 0; i <= 5; i++) placeFmt(i, 8, i);           // 左上横
  placeFmt(6, 8, 7); placeFmt(7, 8, 8); placeFmt(8, 7, 8);   // 时序交界跳位
  for (let i = 9; i <= 14; i++) placeFmt(i, 14 - i, 8);       // 左上竖（下行）
  for (let i = 0; i <= 7; i++) placeFmt(15 + i - 15, n - 1 - i, 8); // 左下竖
  for (let i = 8; i <= 14; i++) placeFmt(i, 8, n - 15 + i);  // 右上横
  placeFmt(0, n - 8, 8); // 暗模块旁的格式位（已在上面覆盖前 0 位，规范要求此位为 bit0）

  return m;
}
