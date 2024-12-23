// 首先创建一个单独的 TTS 服务文件
export const TTS_CONFIG = {
    API_URL: '/api/tts/text2audio',
    TOKEN_URL: '/api/baidu/oauth/2.0/token',
    API_KEY: 'SGS9sMETsDwU1ClU9w4Wb130',
    SECRET_KEY: 'm3Pn6lKcdzjteN64eDzciVUeLsTgFkuC'
};

let ttsAccessToken = '';

export async function getTTSAccessToken() {
    try {
        const response = await fetch(
            `${TTS_CONFIG.TOKEN_URL}?grant_type=client_credentials&client_id=${TTS_CONFIG.API_KEY}&client_secret=${TTS_CONFIG.SECRET_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) throw new Error('获取 TTS token 失败');
        
        const data = await response.json();
        if (data.access_token) {
            ttsAccessToken = data.access_token;
            return ttsAccessToken;
        }
        throw new Error('无效的 token 响应');
    } catch (error) {
        console.error('TTS token 错误:', error);
        throw error;
    }
}

export async function speakText(text) {
    try {
        console.log('开始语音合成:', text);
        
        if (!ttsAccessToken) {
            console.log('获取 TTS token...');
            await getTTSAccessToken();
        }

        const params = new URLSearchParams({
            tex: text,
            tok: ttsAccessToken,
            cuid: 'web_client_' + Date.now(),
            ctp: '1',
            lan: 'zh',
            spd: '5',
            pit: '5',
            vol: '15',
            per: '4',
            aue: '3'
        });

        const url = `${TTS_CONFIG.API_URL}?${params}`;
        console.log('TTS 请求 URL:', url);

        const response = await fetch(url);
        console.log('TTS 响应状态:', response.status);

        if (!response.ok) {
            throw new Error(`TTS 请求失败: ${response.status}`);
        }

        const audioBlob = await response.blob();
        if (audioBlob.size > 0) {
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            await audio.play();
            
            // 播放完成后清理
            audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                audio.remove();
            };
        }
    } catch (error) {
        console.error('TTS 错误:', error);
        throw error;
    }
} 