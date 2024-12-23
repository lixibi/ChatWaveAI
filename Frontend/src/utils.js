export function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export async function supportsWebGPU() {
    try {
        if (!navigator.gpu) {
            return false;
        }
        
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            return false;
        }
        
        const device = await adapter.requestDevice();
        if (!device) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.warn('WebGPU 检测失败:', error);
        return false;
    }
}
