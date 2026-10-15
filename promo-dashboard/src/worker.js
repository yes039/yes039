// Cloudflare Worker 進入點：/api/* 交給 API，其餘路徑回傳單頁介面
import { handleApi } from './api.js';
import { HTML } from '../dist/html.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
    return new Response(HTML, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
        'x-robots-tag': 'noindex',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'no-referrer',
        'x-frame-options': 'DENY',
      },
    });
  },
};
