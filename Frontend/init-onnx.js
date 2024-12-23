import * as ort from 'onnxruntime-web';

async function initONNX() {
    try {
        await checkWebGPUSupport();
        
        const options = {
            executionProviders: ['webgpu'],
            graphOptimizationLevel: 'all'
        };
        
        const session = await ort.InferenceSession.create(
            'path/to/your/model.onnx',
            options
        );
        
        return session;
    } catch (error) {
        console.error('ONNX Runtime 初始化失败:', error);
        // 降级到 WASM 执行提供程序
        const fallbackOptions = {
            executionProviders: ['wasm']
        };
        return await ort.InferenceSession.create(
            'path/to/your/model.onnx',
            fallbackOptions
        );
    }
} 