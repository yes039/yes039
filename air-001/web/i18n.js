// 介面文字：預設繁體中文，保留英文切換（未翻譯的字串會退回中文）。
const DICT = {
  'nav.dashboard': ['戰情室', 'Overview'], 'nav.orders': ['訂單', 'Orders'], 'nav.dispatch': ['派車', 'Dispatch'],
  'nav.customers': ['客戶', 'Customers'], 'nav.ledger': ['帳本', 'Ledger'], 'nav.settlements': ['結算', 'Settlement'],
  'nav.tests': ['測試報告', 'Test report'], 'nav.audit': ['操作紀錄', 'Audit log'], 'nav.mytasks': ['我的任務', 'My jobs'],
  'p01': ['老闆營運戰情室', 'Operations overview'], 'p02': ['客戶管理 CRM', 'Customer CRM'], 'p03': ['訂單管理', 'Order management'],
  'p04': ['司機派遣中心', 'Dispatch center'], 'p05': ['雙向交易帳本', 'Two-way ledger'], 'p06': ['司機結算中心', 'Driver settlement'],
  'today': ['今日', 'Today'], 'week': ['本週', 'This week'], 'month': ['本月', 'This month'],
  'logout': ['登出', 'Sign out'], 'lang': ['English', '中文'], 'new.order': ['新增訂單', 'New order'], 'new.customer': ['新增客戶', 'New customer'],
  'save': ['儲存', 'Save'], 'cancel': ['取消', 'Cancel'], 'confirm': ['確認', 'Confirm'], 'search': ['搜尋', 'Search'],
  'k.orders': ['訂單數', 'Orders'], 'k.fare': ['已完成車資', 'Fares completed'], 'k.commission': ['平台佣金', 'Commission'],
  'k.received': ['已收款', 'Received'], 'k.outstanding': ['未收款', 'Outstanding'], 'k.owes': ['公司應付司機', 'Owed to drivers'],
  'k.remit': ['司機應繳公司', 'Owed by drivers'], 'k.booked': ['預約中車資', 'Booked fares'],
  'pending': ['待派車', 'To dispatch'], 'awaiting': ['待司機確認', 'Awaiting driver'], 'tomorrow': ['明日接送', 'Tomorrow'],
  'st.PENDING_DISPATCH': ['待派車', 'To dispatch'], 'st.ASSIGNED': ['已指派', 'Assigned'], 'st.ACCEPTED': ['司機已接單', 'Accepted'],
  'st.COMPLETED': ['已完成', 'Completed'], 'st.CANCELLED': ['已取消', 'Cancelled'], 'st.REJECTED': ['已拒單', 'Rejected'],
  'ps.UNPAID': ['未付款', 'Unpaid'], 'ps.PARTIAL': ['部分付款', 'Partial'], 'ps.PAID': ['已付清', 'Paid'], 'ps.OVERPAID': ['溢收待退', 'Overpaid'],
  'ps.REFUNDED': ['已退款', 'Refunded'], 'ps.NONE': ['無款項', 'None'],
  'pay.PENDING': ['待確認到帳', 'Pending'], 'pay.CONFIRMED': ['已確認', 'Confirmed'], 'pay.VOID': ['已作廢', 'Void'],
  'sst.OPEN': ['未結', 'Open'], 'sst.PARTIAL': ['部分結算', 'Partial'], 'sst.SETTLED': ['已結清', 'Settled'], 'sst.VOID': ['已作廢', 'Void'],
  'trip.ARRIVAL': ['接機', 'Arrival'], 'trip.DEPARTURE': ['送機', 'Departure'], 'trip.OTHER': ['其他', 'Other'],
  'col.COMPANY': ['公司收款', 'Company collects'], 'col.DRIVER': ['司機收款', 'Driver collects'],
  'm.CASH': ['現金', 'Cash'], 'm.ZELLE': ['Zelle', 'Zelle'], 'm.VENMO': ['Venmo', 'Venmo'], 'm.CARD': ['信用卡', 'Card'], 'm.CHECK': ['支票', 'Check'], 'm.OTHER': ['其他', 'Other'],
  'src.PHONE': ['電話', 'Phone'], 'src.LINE': ['LINE', 'LINE'], 'src.REPEAT': ['熟客', 'Repeat'], 'src.REFERRAL': ['介紹', 'Referral'], 'src.OTHER': ['其他', 'Other'], 'src.WECHAT': ['微信', 'WeChat'],
  'veh.SEDAN': ['轎車', 'Sedan'], 'veh.SUV': ['休旅車', 'SUV'], 'veh.VAN': ['商務車', 'Van'], 'veh.LUXURY': ['豪華車', 'Luxury'],
  'le.FARE': ['車資', 'Fare'], 'le.TIP': ['小費', 'Tip'], 'le.EXTRA': ['額外費用', 'Extra'], 'le.FARE_ADJUST': ['車資調整', 'Fare adj.'],
  'le.COMMISSION': ['平台佣金', 'Commission'], 'le.CUSTOMER_PAYMENT': ['客戶付款', 'Customer payment'], 'le.CUSTOMER_REFUND': ['退款', 'Refund'],
  'le.ADJUSTMENT': ['司機帳務調整', 'Driver adj.'], 'le.SETTLEMENT_PAYOUT': ['結算付司機', 'Payout'], 'le.SETTLEMENT_REMIT': ['司機繳款', 'Remit'],
  'le.SETTLEMENT_OFFSET': ['授權抵銷', 'Offset'], 'le.REVERSAL': ['沖回', 'Reversal'],
};
let lang = 'zh';
try { lang = localStorage.getItem('air001.lang') || 'zh'; } catch { /* 無法存取時使用預設 */ }
export function t(key, fallback) {
  const v = DICT[key];
  if (!v) return fallback ?? key;
  return lang === 'en' ? (v[1] || v[0]) : v[0];
}
export function getLang() { return lang; }
export function toggleLang() {
  lang = lang === 'zh' ? 'en' : 'zh';
  try { localStorage.setItem('air001.lang', lang); } catch { /* 偏好設定僅為便利功能 */ }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en';
}
