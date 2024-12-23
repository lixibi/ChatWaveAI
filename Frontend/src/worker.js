import {
  MAX_BUFFER_DURATION,
  SAMPLE_RATE,
  MIN_SPEECH_DURATION_SAMPLES,
  ASSISTANT_PROMPT
} from "./constants";

// API 配置
const BAIDU_API = {
    TOKEN_URL: process.env.BAIDU_TOKEN_URL,
    ASR_URL: process.env.BAIDU_ASR_URL,
    API_KEY: process.env.BAIDU_API_KEY,
    SECRET_KEY: process.env.BAIDU_SECRET_KEY
};

const GEMINI_API = {
    URL: process.env.GEMINI_API_URL,
    KEY: process.env.GEMINI_API_KEY
};

// 添加安全检查
function validateEnvironmentVariables() {
    const requiredVars = [
        'BAIDU_API_KEY',
        'BAIDU_SECRET_KEY',
        'GEMINI_API_KEY',
        'BAIDU_TOKEN_URL',
        'BAIDU_ASR_URL',
        'GEMINI_API_URL'
    ];
    
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`缺少必要的环境变量: ${missingVars.join(', ')}`);
    }
}

// 常量定义
const CLEAR_CONVERSATION_KEYWORDS = ['清除对话', '重置对话', '清空对话', '重新开始', '忘记之前'];
const HISTORY_SIZE = 5;
const SILENCE_THRESHOLD = 0.006; // 静音判定阈值
const SPEECH_THRESHOLD = 0.008; // 语音判定阈值
const MIN_SILENCE_DURATION = 40; // 最小静音持续时间
const MAX_SILENCE_DURATION = 100; // 最大静音持续时间
const MIN_SPEECH_DURATION = 6; // 最小语音持续时间
const INTERRUPT_THRESHOLD = 15; // 中断阈值
const MIN_VALID_BUFFER_SIZE = 2048; // 最小有效缓冲区大小   
const MAX_BUFFER_SIZE = 192000; // 最大缓冲区大小
const NOISE_FLOOR = 0.004; // 噪音下限
const PRE_RECORD_BUFFER_SIZE = 8192; // 预录缓冲区大小
const MIN_REQUEST_INTERVAL = 2000; // 最小请求间隔
const MAX_RETRIES = 3; // 最大重试次数
const RETRY_DELAY = 2000; // 2秒

// 全局状态变量
let accessToken = '';
let currentPrompt = ASSISTANT_PROMPT;
let isProcessing = false;
let isRecording = false;
let isTTSPlaying = false;
let isMicEnabled = true;
let bufferPointer = 0;
let silenceCounter = 0;
let speechCounter = 0;
let volumeHistory = [];
let lastRequestTime = 0;
let retryCount = 0;

// 缓冲区
const BUFFER = new Float32Array(MAX_BUFFER_DURATION * SAMPLE_RATE);
let preRecordBuffer = new Float32Array(PRE_RECORD_BUFFER_SIZE);
let preRecordPointer = 0;

// 对话历史
let conversationHistory = [
    {
        role: 'assistant',
        parts: [{ text: currentPrompt }]
    }
];

// 重置函数
function resetConversation() {
    conversationHistory = [
        {
            role: 'assistant',
            parts: [{ text: currentPrompt }]
        }
    ];
    console.log('对话历史已重置，当前提示词:', currentPrompt);
    
    // 重置所有状态
    isProcessing = false;
    isRecording = false;
    isTTSPlaying = false;
    bufferPointer = 0;
    silenceCounter = 0;
    speechCounter = 0;
    volumeHistory = [];
    BUFFER.fill(0);
    preRecordBuffer = new Float32Array(PRE_RECORD_BUFFER_SIZE);
    preRecordPointer = 0;
}

