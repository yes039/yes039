// 執行十大情境測試，輸出 docs/04-測試報告.md 與 docs/test-results.json
import { writeFileSync } from 'node:fs';
import { openNodeDb, nodeEnv } from '../server/db-node.js';
import { runTestSuite } from '../core/demo.js';

const report = await runTestSuite(() => openNodeDb(':memory:'), nodeEnv());
const cases = {};
for (const r of report.results) (cases[r.case] ||= { title: r.title, rows: [] }).rows.push(r);

const esc = (s) => String(s).replace(/\|/g, '\\|');
let md = `# AIR-001 測試報告（自動產生）\n\n`;
md += `- 執行時間（UTC）：${report.ran_at}\n- 執行環境：Node ${process.version}，node:sqlite 全新記憶體資料庫\n`;
md += `- 模擬訂單：${report.order_count} 筆（含情境測試 24 筆＋展示用 5 筆）\n- 檢核項目：${report.total} 項，通過 ${report.passed}，失敗 ${report.failed}\n`;
md += `- 重新產生：\`npm test\`（App 內「測試報告」頁亦可即時重跑同一套情境）\n\n`;
md += `| 情境 | 名稱 | 檢核數 | 結果 |\n|---|---|---|---|\n`;
for (const [k, c] of Object.entries(cases)) md += `| ${k} | ${c.title} | ${c.rows.length} | ${c.rows.every((r) => r.pass) ? '✅ 全數通過' : '❌ 有失敗'} |\n`;
for (const [k, c] of Object.entries(cases)) {
  md += `\n## 情境 ${k}｜${c.title}\n\n| 單號 | 檢核項目 | 預期值 | 實際值 | 狀態 |\n|---|---|---|---|---|\n`;
  for (const r of c.rows) md += `| ${esc(r.ref)} | ${esc(r.item)} | ${esc(r.expected)} | ${esc(r.actual)} | ${r.pass ? '✅ PASS' : '❌ FAIL'} |\n`;
}
writeFileSync(new URL('../docs/04-測試報告.md', import.meta.url), md);
writeFileSync(new URL('../docs/test-results.json', import.meta.url), JSON.stringify(report, null, 2));
for (const r of report.results.filter((x) => !x.pass)) console.log('FAIL', r.case, r.ref, r.item, 'expected', r.expected, 'actual', r.actual);
console.log(`${report.passed}/${report.total} passed, ${report.order_count} orders`);
process.exit(report.failed ? 1 : 0);
