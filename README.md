# AetherBin — Zero-Knowledge Secure Pastebin 🛡️

AetherBin is a premium, secure, and **zero-knowledge** client-side encrypted text and code pastebin. All text and Markdown content is encrypted in the browser using the **AES-256-GCM** algorithm before upload. The decryption key remains strictly in the URL hash fragment and is never sent to Cloudflare servers, ensuring absolute privacy.

This project is streamlined into a **single-file architecture** (`_worker.js`). You do not need to install Node.js, Wrangler, or any local development tools. It supports two simple deployment options:

---

## ⚡ Deployment Option 1: Cloudflare Workers (Manual Copy-Paste)

### Step 1: Create a Cloudflare KV Namespace
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Select **Workers & Pages** -> **KV** from the left-hand menu.
3. Click the **Create a namespace** button.
4. Name the namespace `PASTE_KV` (**make sure it is exactly uppercase `PASTE_KV`**) and click **Add**.

### Step 2: Create a Worker and Paste the Code
1. Select **Workers & Pages** -> **Overview** -> **Create Application** -> **Create Worker**.
2. Name your Worker (e.g., `aetherbin`) and click **Deploy**.
3. Once deployed, click **Edit Code**.
4. Open the project file: 👉 **[_worker.js](file:///c:/Users/bbylw/Desktop/net/_worker.js)** 👈, and **copy all its code**.
5. In the Cloudflare web editor, clear any default code, paste the copied code, and click **Save and deploy** in the upper right.

### Step 3: Bind the KV Namespace to the Worker
1. Go back to the Worker's homepage dashboard.
2. Select the **Settings** tab -> **Variables**.
3. Scroll to the bottom to find the **KV Namespace Bindings** section, and click **Add binding**.
4. Fill in the following:
   - **Variable name**: `PASTE_KV` (**must be uppercase and exactly match**)
   - **KV Namespace**: Select the `PASTE_KV` namespace you created in Step 1.
5. Click **Save and deploy**.

🎉 **Deployment Complete!** You can now access your Worker URL and start sharing text securely!

---

## 🚀 Deployment Option 2: Cloudflare Pages (GitHub Integration - Recommended)

Because AetherBin follows standard `_worker.js` rules, you can connect your GitHub repository directly to Cloudflare Pages for automatic CI/CD deployment:

### Step 1: Create a Cloudflare KV Namespace
(Follow "Step 1" above to create a KV namespace named `PASTE_KV`).

### Step 2: Import GitHub Repository to Pages
1. Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Select **Workers & Pages** -> **Overview** from the left-hand menu.
3. Click **Create Application** -> select the **Pages** tab.
4. Click **Connect to Git**, link your GitHub account, and choose your `AetherBin` repository.
5. In the **Build settings** stage:
   - **Framework preset**: Select `None`.
   - **Build command**: Leave empty.
   - **Build output directory**: Enter `./` or `/` (meaning root directory, where `_worker.js` is located).
6. Click **Save and Deploy**.

### Step 3: Bind the KV Namespace to Pages
1. In your Pages project dashboard, select the **Settings** tab -> **Functions**.
2. Scroll down to find the **KV namespace bindings** section.
3. Click **Add binding** (it is recommended to add it for both **Production** and **Preview** environments):
   - **Variable name**: `PASTE_KV` (**must be uppercase and exactly match**)
   - **KV Namespace**: Select the `PASTE_KV` namespace you created in Step 1.
4. Click **Save**.
5. **⚠️ Critical Step**: After binding KV, you must redeploy Pages for it to take effect. Go to the **Deployments** tab, find the latest deployment, click the three dots on the right, and select **Redeploy** (or push a new commit to your GitHub repository).

🎉 **Pages Deployment Complete!** Visit the `.pages.dev` domain assigned to your Pages project to start sharing!

---

## ⚙️ Core Limits & Features

- **⏱️ Max 7-Day Expiration**:
  To protect edge storage, the system enforces a strict **7-day** (168 hours) expiration limit. Available expiration settings:
  - 5 Minutes
  - 1 Hour
  - 1 Day
  - 7 Days (Default & Max limit)
- **📎 No Attachments**:
  This is a lightweight **plain text, Markdown, and source code pastebin** only. It does not support file attachments to prevent storage abuse and safety risks.
- **🔥 Burn After Reading**:
  If enabled, the encrypted paste is deleted from Cloudflare KV immediately after the recipient fetches and decrypts it.
- **🔑 Dual-Factor Password**:
  Optional password protection. Generates a master key and uses it with your custom password via **PBKDF2-HMAC-SHA256** (100,000 iterations) to encrypt the content.
- **🌐 Bilingual Support**:
  Detects browser language preferences automatically and renders pages in English or Simplified Chinese. The UI provides a real-time language switcher that saves preferences in `localStorage`.

<br><br>

---

# AetherBin — 零知识临时加密在线粘贴板 🛡️

AetherBin 是一个高颜值、安全的**零知识（Zero-Knowledge）** 客户端加密文本在线粘贴板。所有文本和 Markdown 内容在上传前，都会在浏览器中通过 **AES-256-GCM** 算法加密，密钥保存在 URL Hash 中，不经过 Cloudflare 服务器，确保绝对隐私。

本项目已精简为**单文件架构**（`_worker.js`）。您无需安装 Node.js、Wrangler 或任何本地开发工具，支持以下两种部署方式：

---

## ⚡ 部署方式一：Cloudflare Workers 部署 (手动粘贴)

### 第一步：创建 Cloudflare KV 命名空间
1. 登录您的 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 依次点击左侧菜单的 **Workers & Pages (Worker 和页面)** -> **KV**。
3. 点击 **Create a namespace (创建命名空间)** 按钮。
4. 将命名空间命名为 `PASTE_KV`（**请确保名称完全一致，全大写**），然后点击 **Add (添加)**。

### 第二步：创建 Worker 并粘贴代码
1. 依次点击左侧菜单的 **Workers & Pages** -> **Overview (概述)** -> **Create Application (创建应用程序)** -> **Create Worker (创建 Worker)**。
2. 为您的 Worker 命名（例如 `aetherbin`），点击 **Deploy (部署)**。
3. 部署成功后，点击 **Edit Code (编辑代码)** 按钮。
4. 打开本项目的工作区文件：👉 **[_worker.js](file:///c:/Users/bbylw/Desktop/net/_worker.js)** 👈，**复制里面的全部代码**。
5. 在 Cloudflare 网页编辑器中，清空原本的所有默认代码，将您复制的代码粘贴进去，然后点击右上角的 **Save and deploy (保存并部署)**。

### 第三步：绑定 KV 命名空间到 Worker
1. 返回该 Worker 的控制台主页。
2. 点击 **Settings (设置)** 选项卡 -> **Variables (变量)**。
3. 滚动到页面底部，找到 **KV Namespace Bindings (KV 命名空间绑定)** 区域，点击 **Add binding (添加绑定)**。
4. 填写以下信息：
   - **Variable name (变量名称)**: `PASTE_KV` （**全大写，必须一致**）
   - **KV Namespace (KV 命名空间)**: 选择您在第一步创建的 `PASTE_KV`
5. 点击 **Save and deploy (保存并部署)**。

🎉 **部署完成！** 现在访问您的 Worker 路由 URL，即可立刻开始安全分享！

---

## 🚀 部署方式二：Cloudflare Pages 部署 (连接 GitHub，推荐)

由于本项目已经支持标准的 `_worker.js` 规则，您可以直接将您的 GitHub 仓库连接到 Cloudflare Pages，享受自动化 CI/CD 部署：

### 第一步：创建 Cloudflare KV 命名空间
（同上文的“第一步”，创建名为 `PASTE_KV` 的 KV 命名空间）。

### 第二步：导入 GitHub 仓库到 Pages
1. 登录您的 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 依次点击左侧菜单的 **Workers & Pages (Worker 和页面)** -> **Overview (概述)**。
3. 点击 **Create Application (创建应用程序)** -> 选择 **Pages (页面)** 选项卡。
4. 选择 **Connect to Git (连接到 Git)**，绑定您的 GitHub 账号并选择 `AetherBin` 仓库。
5. 在 **Build settings (构建设置)** 阶段：
   - **Framework preset (框架预设)**: 选择 `None`。
   - **Build command (构建命令)**: 留空（不填）。
   - **Build output directory (构建输出目录)**: 填写 `./` 或 `/`（代表根目录，即 `_worker.js` 所在位置）。
6. 点击 **Save and Deploy (保存并部署)**。

### 第三步：绑定 KV 命名空间到 Pages
1. 在 Pages 项目的控制台页面中，点击 **Settings (设置)** 选项卡 -> **Functions (函数)**。
2. 滚动页面找到 **KV namespace bindings (KV 命名空间绑定)** 区域。
3. 点击 **Add binding (添加绑定)**（建议在 **Production (生产环境)** 和 **Preview (预览环境)** 中都添加）：
   - **Variable name (变量名称)**: `PASTE_KV` （**全大写，必须一致**）
   - **KV Namespace (KV 命名空间)**: 选择您第一步创建的 `PASTE_KV`
4. 点击 **Save (保存)**。
5. **⚠️ 重要步骤**：绑定 KV 后，您必须重新部署一次 Pages 才能让绑定生效。您可以前往 **Deployments (部署)** 选项卡，找到最新一次部署，点击右侧的三个点并选择 **Redeploy (重新部署)**，或者直接向 GitHub 仓库推送一个新提交。

🎉 **Pages 部署完成！** 访问 Pages 给您分配的 `.pages.dev` 域名即可立即使用！

---

## ⚙️ 核心限制与功能

- **⏱️ 最长保存 7 天**: 
  为保障边缘节点存储安全，系统强制将数据过期时间上限设为 **7 天**（168小时）。提供以下过期选项：
  - 5 分钟
  - 1 小时
  - 1 天
  - 7 天（默认/上限）
- **📎 无文件附件功能**:
  本项目是一个轻量化的**纯文本/Markdown/代码在线粘贴板**，不支持且不传输文件附件，杜绝安全风险和存储滥用。
- **🔥 阅后即焚 (Burn After Reading)**:
  若勾选“阅后即焚”，阅读端在成功拉取并解密密文后，Worker 会立刻将其从 KV 中删除，确保内容阅毕即消。
- **🔑 双因子密码保护**:
  可选密码保护。使用 URL Hash 密钥作为盐值，基于 **PBKDF2-HMAC-SHA256**（100,000次迭代）再次加密，双重保障。
- **🌐 中英文双语支持**:
  自动识别您的系统语言并显示对应文本。页头提供切换下拉框，支持保存语言偏好到 `localStorage` 中。
