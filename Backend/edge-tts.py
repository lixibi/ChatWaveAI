from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import edge_tts
import asyncio
import os
from datetime import datetime
import pygame
from typing import Dict
import threading
import time
import logging
import glob

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = FastAPI()

# 状态管理
tts_status: Dict[str, any] = {
    "is_playing": False,
    "current_file": None,
    "should_stop": False
}

# 添加回 ChatMessage 类定义
class ChatMessage(BaseModel):
    message: str
    timestamp: int
    type: str

# CORS 中间件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# 音频文件配置
AUDIO_FILE_LIMIT = 10
AUDIO_FILE_PREFIX = "tts_output_"

def cleanup_old_audio_files():
    """清理旧的音频文件，只保留最新的N个文件"""
    try:
        audio_files = glob.glob(f"{AUDIO_FILE_PREFIX}*.mp3")
        if len(audio_files) > AUDIO_FILE_LIMIT:
            audio_files.sort(key=lambda x: os.path.getmtime(x))
            files_to_delete = audio_files[:-AUDIO_FILE_LIMIT]
            for file in files_to_delete:
                if os.path.exists(file) and file != tts_status["current_file"]:
                    try:
                        os.remove(file)
                        logger.debug(f"Cleaned up old file: {file}")
                    except Exception as e:
                        logger.error(f"Error deleting file {file}: {str(e)}")
    except Exception as e:
        logger.error(f"Error in cleanup: {str(e)}")

def clean_markdown(text: str) -> str:
    """清除文本中的 Markdown 特殊符号"""
    # 需要清除的 Markdown 符号列表
    markdown_symbols = ['*', '_', '`', '#', '>', '~', '|', '-', '[', ']', '(', ')', '{', '}']
    
    for symbol in markdown_symbols:
        text = text.replace(symbol, '')
    return text.strip()

async def text_to_speech(text: str) -> str:
    try:
        cleanup_old_audio_files()
        voice = "zh-CN-XiaoxiaoNeural"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = f"{AUDIO_FILE_PREFIX}{timestamp}.mp3"
        
        # 在转换前清除 Markdown 符号
        cleaned_text = clean_markdown(text)
        communicate = edge_tts.Communicate(cleaned_text, voice)
        await communicate.save(output_file)
        
        return output_file
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")



@app.post("/api/tts")
async def text_to_speech_endpoint(request: Request):
    try:
        data = await request.json()
        message = data["message"]
        logger.debug(f"Received TTS request with message: {message}")
        
        # 生成音频文件
        audio_file = await text_to_speech(message)
        
        # 读取生成的音频文件
        if not os.path.exists(audio_file):
            raise HTTPException(status_code=404, detail="Audio file not found")
            
        with open(audio_file, "rb") as f:
            audio_data = f.read()
            
        # 删除临时文件
        try:
            os.remove(audio_file)
            logger.debug(f"Removed temporary file: {audio_file}")
        except Exception as e:
            logger.error(f"Error removing temporary file: {str(e)}")
        
        # 返回音频数据
        from fastapi.responses import Response
        return Response(content=audio_data, media_type="audio/mpeg")
        
    except Exception as e:
        logger.error(f"Error in text_to_speech_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
