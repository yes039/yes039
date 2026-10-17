# 案件：社區讀書會 10 月場對帳（失敗注入：收款檔不存在）

## 需求
對帳 10 月場的報名與繳費，產出有效報名人數、應收、實收、未繳名單、異常清單。

## 資料來源（CSV，表頭為第 1 列）
- cases/club/data/registrations.csv（報名）
- cases/club-missing/data/payments.csv（收款）

## 限制
- 只能讀上列檔案。
