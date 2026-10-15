// 登入身分：正式環境由 Cloudflare Access 驗證後放入 JWT；開發模式用 DEV_USER。
// 正式環境必須設定 ACCESS_TEAM_DOMAIN 與 ACCESS_AUD，否則一律拒絕，避免未受保護的部署。

let jwksCache = null;

function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyAccessJwt(token, env) {
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) throw new Error('JWT 格式錯誤');
  const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(h)));
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p)));
  if (!jwksCache || jwksCache.at < Date.now() - 3600_000) {
    const res = await fetch(`https://${env.ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
    jwksCache = { keys: (await res.json()).keys, at: Date.now() };
  }
  const jwk = jwksCache.keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('找不到簽章金鑰');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('簽章不符');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('aud 不符');
  if (payload.exp * 1000 < Date.now()) throw new Error('登入已過期');
  return String(payload.email || '').toLowerCase();
}

export async function getUser(request, env) {
  let email = '';
  if (env.DEV_MODE === '1') {
    email = (request.headers.get('x-dev-user') || env.DEV_USER || 'dev@local').toLowerCase();
  } else {
    if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { error: '系統尚未設定登入驗證，拒絕存取', status: 503 };
    const token = request.headers.get('cf-access-jwt-assertion');
    if (!token) return { error: '請先登入', status: 401 };
    try {
      email = await verifyAccessJwt(token, env);
    } catch (e) {
      return { error: '登入驗證失敗：' + e.message, status: 401 };
    }
  }
  const admins = String(env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { email, isAdmin: admins.includes(email) };
}
