const express = require('express');
const cors = require('cors');
const { OpenAI } = require('openai');
require('dotenv').config();
const { saveToMemory, searchMemory } = require('./memory.js');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const openai = new OpenAI();

function autoRouteModel(messages, frontendModel) {
    const lastMessage = messages[messages.length - 1].content;
    if (Array.isArray(lastMessage)) return 'gpt-4o';
    const text = typeof lastMessage === 'string' ? lastMessage : '';
    const complexKeywords = ['程式', 'c++', '演算法', '時間複雜度', '動態規劃', '報錯', '計算', 'debug'];
    if (complexKeywords.some(keyword => text.toLowerCase().includes(keyword))) return 'gpt-4o';
    return frontendModel || 'gpt-3.5-turbo';
}

// --- 新增：我們提供給 AI 的工具清單 ---
const tools = [
    {
        type: "function",
        function: {
            name: "get_weather",
            description: "當使用者詢問任何地點的天氣時，必須呼叫此工具來獲取即時天氣資訊。",
            parameters: {
                type: "object",
                properties: {
                    location: { type: "string", description: "城市名稱，例如：台北、新竹、東京" }
                },
                required: ["location"]
            }
        }
    }
];

app.post('/api/chat', async (req, res) => {
    try {
        const { model: requestedModel, messages, temperature, max_tokens } = req.body;

        const lastMessage = messages[messages.length - 1].content;
        let currentQuery = typeof lastMessage === 'string' ? lastMessage : 
            (Array.isArray(lastMessage) ? (lastMessage.find(item => item.type === 'text')?.text || '') : '');

        const finalModel = autoRouteModel(messages, requestedModel);

        const relevantMemories = await searchMemory(currentQuery);
        if (relevantMemories.length > 0) {
            const systemMessage = messages.find(m => m.role === 'system');
            if (systemMessage) systemMessage.content += "\n\n=== 過去的相關記憶 ===\n" + relevantMemories.join("\n");
        }

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 呼叫 API，並將 tools 傳遞給 AI
        const stream = await openai.chat.completions.create({
            model: finalModel,
            messages: messages,
            tools: tools,
            temperature: parseFloat(temperature) || 0.7,
            max_tokens: parseInt(max_tokens) || 1000,
            stream: true,
        });

        let aiFullResponse = "";
        let toolCallName = "";
        let toolCallArgs = "";

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;

            // 1. 攔截 AI 呼叫工具的請求
            if (delta?.tool_calls) {
                if (delta.tool_calls[0].function.name) toolCallName += delta.tool_calls[0].function.name;
                if (delta.tool_calls[0].function.arguments) toolCallArgs += delta.tool_calls[0].function.arguments;
                continue; // 收集工具參數，暫不輸出到前端
            }

            // 2. 正常文字串流輸出
            if (delta?.content) {
                aiFullResponse += delta.content;
                res.write(`data: ${JSON.stringify({ text: delta.content })}\n\n`);
            }
        }

        // 3. 串流結束後，如果 AI 決定要使用工具，我們就在這裡執行它！
        if (toolCallName === 'get_weather') {
            const args = JSON.parse(toolCallArgs);
            console.log(`🛠️ [工具執行] 正在查詢 ${args.location} 的天氣...`);
            
            // 這裡模擬我們去呼叫真實天氣 API 的結果
            let weatherResult = "";
            if (args.location.includes('新竹')) {
                weatherResult = `新竹目前天氣：晴朗多雲，氣溫約 28 度，風勢偏大。`;
            } else {
                weatherResult = `${args.location}目前天氣：陰陣雨，氣溫 22 度。`;
            }

            // 將工具執行的結果補發給前端畫面
            const toolMsg = `\n\n*(系統已自動呼叫 ${toolCallName} 工具)*\n**即時資訊：** ${weatherResult}`;
            aiFullResponse += toolMsg;
            res.write(`data: ${JSON.stringify({ text: toolMsg })}\n\n`);
        }
        
        res.write('data: [DONE]\n\n');
        res.end();

        await saveToMemory(`User: ${currentQuery}\nAI: ${aiFullResponse}`);

    } catch (error) {
        console.error('API 錯誤:', error);
        res.status(500).json({ error: '伺服器發生錯誤' });
    }
});

app.listen(port, () => {
    console.log(`伺服器已啟動，請在瀏覽器開啟 http://localhost:${port}`);
});