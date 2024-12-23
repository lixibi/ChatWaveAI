import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from 'node:fs';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'configure-server',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          console.log('收到请求:', req.url);

          // 处理 /ai/ 目录的文件列表请求
          if (req.url === '/ai' || req.url === '/ai/') {
            try {
              const aiDir = path.join(process.cwd(), 'public/ai');
              console.log('查找目录:', aiDir);
              
              const files = fs.readdirSync(aiDir);
              console.log('目录内容:', files);
              
              const jsonFiles = files.filter(file => file.endsWith('.json'));
              console.log('找到的 JSON 文件:', jsonFiles);
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(JSON.stringify(jsonFiles));
              return;
            } catch (error) {
              console.error('读取角色目录失败:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: '读取角色目录失败', details: error.message }));
              return;
            }
          }
          
          // 处理具体的 JSON 文件请求
          if (req.url.startsWith('/ai/') && req.url.endsWith('.json')) {
            const fileName = decodeURIComponent(req.url.replace('/ai/', ''));
            const filePath = path.join(process.cwd(), 'public/ai', fileName);
            console.log('读取文件:', filePath);
            
            try {
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: '文件不存在' }));
                return;
              }
              
              const content = fs.readFileSync(filePath, 'utf-8');
              console.log('文件内容:', content.slice(0, 100) + '...');
              
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(content);
              return;
            } catch (error) {
              console.error('读取角色文件失败:', error);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: '读取角色文件失败', details: error.message }));
              return;
            }
          }
          
          next();
        });
      }
    },
    react(),
    tailwindcss()
  ],
  build: { target: "esnext" },
  worker: { format: "es" },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false
      },
      '/oauth/2.0/token': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://aip.baidubce.com'
        }
      },
      '/server_api': {
        target: 'https://vop.baidu.com',
        changeOrigin: true,
        secure: false,
        headers: {
          'Origin': 'https://vop.baidu.com'
        }
      },
      '/api/tts': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    },
    fs: {
      strict: false,
      allow: ['..']
    }
  }
});
