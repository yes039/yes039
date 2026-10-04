/* 真實事件紀錄重播（瀏覽器與 node 共用）
 * 事件紀錄是一個 JSON 陣列，每筆：
 *   {seq, at, type, node?, by, note?, evidence?}
 *   seq       從 1 開始連續編號
 *   at        ISO 時間（實際發生時間）
 *   type      V2 事件：TASK_CREATED / STARTED / WAITING / RESUMED / APPROVED / DONE / FAILED
 *   node      節點 id（TASK_CREATED 不需要）
 *   by        誰送出：Shen / Claude
 *   note      原因或說明（WAITING、FAILED、退回時必填）
 *   evidence  證據：檔案路徑、commit、或 Shen 的回覆原文
 * 狀態不另外保存：每次都從紀錄第一筆重播到最後一筆。紀錄裡任何一筆被引擎拒絕，都會回報錯誤，不會默默略過。
 */
(function (root) {
  "use strict";
  const TYPES = ["TASK_CREATED", "STARTED", "WAITING", "RESUMED", "APPROVED", "DONE", "FAILED"];

  function check(e, i) {
    const errs = [];
    if (!e || typeof e !== "object") return [`第 ${i + 1} 筆不是物件`];
    if (e.seq !== i + 1) errs.push(`第 ${i + 1} 筆 seq 應為 ${i + 1}`);
    if (!e.at || isNaN(Date.parse(e.at))) errs.push(`第 ${i + 1} 筆缺少有效時間 at`);
    if (!TYPES.includes(e.type)) errs.push(`第 ${i + 1} 筆事件類型「${e.type}」不存在`);
    if (e.type !== "TASK_CREATED" && !e.node) errs.push(`第 ${i + 1} 筆缺少 node`);
    if (!e.by) errs.push(`第 ${i + 1} 筆缺少 by（誰送出）`);
    if (["WAITING", "FAILED", "RESUMED"].includes(e.type) && !e.note) errs.push(`第 ${i + 1} 筆 ${e.type} 必須寫原因 note`);
    if (i === 0 && e.type !== "TASK_CREATED") errs.push("第 1 筆必須是 TASK_CREATED");
    if (i > 0 && e.type === "TASK_CREATED") errs.push(`第 ${i + 1} 筆：同一份紀錄只能開戰一次`);
    return errs;
  }

  // 依序重播；回傳 {hq, errors}。errors 非空代表紀錄與引擎規則不一致
  function replay(V3, campaign, events) {
    const hq = V3.createHQ({campaign, units: {}});
    const errors = [];
    if (!Array.isArray(events)) return {hq, errors: ["事件紀錄必須是陣列"]};
    events.forEach((e, i) => {
      const bad = check(e, i);
      if (bad.length) { errors.push(...bad); return; }
      const r = hq.emit({type: e.type, node: e.node, note: e.note});
      if (!r.ok) errors.push(`第 ${i + 1} 筆 ${e.type}${e.node ? " " + e.node : ""} 被引擎拒絕：${r.reason}`);
    });
    return {hq, errors};
  }

  const api = {replay, check, TYPES};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.WarRoomLive = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
