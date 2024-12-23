async function checkWebGPUSupport() {
    if (!navigator.gpu) {
        throw new Error('WebGPU 不支持 - 请使用支持 WebGPU 的浏览器');
    }
    
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        throw new Error('无法获取 WebGPU 适配器');
    }
    
    const device = await adapter.requestDevice();
    return device;
} 