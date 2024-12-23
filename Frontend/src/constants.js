/**
 * Sample rate of the audio.
 * Coindicentally, this is the same for both models (Moonshine and Silero VAD)
 */
export const SAMPLE_RATE = 16000;
export const SAMPLE_RATE_MS = SAMPLE_RATE / 1000;

/**
 * Probabilities ABOVE this value are considered as SPEECH
 */
export const SPEECH_THRESHOLD = 0.3;

/**
 * If current state is SPEECH, and the probability of the next state
 * is below this value, it is considered as NON-SPEECH.
 */
export const EXIT_THRESHOLD = 0.1;

/**
 * After each speech chunk, wait for at least this amount of silence
 * before considering the next chunk as a new speech chunk
 */
export const MIN_SILENCE_DURATION_MS = 400;
export const MIN_SILENCE_DURATION_SAMPLES =
  MIN_SILENCE_DURATION_MS * SAMPLE_RATE_MS;

/**
 * Pad the speech chunk with this amount each side
 */
export const SPEECH_PAD_MS = 80;
export const SPEECH_PAD_SAMPLES = SPEECH_PAD_MS * SAMPLE_RATE_MS;

/**
 * Final speech chunks below this duration are discarded
 */
export const MIN_SPEECH_DURATION_SAMPLES = 250 * SAMPLE_RATE_MS; // 250 ms

/**
 * Maximum duration of audio that can be handled by Moonshine
 */
export const MAX_BUFFER_DURATION = 60;

/**
 * Size of the incoming buffers
 */
export const NEW_BUFFER_SIZE = 512;

/**
 * The number of previous buffers to keep, to ensure the audio is padded correctly
 */
export const MAX_NUM_PREV_BUFFERS = Math.ceil(
  SPEECH_PAD_SAMPLES / NEW_BUFFER_SIZE,
);

/**
 * 助手初始提示词
 */
export const ASSISTANT_PROMPT = `你是一个友好的中文语音助手。请注意：
1. 始终用中文回答
2. 保持回答简洁明了
3. 语气自然亲切
4. 如果不确定或不理解，请直接说明
5. 避免过长的回答
6. 不要发送emoji表情
7. 不要发送markdown格式
请以对话的方式回应用户的输入。
`;