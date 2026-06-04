const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai'); // 引入 OpenAI 套件
require('dotenv').config();

const app = express();
const port = 3000;

// 中介軟體
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 初始化 OpenAI 客戶端 (會自動讀取 .env 中的 OPENAI_API_KEY)
const openai = new OpenAI();

// 負責處理聊天請求的 API 路由
app.post('/api/chat', async (req, res) => {
    try {
        // 1. 從前端發送的請求中提取參數 (這對應到 HW01 的自訂參數功能)
        const { model, messages, temperature, max_tokens } = req.body;

        // 2. 設定 HTTP 標頭，告訴瀏覽器這是一個 Server-Sent Events (SSE) 串流回應
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 3. 呼叫外部 OpenAI API，並強制開啟 stream: true
        const stream = await openai.chat.completions.create({
            model: model || 'gpt-3.5-turbo',
            messages: messages,
            temperature: parseFloat(temperature) || 0.7,
            max_tokens: parseInt(max_tokens) || 1000,
            stream: true,
        });

        // 4. 將收到的資料碎片 (chunk) 即時用 res.write() 傳回給前端
        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                // 必須轉換成字串格式傳送
                res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
        }
        
        // 5. 傳輸完畢，發送結束訊號
        res.write('data: [DONE]\n\n');
        res.end();

    } catch (error) {
        console.error('API 錯誤:', error);
        res.status(500).json({ error: '伺服器發生錯誤，請檢查終端機的錯誤訊息' });
    }
});

app.listen(port, () => {
    console.log(`伺服器已啟動，請在瀏覽器開啟 http://localhost:${port}`);
});