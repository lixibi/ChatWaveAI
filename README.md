# AI 语音助手

![ui](https://github.com/user-attachments/assets/3b97c69b-d4c7-4c82-8b7c-0b5bb1045a7b)

这是一个基于网页的 AI 语音助手项目，集成了语音识别、AI 对话和语音合成功能。用户可以通过语音与 AI 进行实时对话交互。

## 主要功能

- 实时语音识别（基于百度语音服务）
- AI 对话（基于 Gemini API）
- 语音合成（TTS）
- 实时音频可视化
- 自动检测语音输入
- 支持打断和连续对话

## 运行环境要求

- Node.js 16.0 或以上版本
- 现代浏览器（支持 WebAudio API）
- 网络连接（用于API调用）
- Python 3.7 或以上版本
- edge-tts 库（用于语音合成）

## 快速开始

### 1. 安装依赖

```bash
# 全局安装 pnpm（如果尚未安装）
npm install -g pnpm

# 安装项目依赖
pnpm install

# 后端依赖
cd Backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
# 进入后端目录
cd Backend

# 启动后端服务
python edge-tts.py
```

> 注意：后端服务必须运行在 8000 端口，否则语音合成功能将无法正常工作。

### 3. 配置环境变量

1. 复制 `.env.example` 文件并重命名为 `.env`：
```bash
cp .env.example .env
```

2. 在 `.env` 文件中填入您的 API 密钥

```plaintext
# Baidu API Configuration
BAIDU_API_KEY=your_baidu_api_key_here
BAIDU_SECRET_KEY=your_baidu_secret_key_here
BAIDU_TOKEN_URL=https://aip.baidubce.com/oauth/2.0/token
BAIDU_ASR_URL=https://vop.baidu.com/server_api

# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent
```

### 4. 启动前端开发服务器

```bash
# 回到项目根目录
cd ..

# 安装前端依赖
pnpm install
# 或
npm install
# 或
yarn install

# 启动开发服务器
pnpm dev
# 或
npm run dev
# 或
yarn dev
```

访问 `http://localhost:5173` 即可使用语音助手。

> 提示：推荐使用 pnpm 作为包管理器，它能提供更快的安装速度和更好的磁盘空间利用率。

## 系统架构

项目分为前端和后端两个部分：

- 前端：React + Vite 构建的 Web 应用
  - 语音识别（百度语音服务）
  - AI 对话（Gemini API）
  - 音频可视化

- 后端：Python Flask 应用
  - 语音合成服务（基于 edge-tts）
  - 运行在 8000 端口

## API 密钥获取方法

### 百度语音服务
1. 访问[百度智能云](https://cloud.baidu.com/)
2. 注册/登录账号
3. 创建语音应用
4. 获取 API Key 和 Secret Key

### Gemini API
1. 访问 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 登录 Google 账号
3. 创建 API 密钥

## 安全提醒

- 请勿将包含实际 API 密钥的 `.env` 文件提交到版本控制系统
- 确保 `.env` 文件已添加到 `.gitignore` 中
- 建议定期更换 API 密钥
- 在生产环境中使用时，建议增加额外的安全措施

## 使用说明

1. 打开网页后，允许浏览器使用麦克风
2. 等待"准备就绪"提示
3. 开始说话，系统会自动检测语音输入
4. AI 助手会通过语音回答您的问题
5. 您可以随时打断 AI 的回答继续提问

## 常见问题

1. 如果语音识别不准确，请确保：
   - 麦克风工作正常
   - 环境噪音不要太大
   - 说话语速适中

2. 如果 API 调用失败，请检查：
   - API 密钥是否正确
   - 网络连接是否正常
   - API 使用配额是否超限

## 技术支持

如有问题或建议，请提交 Issue 或 Pull Request。

## License

MIT License

## 致谢

本项目参考了以下优秀的开源项目：

- [transformers.js-examples/moonshine-web](https://github.com/huggingface/transformers.js-examples/tree/main/moonshine-web) - HuggingFace 的 Transformers.js 示例项目
- [edge-tts](https://github.com/lyz1810/edge-tts) - 基于微软 Edge TTS 的在线语音合成服务
