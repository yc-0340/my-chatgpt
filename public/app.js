const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

// --- 新增：多模態圖片處理變數 ---
let currentBase64Image = null;
const imgUpload = document.getElementById('img-upload');
const imgPreview = document.getElementById('img-preview');

// 用來儲存歷史對話的陣列 (短期記憶)
let conversation = [];

// 1. 監聽圖片上傳事件，並透過 FileReader 轉換為 Base64
if (imgUpload) {
    imgUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            currentBase64Image = event.target.result; // 取得 Base64 字串
            imgPreview.src = currentBase64Image;      // 在畫面上顯示預覽圖
            imgPreview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    });
}

// 2. 監聽送出按鈕與 Shift+Enter 快捷鍵
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const text = userInput.value.trim();
    
    // 如果沒有輸入文字且沒有上傳圖片，就不執行
    if (!text && !currentBase64Image) return;

    // 抓取畫面上所有的設定參數
    const model = document.getElementById('model-select').value;
    const systemPrompt = document.getElementById('system-prompt').value;
    const temperature = document.getElementById('temperature').value;
    const maxTokens = document.getElementById('max-tokens').value;

    // 顯示使用者的問題在畫面上 (如果有圖片，加個提示字眼)
    const displayMsg = currentBase64Image ? `[附加了一張圖片] ${text}` : text;
    appendMessage(displayMsg, 'user-msg');

    // 3. 準備發送給 API 的結構 (判斷是否有多模態圖片)
    let userContent = text;
    if (currentBase64Image) {
        // 這是 OpenAI 規定的多模態格式陣列
        userContent = [
            { type: "text", text: text || "請描述這張圖片" },
            { type: "image_url", image_url: { url: currentBase64Image } }
        ];
    }

    // 打包完整的訊息陣列
    let currentMessages = [
        { role: "system", content: systemPrompt },
        ...conversation,
        { role: "user", content: userContent }
    ];

    // 4. 送出後清空輸入框與圖片預覽
    userInput.value = ''; 
    currentBase6