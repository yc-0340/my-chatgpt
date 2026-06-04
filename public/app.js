const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// 實作 HW01 功能 5：交談短期記憶
// 用來儲存歷史對話的陣列
let conversation = [];

// 監聽送出按鈕與 Shift+Enter 快捷鍵
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // 抓取畫面上所有的設定參數
    const model = document.getElementById('model-select').value;
    const systemPrompt = document.getElementById('system-prompt').value;
    const temperature = document.getElementById('temperature').value;
    const maxTokens = document.getElementById('max-tokens').value;

    // 顯示使用者的問題在畫面上
    appendMessage(text, 'user-msg');
    userInput.value = ''; // 清空輸入框

    // 準備發送給 API 的訊息結構
    // 永遠把 System Prompt 放在最前面，接著放入歷史記憶，最後放入現在的問題
    let currentMessages = [
        { role: "system", content: systemPrompt },
        ...conversation,
        { role: "user", content: text }
    ];

    // 先在畫面上建立一個空的 AI 訊息泡泡，準備接收資料
    const aiMessageDiv = appendMessage('', 'ai-msg');

    try {
        // 發送 POST 請求給我們自己的 Node.js 後端
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: model,
                messages: currentMessages,
                temperature: temperature,
                max_tokens: maxTokens
            })
        });

        // 實作 HW01 功能 4：Streaming 串流解析
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let aiFullResponse = '';

        // 不斷讀取後端傳來的資料碎片 (Chunks)
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                // 檢查是否為正確的 data 格式，且不是結束訊號 [DONE]
                if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    const data = JSON.parse(line.replace('data: ', ''));
                    aiFullResponse += data.text;
                    // 即時更新畫面，達成打字機效果
                    aiMessageDiv.innerText = aiFullResponse; 
                }
            }
        }

        // 當 AI 回覆完畢後，將這次的一問一答推進短期記憶中
        conversation.push({ role: "user", content: text });
        conversation.push({ role: "assistant", content: aiFullResponse });

        // 防止對話過長導致 Token 爆掉，這裡設定只保留最近 10 筆紀錄 (5組問答)
        if (conversation.length > 10) {
            conversation = conversation.slice(-10);
        }

    } catch (error) {
        console.error("串流錯誤:", error);
        aiMessageDiv.innerText = "連線發生錯誤，請檢查終端機或 API 金鑰設定。";
    }
}

// 輔助函式：用來將訊息新增到聊天畫面上並自動捲動到最底
function appendMessage(text, className) {
    const div = document.createElement('div');
    div.className = `message ${className}`;
    div.innerText = text;
    chatHistory.appendChild(div);
    chatHistory.scrollTop = chatHistory.scrollHeight; 
    return div;
}