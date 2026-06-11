# AetherBin — 零知识临时加密在线粘贴板 🛡️

AetherBin 是一个高颜值、安全的**零知识（Zero-Knowledge）** 客户端加密文本在线粘贴板。所有文本和 Markdown 内容在上传前，都会在浏览器中通过 **AES-256-GCM** 算法加密，密钥保存在 URL Hash 中，不经过 Cloudflare 服务器，确保绝对隐私。

本项目已精简为**单个 Cloudflare Worker 文件**。您无需安装 Node.js、Wrangler 或任何本地开发工具，**只需复制一个文件并在网页端绑定 KV，即可完成全套部署**！

---

## ⚡ 极速部署指南（只需 3 步）

### 第一步：创建 Cloudflare KV 命名空间
1. 登录您的 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 依次点击左侧菜单的 **Workers & Pages (Woker 和页面)** -> **KV**。
3. 点击 **Create a namespace (创建命名空间)** 按钮。
4. 将命名空间命名为 `PASTE_KV`（**请确保名称完全一致，全大写**），然后点击 **Add (添加)**。

### 第二步：创建 Worker 并粘贴代码
1. 依次点击左侧菜单的 **Workers & Pages** -> **Overview (概述)** -> **Create Application (创建应用程序)** -> **Create Worker (创建 Worker)**。
2. 为您的 Worker 命名（例如 `aetherbin`），点击 **Deploy (部署)**。
3. 部署成功后，点击 **Edit Code (编辑代码)** 按钮。
4. 打开本项目的工作区文件：👉 **[src/index.js](file:///c:/Users/bbylw/Desktop/net/src/index.js)** 👈，**复制里面的全部代码**。
5. 在 Cloudflare 网页编辑器中，清空原本的所有默认代码，将您复制的代码粘贴进去，然后点击右上角的 **Save and deploy (保存并部署)**。

### 第三步：绑定 KV 命名空间到 Worker
1. 返回该 Worker 的控制台主页。
2. 点击 **Settings (设置)** 选项卡 -> **Variables (变量)**。
3. 滚动到页面底部，找到 **KV Namespace Bindings (KV 命名空间绑定)** 区域，点击 **Add binding (添加绑定)**。
4. 填写以下信息：
   - **Variable name (变量名称)**: `PASTE_KV` （**全大写，必须一致**）
   - **KV Namespace (KV 命名空间)**: 选择您在第一步创建的 `PASTE_KV`
5. 点击 **Save and deploy (保存并部署)**。

🎉 **部署完成！** 现在访问您的 Worker URL，即可立刻开始安全分享您的加密文本！

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