// 辅助函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 获取百度 access token
async function getAccessToken() {
    try {
        const url = `${BAIDU_API.TOKEN_URL}?grant_type=client_credentials&client_id=${BAIDU_API.API_KEY}&client_secret=${BAIDU_API.SECRET_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.access_token) {
            throw new Error('获取token失败: ' + JSON.stringify(data));
        }
        return data.access_token;
    } catch (error) {
        console.error('获取token失败:', error);
        throw error;
    }
}

// 音频处理函数
function float32ToBase64(float32Array) {
    const CHUNK_SIZE = 1024;
    const chunks = [];
    const pcmBuffer = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    const uint8Array = new Uint8Array(pcmBuffer.buffer);
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
        chunks.push(String.fromCharCode.apply(null, chunk));
    }
    
    return btoa(chunks.join(''));
}

// 消息验证函数
function isValidMessage(message) {
    if (!message || typeof message !== 'string') return false;
    
    const trimmed = message.trim();
    if (trimmed.length === 0) return false;
    
    const withoutPunctuation = trimmed.replace(/[.,，。！？!?、；;：:""''「」『』（）［］【】《》〈〉]/g, '');
    const withoutSpace = withoutPunctuation.replace(/\s+/g, '');
    if (withoutSpace.length === 0) return false;
    
    const meaninglessWords = ['啊', '哦', '呃', '嗯', '唔', '啦', '呢', '吧', '呀', '哎', '诶', '哈'];
    const words = withoutSpace.split('');
    const meaningfulWords = words.filter(word => !meaninglessWords.includes(word));
    if (meaningfulWords.length === 0) return false;
    
    return true;
}

// Gemini API 调用函数
async function callGeminiAPI(userInput, retryCount = 0) {
    try {
        const shouldClear = CLEAR_CONVERSATION_KEYWORDS.some(keyword => 
            userInput.includes(keyword)
        );

        if (shouldClear) {
            resetConversation();
            return "好的，我已经清除了之前的对话记录，让我们重新开始吧。";
        }

        conversationHistory.push({
            role: 'user',
            parts: [{ text: userInput }]
        });

        const formattedHistory = conversationHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts.map(part => ({ text: part.text }))
        }));

        const response = await fetch(`${GEMINI_API.URL}?key=${GEMINI_API.KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: formattedHistory,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API 错误响应:', errorData);
            
            // 处理特定错误
            if (errorData.error) {
                // 处理 token 限制错误
                if (errorData.error.message && errorData.error.message.includes('Token limit exceeded')) {
                    console.warn('Token限制，尝试保留最近对话');
                    conversationHistory = [
                        conversationHistory[0],
                        ...conversationHistory.slice(-10)
                    ];
                    return await callGeminiAPI(userInput);
                }
                
                // 处理模型过载错误
                if (errorData.error.code === 503 && retryCount < MAX_RETRIES) {
                    const delay = RETRY_DELAY * (retryCount + 1);
                    console.warn(`模型��载，${delay/1000}秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return await callGeminiAPI(userInput, retryCount + 1);
                }
            }
            
            throw new Error(`API错误: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Gemini API 响应:', data);
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const reply = data.candidates[0].content.parts[0].text;
            
            conversationHistory.push({
                role: 'assistant',
                parts: [{ text: reply }]
            });
            
            return reply.trim();
        } else {
            throw new Error('无效的响应格式: ' + JSON.stringify(data));
        }
    } catch (error) {
        // 如果是网络错误或其他临时错误，尝试重试
        if ((error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) 
            && retryCount < MAX_RETRIES) {
            const delay = RETRY_DELAY * (retryCount + 1);
            console.warn(`网络错误，${delay/1000}秒后重试...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return await callGeminiAPI(userInput, retryCount + 1);
        }
        
        conversationHistory.pop();
        console.error('Gemini API 调用失败:', error);
        
        // 如果重试次数达到上限，返回友好的错误消息
        if (retryCount >= MAX_RETRIES) {
            return "抱歉，我现在有点忙，请稍后再试。";
        }
        
        throw error;
    }
}

// 初始化
try {
    validateEnvironmentVariables();
    accessToken = await getAccessToken();
    self.postMessage({ type: "status", status: "ready", message: "" });
} catch (error) {
    self.postMessage({ 
        type: "error", 
        message: "初始化失败",
        error: error.toString()
    });
    throw error;
}

// 音频处理相关函数
function updateVolumeHistory(volume) {
    volumeHistory.push(volume);
    if (volumeHistory.length > HISTORY_SIZE) {
        volumeHistory.shift();
    }
    return volumeHistory.reduce((a, b) => a + b, 0) / volumeHistory.length;
}

function isRealSpeech(volume, smoothedVolume) {
    const isSpeaking = volume > SPEECH_THRESHOLD || 
                      smoothedVolume > SPEECH_THRESHOLD * 0.8;
    const isAboveNoise = smoothedVolume > NOISE_FLOOR;
    const volumeChange = Math.abs(volume - smoothedVolume);
    const hasSignificantChange = volumeChange > NOISE_FLOOR * 0.5;
    return (isSpeaking && isAboveNoise) || hasSignificantChange;
}

function isContinuousSpeech() {
    if (volumeHistory.length < 3) return false;
    const recentSamples = volumeHistory.slice(-3);
    const validSamples = recentSamples.filter(v => v > SILENCE_THRESHOLD * 0.8);
    return validSamples.length >= 1;
}

// 重置音频缓冲区
function reset() {
    BUFFER.fill(0);
    bufferPointer = 0;
    silenceCounter = 0;
    speechCounter = 0;
    volumeHistory = [];
    
    if (isRecording) {
        isRecording = false;
        self.postMessage({
            type: "status",
            status: "recording_end",
            message: "正在识别...",
            duration: "until_next",
        });
    }
}

// 音频转录函数
async function transcribe(buffer, data) {
    try {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
            await delay(MIN_REQUEST_INTERVAL - timeSinceLastRequest);
        }

        const base64Audio = float32ToBase64(buffer);
        
        for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
                lastRequestTime = Date.now();
                const response = await fetch(BAIDU_API.ASR_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        format: 'pcm',
                        rate: SAMPLE_RATE,
                        channel: 1,
                        cuid: `web_client_${Date.now()}`,
                        token: accessToken,
                        dev_pid: 1537,
                        speech: base64Audio,
                        len: buffer.length * 2
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.err_no === 0 && result.result && result.result.length > 0) {
                    retryCount = 0;
                    const userMessage = result.result[0];
                    
                    if (!isValidMessage(userMessage)) {
                        console.log('忽略无效消息:', userMessage);
                        isProcessing = false;
                        return;
                    }
                    
                    self.postMessage({ 
                        type: "output", 
                        buffer, 
                        message: `我：${userMessage}`,
                        ...data 
                    });

                    try {
                        const assistantReply = await callGeminiAPI(userMessage);
                        
                        if (assistantReply) {
                            self.postMessage({
                                type: "output",
                                message: `gemini：${assistantReply}`
                            });

                            try {
                                const ttsResponse = await fetch('/api/tts', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        message: assistantReply
                                    })
                                });

                                if (!ttsResponse.ok) {
                                    throw new Error(`TTS 请求失败: ${ttsResponse.status}`);
                                }

                                const audioBlob = await ttsResponse.blob();
                                if (audioBlob.size > 0) {
                                    self.postMessage({
                                        type: "play_audio",
                                        audioBlob
                                    });
                                }
                            } catch (error) {
                                console.error('TTS 播放��败:', error);
                            }
                        }
                    } catch (error) {
                        console.error('AI助手响应失败:', error);
                        if (error.toString().includes('API错误')) {
                            resetConversation();
                        }
                        self.postMessage({
                            type: "error",
                            message: "AI助手响应失败",
                            error: error.toString()
                        });
                    }
                    return;
                } else if (result.err_msg === 'request pv too much') {
                    await delay(MIN_REQUEST_INTERVAL * (attempt + 1));
                    continue;
                } else {
                    throw new Error(result.err_msg || '识别失败');
                }
            } catch (error) {
                if (attempt === MAX_RETRIES - 1) {
                    throw error;
                }
                await delay(MIN_REQUEST_INTERVAL * (attempt + 1));
            }
        }
    } catch (error) {
        console.error('识别失败:', error);
        retryCount++;
        
        if (retryCount > MAX_RETRIES && error.toString().includes('token')) {
            try {
                accessToken = await getAccessToken();
                retryCount = 0;
            } catch (tokenError) {
                console.error('token 更新失败:', tokenError);
            }
        }

        self.postMessage({ 
            type: "error", 
            message: "识别失败",
            error: error.toString()
        });
    } finally {
        isProcessing = false;
    }
}

// 消息处理
self.onmessage = async (event) => {
    const { type, buffer, ttsStatus, prompt, enabled } = event.data;

    if (type === 'reset_conversation') {
        resetConversation();
        self.postMessage({
            type: "status",
            status: "ready",
            message: "对话已重置",
            duration: "until_next",
        });
        return;
    }

    if (type === 'update_prompt') {
        try {
            currentPrompt = prompt;
            console.log('提示词已更新为:', currentPrompt);
            resetConversation();
            self.postMessage({
                type: "status",
                status: "ready",
                message: "可以开始新的对话",
                duration: "until_next",
            });
        } catch (error) {
            console.error('更新提示词失败:', error);
            self.postMessage({
                type: "error",
                message: "更新提示词失败",
                error: error.toString()
            });
        }
        return;
    }

    if (type === 'force_transcribe') {
        if (isRecording && bufferPointer >= MIN_VALID_BUFFER_SIZE) {
            isRecording = false;
            isProcessing = true;
            const audioToProcess = BUFFER.slice(0, bufferPointer);
            reset();
            try {
                await transcribe(audioToProcess, {
                    start: Date.now() - (audioToProcess.length / SAMPLE_RATE) * 1000,
                    end: Date.now(),
                    duration: (audioToProcess.length / SAMPLE_RATE) * 1000
                });
            } catch (error) {
                console.error('处理音频失败:', error);
                self.postMessage({ 
                    type: "error", 
                    message: "处理音频失败",
                    error: error.toString()
                });
            }
        }
        return;
    }

    if (type === 'force_start_recording') {
        if (!isRecording && !isProcessing) {
            isRecording = true;
            speechCounter = MIN_SPEECH_DURATION + 1;
            bufferPointer = 0;
            self.postMessage({
                type: "status",
                status: "recording_start",
                message: "开始录音...",
                duration: "until_next",
            });
        }
        return;
    }

    if (type === 'stop_recording') {
        if (isRecording) {
            isRecording = false;
            reset();
            self.postMessage({
                type: "status",
                status: "recording_end",
                message: "录音已停止",
                duration: "until_next",
            });
        }
        return;
    }

    if (type === 'tts_status') {
        isTTSPlaying = ttsStatus === 'playing';
        return;
    }

    if (type === 'mic_status') {
        isMicEnabled = enabled;
        if (!enabled && isRecording) {
            isRecording = false;
            reset();
            self.postMessage({
                type: "status",
                status: "recording_end",
                message: "麦克风已关闭",
                duration: "until_next",
            });
        }
        return;
    }

    if (!buffer || isProcessing || !isMicEnabled) return;

    const volume = Math.sqrt(buffer.reduce((acc, val) => acc + val * val, 0) / buffer.length);
    const smoothedVolume = updateVolumeHistory(volume);
    const isSpeech = isRealSpeech(volume, smoothedVolume);
    const isSilence = smoothedVolume < SILENCE_THRESHOLD;
    const isContinuous = isContinuousSpeech();

    if (isTTSPlaying && isSpeech && isContinuous) {
        speechCounter += 2;
        if (speechCounter > INTERRUPT_THRESHOLD) {
            self.postMessage({
                type: "interrupt_playback"
            });
            isTTSPlaying = false;
            isRecording = true;
            speechCounter = MIN_SPEECH_DURATION + 1;
            bufferPointer = 0;
            self.postMessage({
                type: "status",
                status: "recording_start",
                message: "正在聆听...",
                duration: "until_next",
            });
            return;
        }
    }

    function updatePreRecordBuffer() {
        const available = PRE_RECORD_BUFFER_SIZE - preRecordPointer;
        if (buffer.length <= available) {
            preRecordBuffer.set(buffer, preRecordPointer);
            preRecordPointer += buffer.length;
        } else {
            preRecordBuffer.set(
                preRecordBuffer.subarray(buffer.length),
                0
            );
            preRecordBuffer.set(
                buffer,
                PRE_RECORD_BUFFER_SIZE - buffer.length
            );
            preRecordPointer = PRE_RECORD_BUFFER_SIZE;
        }
    }

    if (!isRecording) {
        updatePreRecordBuffer();
    }

    if (isSpeech && isContinuous) {
        speechCounter += 2;
        silenceCounter = 0;
        
        if (!isRecording && speechCounter > MIN_SPEECH_DURATION) {
            if (preRecordPointer > 0) {
                BUFFER.set(preRecordBuffer.subarray(0, preRecordPointer), 0);
                bufferPointer = preRecordPointer;
            }
            
            self.postMessage({
                type: "status",
                status: "recording_start",
                message: "正在聆听...",
                duration: "until_next",
            });
            isRecording = true;
            preRecordPointer = 0;
        }
    } else if (isSilence) {
        silenceCounter++;
        speechCounter = Math.max(0, speechCounter - 1);
    }

    if (bufferPointer + buffer.length <= MAX_BUFFER_SIZE) {
        if (isRecording || speechCounter > MIN_SPEECH_DURATION) {
            BUFFER.set(buffer, bufferPointer);
            bufferPointer += buffer.length;
        }
    }

    const shouldProcess = 
        (isRecording && silenceCounter > MIN_SILENCE_DURATION) ||
        (isRecording && silenceCounter > MAX_SILENCE_DURATION) ||
        bufferPointer >= MAX_BUFFER_SIZE;

    const hasValidSpeech = 
        speechCounter > MIN_SPEECH_DURATION || 
        (isRecording && bufferPointer >= MIN_VALID_BUFFER_SIZE);

    if (shouldProcess && !isProcessing && hasValidSpeech) {
        isProcessing = true;
        
        let audioToProcess;
        if (silenceCounter > 0) {
            const validLength = Math.max(0, bufferPointer - (silenceCounter * buffer.length));
            audioToProcess = BUFFER.slice(0, validLength);
        } else {
            audioToProcess = BUFFER.slice(0, bufferPointer);
        }

        if (audioToProcess.length >= MIN_VALID_BUFFER_SIZE) {
            reset();
            try {
                await transcribe(audioToProcess, {
                    start: Date.now() - (audioToProcess.length / SAMPLE_RATE) * 1000,
                    end: Date.now(),
                    duration: (audioToProcess.length / SAMPLE_RATE) * 1000
                });
            } catch (error) {
                console.error('处理音频失败:', error);
                self.postMessage({ 
                    type: "error", 
                    message: "处理音频失败",
                    error: error.toString()
                });
            }
        } else {
            isProcessing = false;
        }
    } else if (bufferPointer >= MAX_BUFFER_SIZE) {
        reset();
    }
};
