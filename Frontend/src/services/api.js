import { config } from '../config/api';

// 替换之前直接使用API密钥的地方
const api = axios.create({
  headers: {
    'Authorization': `Bearer ${config.openaiApiKey}`,
    // ...
  }
}); 