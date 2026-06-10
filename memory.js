const { OpenAI } = require('openai');
const cosineSimilarity = require('compute-cosine-similarity');
require('dotenv').config();

const openai = new OpenAI();

// 微型向量資料庫 (儲存在記憶體中)
let vectorDB = []; 

// 取得文字的向量表示
async function getEmbedding(text) {
    const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
    });
    return response.data[0].embedding;
}

// 儲存對話到長期記憶中
async function saveToMemory(text) {
    const embedding = await getEmbedding(text);
    vectorDB.push({ text, embedding });
    console.log(`[記憶儲存] 已存入: ${text.substring(0, 20)}...`);
}

// 搜尋最相關的歷史記憶
async function searchMemory(currentQuery, topK = 3) {
    if (vectorDB.length === 0) return [];

    const queryEmbedding = await getEmbedding(currentQuery);
    
    const results = vectorDB.map(item => ({
        text: item.text,
        score: cosineSimilarity(queryEmbedding, item.embedding)
    }));

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => r.text);
}

module.exports = { saveToMemory, searchMemory };