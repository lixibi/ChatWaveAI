import { useRef, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { motion } from "framer-motion";
import './styles.css';

import BloomScene from "./components/BloomScene";
import AnimatedMesh from "./components/AnimatedMesh";

import { SAMPLE_RATE, ASSISTANT_PROMPT } from "./constants";
import { formatDate } from "./utils";

// 添加提示词对话框组件
function PromptDialog({ isOpen, onClose, onConfirm, defaultValue }) {
  const [promptText, setPromptText] = useState(defaultValue);

  if (!isOpen) return null;

  return (
    <>
      <div className="prompt-dialog-overlay" onClick={onClose} />
      <div className="prompt-dialog">
        <h2>自定义提示词</h2>
        <textarea
          className="prompt-textarea"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="请输入新的提示词..."
        />
        <div className="prompt-dialog-buttons">
          <button className="dialog-button cancel" onClick={onClose}>
            取消
          </button>
          <button
            className="dialog-button confirm"
            onClick={() => onConfirm(promptText)}
          >
            确定
          </button>
        </div>
      </div>
    </>
  );
}

// 修改聊天历史卡片组件
function ChatHistoryCard({ 
  messages, 
  setMessages,
  onControlClick, 
  isRecordingOrPlaying, 
  recordingStartTime, 
  isAudioPlaying, 
  onClearChat, 
  onUpdatePrompt, 
  workerRef,
  showSubtitles,
  onSubtitlesChange,
  onCollapse
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const cardRef = useRef(null);
  const messagesEndRef = useRef(null);

  // 处理收起/展开
  const handleCollapse = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapse?.(newCollapsed);
  };

  // 计算按钮状态类
  const getControlIconClass = () => {
    if (!isRecordingOrPlaying) return 'ready';
    if (isAudioPlaying) return 'stop playing';
    if (isRecordingOrPlaying && recordingStartTime && Date.now() - recordingStartTime >= 2000) {
      return 'stop sending';
    }
    return 'stop';
  };

  // 处理菜���项点击
  const handleMenuItemClick = (action) => {
    setShowMenu(false);
    if (action === 'clear') {
      onClearChat();
    } else if (action === 'prompt') {
      setShowPromptDialog(true);
    }
  };

  // 处理提示词更新
  const handlePromptUpdate = (newPrompt) => {
    setShowPromptDialog(false);
    onUpdatePrompt(newPrompt);
  };

  // 滚动到底部的函数
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 处理麦克风开关
  const handleMicToggle = () => {
    setIsMicEnabled(!isMicEnabled);
    // 知 worker 麦克风状态化
    workerRef?.postMessage({ 
      type: 'mic_status', 
      enabled: !isMicEnabled 
    });
  };

  // 处理字幕开关
  const handleSubtitlesToggle = () => {
    onSubtitlesChange(!showSubtitles);
  };

  // 处理角色选择
  const handleRoleSelect = async (role) => {
    try {
      console.log('选择角色:', role);
      const response = await fetch(`/ai/${role.file}`);
      if (!response.ok) {
        throw new Error(`加载角色配置失败: ${response.status}`);
      }
      
      const roleData = await response.json();
      console.log('加载的角色配置:', roleData);
      
      // 使用 initialization 作为主要提示词，如果没有则使用 profile
      const newPrompt = roleData.initialization || roleData.profile;
      console.log('新的提示词:', newPrompt);
      
      // 通知 worker 更新提示词并重置对话
      if (workerRef) {
        workerRef.postMessage({
          type: 'update_prompt',
          prompt: newPrompt
        });
        
        // 调用 onSelect 回调
        onSelect(role);
        
        // 关闭对话框
        onClose();
      } else {
        throw new Error('Worker 未初始化');
      }
    } catch (error) {
      console.error('加载角色配置失败:', error);
      // 显示错误消息
      setError(error.message);
    }
  };

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className={`chat-history-container ${isCollapsed ? 'collapsed' : ''}`}
    >
      <button 
        className="collapse-button"
        onClick={handleCollapse}
        title={isCollapsed ? "展开" : "收起"}
      >
        <span className="arrow">›</span>
      </button>
      <div className="chat-history-content">
        <div className="chat-history-header">
          <div className="chat-history-title-container">
            <button 
              className="role-button"
              onClick={() => setShowRoleDialog(true)}
              title="选择角色"
            >
              <svg viewBox="0 0 1024 1024" fill="none" stroke="none">
                <path d="M512 981.333333a190.593333 190.593333 0 0 1-115.2-38.4l-129.693333-97.266666a341.333333 341.333333 0 0 1-134.053334-232l-57.24-472.233334A88 88 0 0 1 184.52 45.473333c214.24 53.56 440.72 53.56 654.96 0a88 88 0 0 1 108.706667 95.96l-57.24 472.24a341.333333 341.333333 0 0 1-134.053334 232L627.2 942.933333A190.593333 190.593333 0 0 1 512 981.333333zM162.933333 85.466667a45.406667 45.406667 0 0 0-44.76 50.833333l57.24 472.24a300.106667 300.106667 0 0 0 117.293334 202.993333l129.693333 97.266667c52.753333 39.566667 126.446667 39.566667 179.2 0l129.693333-97.266667 12.8 17.066667-12.8-17.066667a300.106667 300.106667 0 0 0 117.293334-202.993333l57.24-472.24a45.333333 45.333333 0 0 0-56-49.433333A1394.273333 1394.273333 0 0 1 512 128.453333a1394.273333 1394.273333 0 0 1-337.826667-41.586666 46.22 46.22 0 0 0-11.24-1.4zM512 757.173333a398.293333 398.293333 0 0 1-157.74-32.373333 21.333333 21.333333 0 0 1 16.813333-39.22c89.56 38.386667 192.293333 38.386667 281.853334 0a21.333333 21.333333 0 0 1 16.813333 39.22A398.293333 398.293333 0 0 1 512 757.173333zM746.666667 362.666667a21.266667 21.266667 0 0 1-11.813334-3.58 93.8 93.8 0 0 0-104.333333 0 21.333333 21.333333 0 0 1-23.666667-35.506667 136.713333 136.713333 0 0 1 151.666667 0A21.333333 21.333333 0 0 1 746.666667 362.666667z m-341.333334 0a21.266667 21.266667 0 0 1-11.813333-3.58 93.8 93.8 0 0 0-104.333333 0 21.333333 21.333333 0 0 1-23.666667-35.506667 136.713333 136.713333 0 0 1 151.666667 0A21.333333 21.333333 0 0 1 405.333333 362.666667z" fill="currentColor"/>
              </svg>
            </button>
            
            <button 
              className={`mic-toggle-button ${!isMicEnabled ? 'disabled' : ''}`} 
              onClick={handleMicToggle}
              title={isMicEnabled ? "关闭麦克风" : "开启麦克风"}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <button
              className={`subtitles-toggle ${showSubtitles ? 'enabled' : ''}`}
              onClick={handleSubtitlesToggle}
              title={showSubtitles ? '隐藏字幕' : '显示字幕'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <text x="8" y="15" fontSize="10" fill="currentColor" stroke="none">字</text>
              </svg>
            </button>
            <button 
              className="menu-button" 
              onClick={() => setShowMenu(!showMenu)}
              title="菜单"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <div className={`dropdown-menu ${showMenu ? 'show' : ''}`}>
              <div className="dropdown-item" onClick={() => handleMenuItemClick('clear')}>
                清空对话
              </div>
              <div className="dropdown-item" onClick={() => handleMenuItemClick('prompt')}>
                自定义提示词
              </div>
            </div>
          </div>
        </div>
        <div className="chat-history-messages">
          {messages.filter(msg => msg.type === 'output').map((msg, index) => {
            const text = msg.message.replace(/^(我：|gemini：|正在聆听...|开始录音...|录音已停止|正在识别...|对话已重置|提示词已更新)/, '');
            const isUser = msg.message.startsWith('我：');
            
            return (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`chat-message ${isUser ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-content">
                  <div className="message-text">{text}</div>
                  {msg.start && (
                    <div className="message-timestamp">
                      {formatDate(msg.start)}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
          <div ref={messagesEndRef} style={{ height: '1px' }} />
        </div>
        <div className="chat-history-footer">
          <motion.button
            className="control-button"
            onClick={onControlClick}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title={isRecordingOrPlaying ? (isAudioPlaying ? "停止播放" : "发送录音") : "开始录音"}
          >
            <div className={`control-icon ${getControlIconClass()}`}></div>
          </motion.button>
        </div>
      </div>
      <PromptDialog
        isOpen={showPromptDialog}
        onClose={() => setShowPromptDialog(false)}
        onConfirm={handlePromptUpdate}
        defaultValue={ASSISTANT_PROMPT}
      />
      <RoleSelectDialog
        isOpen={showRoleDialog}
        onClose={() => setShowRoleDialog(false)}
        onSelect={(role) => {
          setMessages([{
            type: 'output',
            message: `已切换到角色: ${role.name}`,
            start: Date.now(),
            end: Date.now()
          }]);
        }}
        workerRef={workerRef}
      />
    </motion.div>
  );
}

// 修改 RoleSelectDialog 组件
function RoleSelectDialog({ isOpen, onClose, onSelect, workerRef }) {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);

  // 角色类型和对应的 emoji
  const roleEmojis = {
    '丽': '��‍🔬', // 科技/���究
    '书记': '👨‍💼', // 领导/管理
    '苏格拉底': '🧔', // 哲学家
    'default': '🤖' // 默认图标
  };

  useEffect(() => {
    const loadRoles = async () => {
      try {
        console.log('开始加载角色表');
        
        // 先获取目录列表
        const response = await fetch('/ai');
        const contentType = response.headers.get('content-type');
        console.log('响应类型:', contentType);
        
        if (!response.ok) {
          throw new Error(`获取角色列表失败: ${response.status}`);
        }
        
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error(`无效的响应类型: ${contentType}`);
        }
        
        const files = await response.json();
        console.log('获取到的文件列表:', files);
        
        // 加载每个角色文件
        const rolePromises = files.map(async file => {
          try {
            const response = await fetch(`/ai/${file}`);
            const contentType = response.headers.get('content-type');
            
            if (!response.ok) {
              console.error(`加载角色 ${file} 失败:`, response.status);
              return null;
            }
            
            if (!contentType || !contentType.includes('application/json')) {
              console.error(`角色文件 ${file} 响应类型无效:`, contentType);
              return null;
            }
            
            const data = await response.json();
            
            // 提取角色类型
            const type = data.role.split('，')[0];
            console.log(`加载角色 ${file}:`, { name: data.role, type });
            
            return {
              name: data.role,
              description: data.background || data.profile,
              file: file,
              type: type
            };
          } catch (error) {
            console.error(`解析角色 ${file} 失败:`, error);
            return null;
          }
        });

        const results = await Promise.all(rolePromises);
        const validRoles = results.filter(role => role !== null);
        console.log('加载的角色列表:', validRoles);
        setRoles(validRoles);
        setError(null);
      } catch (error) {
        console.error('加载角色列表失败:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  // 处理角色选择
  const handleRoleSelect = async () => {
    if (!selectedRole) return;
    
    try {
      console.log('选择角色:', selectedRole);
      const response = await fetch(`/ai/${selectedRole.file}`);
      if (!response.ok) {
        throw new Error(`加载角色配置失败: ${response.status}`);
      }
      
      const roleData = await response.json();
      console.log('加载的角色配置:', roleData);
      
      // 使用 initialization 作为主要提示词，如果没有则使用 profile
      const newPrompt = roleData.initialization || roleData.profile;
      console.log('新的提示词:', newPrompt);
      
      // 通知 worker 更新提示词并重置对话
      if (workerRef) {
        workerRef.postMessage({
          type: 'update_prompt',
          prompt: newPrompt
        });
        
        // 调用 onSelect 回调
        onSelect(selectedRole);
        
        // 关闭对话框
        onClose();
      } else {
        throw new Error('Worker 未初始化');
      }
    } catch (error) {
      console.error('加载角色配置失败:', error);
      setError(error.message);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="prompt-dialog-overlay" onClick={onClose} />
      <div className="prompt-dialog role-select-dialog">
        <h2>🎭 选择角色</h2>
        <div className="role-list">
          {loading ? (
            <div className="loading">⌛ 加载中...</div>
          ) : error ? (
            <div className="error">❌ 加载失败: {error}</div>
          ) : roles.length === 0 ? (
            <div className="empty">😕 没有找到角色配置</div>
          ) : (
            roles.map((role, index) => (
              <div 
                key={index}
                className={`role-item ${selectedRole?.file === role.file ? 'selected' : ''}`}
                onClick={() => setSelectedRole(role)}
              >
                <h3>
                  <span className="role-emoji">{roleEmojis[role.type] || roleEmojis.default}</span>
                  {role.name}
                </h3>
                <p>{role.description}</p>
              </div>
            ))
          )}
        </div>
        <div className="prompt-dialog-buttons">
          <button className="dialog-button cancel" onClick={onClose}>
            取消
          </button>
          <button 
            className="dialog-button confirm" 
            onClick={handleRoleSelect}
            disabled={!selectedRole}
          >
            确定
          </button>
        </div>
      </div>
    </>
  );
}

// 添加状态指示器组件
function StatusIndicator({ status }) {
  return (
    <motion.div 
      className="status-indicator"
      initial={{ opacity: 0 }}
      animate={{ opacity: status === "recording_start" ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {status === "recording_start" && (
        <div className="listening-indicator">
          <div className="pulse-ring"></div>
          <span className="status-text">正在聆听</span>
        </div>
      )}
    </motion.div>
  );
}

// 添加语音播放指示器组件
function AudioPlayingIndicator({ isPlaying }) {
  const styles = {
    container: {
      position: 'absolute',
      top: '5rem',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      opacity: isPlaying ? 1 : 0,
      transition: 'opacity 0.3s ease'
    },
    indicator: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '0.5rem'
    },
    wave: {
      width: '24px',
      height: '24px',
      background: '#4CAF50',
      borderRadius: '50%',
      position: 'relative',
      animation: 'pulse-green 1.5s ease-out infinite'
    },
    text: {
      color: '#4CAF50',
      fontSize: '1rem',
      fontWeight: 500,
      textShadow: '0 0 10px rgba(76, 175, 80, 0.5)'
    }
  };

  // 添加键帧动画
  const keyframes = `
    @keyframes pulse-green {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 10px rgba(76, 175, 80, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(76, 175, 80, 0);
      }
    }
  `;

  return (
    <>
      <style>{keyframes}</style>
      <motion.div style={styles.container}>
        {isPlaying && (
          <div style={styles.indicator}>
            <div style={styles.wave}></div>
            <span style={styles.text}>正在播放语音...</span>
          </div>
        )}
      </motion.div>
    </>
  );
}

function App() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [messages, setMessages] = useState([]);
  const [frequency, setFrequency] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(null);
  const worker = useRef(null);
  const currentAudio = useRef(null);
  const [customPrompt, setCustomPrompt] = useState(ASSISTANT_PROMPT);
  const [showSubtitles, setShowSubtitles] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 改制按钮理函
  const handleControlClick = () => {
    if (isAudioPlaying) {
      // 停止音频播放
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current.currentTime = 0;
        currentAudio.current = null;
      }
      setIsAudioPlaying(false);
      worker.current?.postMessage({ 
        type: 'tts_status', 
        ttsStatus: 'stopped'
      });
    } else if (isRecording) {
      // 检查录音时长
      const recordingDuration = Date.now() - recordingStartTime;
      if (recordingDuration >= 2000) { // 如果录音时长超过2秒
        // 发送录音
        worker.current?.postMessage({ type: 'force_transcribe' });
      } else {
        // 停止录音
        worker.current?.postMessage({ type: 'stop_recording' });
        setIsRecording(false);
      }
      setRecordingStartTime(null);
    } else {
      // 强制开始录音
      worker.current?.postMessage({ type: 'force_start_recording' });
      setIsRecording(true);
      setStatus("recording_start");
      setRecordingStartTime(Date.now());
    }
  };

  useEffect(() => {
    // Initialize worker on mount
    worker.current ??= new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });

    // NOTE: Certain browsers handle error messages differently, so to ensure
    // compatibility, we need to handle errors in both `message` and `error` events.
    const onMessage = ({ data }) => {
      if (data.error) {
        return onError(data.error);
      }
      if (data.type === "status") {
        setStatus(data.status);
        if (data.status === "recording_start") {
          setIsRecording(true);
          setRecordingStartTime(Date.now());
        } else if (data.status === "recording_end") {
          setIsRecording(false);
          setRecordingStartTime(null);
        }
        setMessages((prev) => [...prev, data]);
      } else if (data.type === "play_audio") {
        // 处理音频播放
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
        }
        const audioUrl = URL.createObjectURL(data.audioBlob);
        const audio = new Audio(audioUrl);
        currentAudio.current = audio;

        // 设置音频事件处理
        audio.onplay = () => {
          setIsAudioPlaying(true);
          worker.current?.postMessage({ 
            type: 'tts_status', 
            ttsStatus: 'playing'
          });
        };

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (currentAudio.current === audio) {
            currentAudio.current = null;
          }
          setIsAudioPlaying(false);
          worker.current?.postMessage({ 
            type: 'tts_status', 
            ttsStatus: 'stopped'
          });
        };

        audio.onpause = () => {
          setIsAudioPlaying(false);
          worker.current?.postMessage({ 
            type: 'tts_status', 
            ttsStatus: 'stopped'
          });
        };

        audio.play().catch(error => {
          console.error('音频播放失败:', error);
          URL.revokeObjectURL(audioUrl);
          currentAudio.current = null;
          setIsAudioPlaying(false);
          worker.current?.postMessage({ 
            type: 'tts_status', 
            ttsStatus: 'stopped'
          });
        });
      } else if (data.type === "interrupt_playback") {
        // 处理打断播放的消息
        if (currentAudio.current) {
          currentAudio.current.pause();
          currentAudio.current.currentTime = 0;
          currentAudio.current = null;
        }
        setIsAudioPlaying(false);
      } else {
        setMessages((prev) => [...prev, data]);
      }
    };
    const onError = (error) => setError(error.message);

    // Attach the callback function as an event listener.
    worker.current.addEventListener("message", onMessage);
    worker.current.addEventListener("error", onError);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener("message", onMessage);
      worker.current.removeEventListener("error", onError);
      // 清理音频
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current = null;
      }
      setIsAudioPlaying(false);
      // 通知 worker 组件卸载
      worker.current?.postMessage({ 
        type: 'tts_status', 
        ttsStatus: 'stopped'
      });
    };
  }, []);

  useEffect(() => {
    // https://react.dev/learn/synchronizing-with-effects#fetching-data
    let ignore = false; // Flag to track if the effect is active
    const audioStream = navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        autoGainControl: true,
        noiseSuppression: true,
        sampleRate: SAMPLE_RATE,
      },
    });

    let worklet;
    let audioContext;
    let source;
    audioStream
      .then(async (stream) => {
        if (ignore) return; // Exit if the effect has been cleaned up

        audioContext = new (window.AudioContext || window.webkitAudioContext)({
          sampleRate: SAMPLE_RATE,
          latencyHint: "interactive",
        });

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 32;

        // NOTE: In Firefox, the following line may throw an error:
        // "AudioContext.createMediaStreamSource: Connecting AudioNodes from AudioContexts with different sample-rate is currently not supported."
        // See the following bug reports for more information:
        //  - https://bugzilla.mozilla.org/show_bug.cgi?id=1674892
        //  - https://bugzilla.mozilla.org/show_bug.cgi?id=1674892
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const getAverageFrequency = () => {
          analyser.getByteFrequencyData(dataArray);
          return (
            dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
          );
        };

        const updateFrequency = () => {
          const frequency = getAverageFrequency();
          setFrequency(frequency);
          requestAnimationFrame(updateFrequency);
        };
        updateFrequency();

        await audioContext.audioWorklet.addModule(
          new URL("./processor.js", import.meta.url),
        );

        worklet = new AudioWorkletNode(audioContext, "vad-processor", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          channelCountMode: "explicit",
          channelInterpretation: "discrete",
        });

        source.connect(worklet);

        worklet.port.onmessage = (event) => {
          const { buffer } = event.data;

          // Dispatch buffer for voice activity detection
          worker.current?.postMessage({ buffer });
        };
      })
      .catch((err) => {
        setError(err.message);
        console.error(err);
      });

    return () => {
      ignore = true; // Mark the effect as cleaned up
      audioStream.then((stream) =>
        stream.getTracks().forEach((track) => track.stop()),
      );
      source?.disconnect();
      worklet?.disconnect();
      audioContext?.close();
    };
  }, []);

  const downloadTranscript = () => {
    const content = messages
      .filter((output) => output.type === "output")
      .map(
        (output) =>
          `${formatDate(output.start)} - ${formatDate(output.end)} | ${output.message}`,
      )
      .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 处理除对话
  const handleClearChat = () => {
    setMessages([]);
    worker.current?.postMessage({ type: 'reset_conversation' });
  };

  // 处理更新提示词
  const handleUpdatePrompt = (newPrompt) => {
    console.log('更新提示词:', newPrompt);
    
    // 更新本地状态
    setCustomPrompt(newPrompt);
    
    // 清除现有对话
    setMessages([]);
    
    // 通知 worker 更新提示词并重置对话
    worker.current?.postMessage({ 
      type: 'update_prompt',
      prompt: newPrompt
    });
    
    // 添加提示消息
    setMessages([{
      type: 'output',
      message: '开始新的对话',
      start: Date.now(),
      end: Date.now()
    }]);
  };

  // 处理收起状态变化
  const handleCollapse = (collapsed) => {
    setIsCollapsed(collapsed);
  };

  return (
    <div className={`app-container ${isCollapsed ? 'collapsed' : ''}`}>
      {/* 左侧动画区域 */}
      <div className="animation-container">
        <Canvas camera={{ position: [0, 0, 8] }}>
          <ambientLight intensity={0.5} />
          <BloomScene frequency={frequency} />
          <AnimatedMesh
            ready={status !== null}
            active={status === "recording_start"}
            frequency={frequency}
          />
        </Canvas>
        
        {/* 添加状态指示器 */}
        <StatusIndicator status={status} />
        
        {/* 添加音频播放指示器 */}
        <AudioPlayingIndicator isPlaying={isAudioPlaying} />
        
        {/* 根据 showSubtitles 状态显示或隐藏字幕 */}
        {showSubtitles && (
          <div className="current-message-container">
            {messages.slice(-2).map(({ type, message }, index) => {
              if (message.startsWith('我：')) return null;
              
              const text = message.replace(/^(gemini：|正在聆听...|开始录音...|录音已停止|正在识别...|对话已重置|提示词已更新)/, '');
              if (!text.trim()) return null;
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  className="current-message large"
                >
                  {text}
                </motion.div>
              );
            }).reverse()}
          </div>
        )}
      </div>

      {/* 右侧聊天记录 */}
      <ChatHistoryCard 
        messages={messages}
        setMessages={setMessages}
        onControlClick={handleControlClick}
        isRecordingOrPlaying={isRecording || isAudioPlaying}
        recordingStartTime={recordingStartTime}
        isAudioPlaying={isAudioPlaying}
        onClearChat={handleClearChat}
        onUpdatePrompt={handleUpdatePrompt}
        workerRef={worker.current}
        showSubtitles={showSubtitles}
        onSubtitlesChange={setShowSubtitles}
        onCollapse={handleCollapse}
      />
    </div>
  );
}

export default App;
