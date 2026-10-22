# 03｜Facebook、Instagram 登入需求與權限限制評估

方法：讀 Agent-Reach 原始碼（`channels/facebook.py`、`instagram.py`、`backends/opencli.py`），並下載 OpenCLI 2.0.2 的 npm 套件**只看內容、沒有執行**。
依執行原則：**沒有登入任何 FB/IG 帳號，也沒有安裝 OpenCLI 或瀏覽器擴充功能。**

## 1. Agent-Reach 怎麼讀 FB／IG

```
AI Agent ──▶ opencli facebook/instagram 指令 ──▶ 本機常駐程式（127.0.0.1:19825）
          ──▶ Chrome 擴充功能 OpenCLI ──▶ 你「已經登入」的 Chrome 分頁 ──▶ facebook.com / instagram.com
```

- Agent-Reach 本身只負責安裝和健檢，實際讀取的是 **OpenCLI**（`@jackwener/opencli`，Apache-2.0，單一維護者）。
- **沒有 Meta 官方 API、不用申請 App**，靠的是「操控你真實的瀏覽器登入態」。
- **只能在桌機用**：要有圖形介面的 Chrome＋擴充功能＋你手動登入。官方文件也寫明伺服器、無桌面環境**不建議**使用。
- doctor 就算顯示已連線，也只會標成「⚠️」，因為它不會實際驗證登入狀態。

## 2. 登入需求

| 項目 | Facebook | Instagram |
|---|---|---|
| 一定要登入嗎 | **要**（用 Chrome 登入的狀態） | **要** |
| 帳號密碼交給工具嗎 | 不用，直接沿用瀏覽器的 session | 同左 |
| 可以在雲端／伺服器跑嗎 | 不建議（要桌面 Chrome） | 同左 |
| 不登入能拿到什麼 | 公開粉專只能透過 Jina 讀到極少的內容，大多會被導到登入頁 | 公開頁面幾乎都會被導到登入頁 |

## 3. 能做什麼（OpenCLI 2.0.2 實際提供的模組）

| 平台 | 讀取（read） | **寫入（write）** |
|---|---|---|
| Facebook | search、profile、feed、groups、friends、events、notifications、memories、marketplace-inbox、marketplace-listings | **add-friend、join-group** |
| Instagram | search（找使用者）、profile、user（最近貼文）、explore、followers、following、saved、download | **follow、unfollow、like、unlike、comment、post、reel、story、note、save、unsave、collection-create/delete** |

Agent-Reach 文件寫的能力限制：

- FB Groups 只承諾讀取「你登入後看得到的社團列表和最近動態」，**不保證能讀任意社團貼文和留言**。
- IG `search` 是**找使用者**，不是全站關鍵字搜貼文。
- 遇到 429 或登入錯誤時，只能請使用者重新登入、放慢頻率。

## 4. 風險評估

| 風險 | 等級 | 說明 |
|---|---|---|
| 違反平台條款 | **高** | Meta 服務條款禁止未經許可用自動化方式存取或蒐集資料；Instagram 使用條款也禁止未經許可的自動化蒐集。被偵測到會限制功能或封號 |
| 帳號被封 | **高** | Agent-Reach 自己的文件也建議用「專用小號」，因為有被封號的風險 |
| Agent 以你的身分發言或行動 | **高** | 這些模組有按讚、留言、發文、追蹤、加好友等**寫入動作**。AI 誤判或被網頁內容引導（prompt injection），就可能用你的帳號對外行動 |
| 瀏覽器被完整操控 | **高** | 擴充功能＋本機常駐程式能操作所有已登入的網站，不只 FB/IG |
| 個資法 | 中 | 抓取個人帳號、好友名單、追蹤者名單會涉及個人資料的蒐集與利用，要有合法目的並告知 |
| 穩定度 | 中 | 靠爬網頁畫面，Meta 一改版就可能壞掉；只有一位維護者 |

## 5. 建議

1. **MVP 不接 FB/IG 自動採集。** 不使用正式帳號，也不裝 OpenCLI。
2. **自己的粉專／IG 商業帳號**：要拿成效數據，走 **Meta 官方 Graph API**（Pages API、Instagram Graph API；IG 需要是商業或創作者帳號並連結粉專）。這是合規、穩定的作法，但要建 Meta App，有些權限還要送審。
3. **競品或公開帳號**：先用「**人工貼網址＋截圖**」→ AI 整理 → 寫進 Airtable。量大的話評估付費的合規資料服務。
4. **如果一定要試 OpenCLI**（需要另外核准）：專用電腦或專用 Chrome 設定檔＋專用小號＋只允許 read 類指令（例如包一層白名單腳本，擋掉 write 模組）＋人工逐筆觸發，**不排程、不批量**。
