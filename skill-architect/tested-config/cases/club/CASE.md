# 案件：社區讀書會 10 月場報名繳費對帳（測試案例 2，通用性驗證）

## 需求
對帳 10 月場的報名與繳費，產出：
1. 有效報名人數與應收金額
2. 實收金額（全部收款，以及可對應到有效報名的收款）
3. 未繳與短繳名單
4. 需退款或無法對應的收款
5. 資料品質異常清單

## 資料來源（CSV，表頭為第 1 列）
- cases/club/data/registrations.csv（報名，status 為「報名」或「取消」）
- cases/club/data/payments.csv（收款，以 email 對應報名）

## 自然鍵（判斷重複用）
- cases/club/data/registrations.csv：email
- cases/club/data/payments.csv：pay_id

## 限制
- 只能讀上列檔案。
- 金額單位為新台幣元，每人費用以 fee 欄為準。
