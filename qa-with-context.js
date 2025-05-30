const { GoogleGenerativeAI } = require("@google/generative-ai");

// ตรวจสอบ API Key
if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
}

// โหลด API Key ของ Gemini จาก .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// เพิ่มในส่วนบนของไฟล์
let lastApiCall = 0;
const MIN_INTERVAL = 2000; // 2 วินาที

// ฟังก์ชันเพื่อหน่วงเวลา (delay)
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ฟังก์ชันเพื่อควบคุม rate
async function rateLimiter() {
    const now = Date.now();
    const timeSinceLastCall = now - lastApiCall;
    
    if (timeSinceLastCall < MIN_INTERVAL) {
        const waitTime = MIN_INTERVAL - timeSinceLastCall;
        console.log(`⏳ Waiting ${waitTime}ms to respect rate limit...`);
        await delay(waitTime);
    }
    
    lastApiCall = Date.now();
}

// ฟังก์ชันเพื่อ retry เมื่อเจอ rate limit
async function callWithRetry(apiCall, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            // ตรวจสอบว่าเป็น rate limit error หรือไม่
            if (error.status === 429) {
                const retryDelay = error.errorDetails?.find(
                    detail => detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
                )?.retryDelay;
                
                let waitTime = 60000; // default 60 วินาที
                if (retryDelay) {
                    // แปลง "56s" เป็น milliseconds
                    waitTime = parseInt(retryDelay.replace('s', '')) * 1000;
                }
                
                console.log(`⏳ Rate limit exceeded. Waiting ${waitTime/1000} seconds before retry... (Attempt ${attempt + 1}/${maxRetries})`);
                
                if (attempt < maxRetries - 1) {
                    await delay(waitTime);
                    continue;
                }
            }
            throw error;
        }
    }
}

// ฟังก์ชันหลัก: รับคำถาม + context → ส่งให้ Gemini ตอบ
async function askWithContext(question, context) {
    await rateLimiter(); // เพิ่ม rate limiter
    
    // ใช้ gemini-1.5-flash เพื่อประหยัด quota
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
คุณคือแชทบอทผู้ช่วย ให้คำตอบตามข้อมูลที่กำหนดไว้เท่านั้น
ข้อมูลมีดังนี้:
"""
${context}
"""

คำถามคือ:
${question}

ตอบโดยอิงจากข้อมูลด้านบนเท่านั้น และให้คำตอบที่กระชับ ตรงประเด็น และเข้าใจง่าย
หากไม่มีข้อมูลที่เกี่ยวข้องใน Context ให้ตอบว่า "ไม่มีข้อมูล"
`;

    try {
        return await callWithRetry(async () => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการถามพร้อมบริบท:", error);
        
        // ส่งคืนข้อความที่เป็นมิตรแทนการ throw error
        if (error.status === 429) {
            return "ขออภัย ระบบมีการใช้งานเกินกำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";
        }
        return "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม";
    }
}

async function summarizeData(data, instructions = "") {
    await rateLimiter(); // เพิ่ม rate limiter
    
    // ใช้ gemini-1.5-flash แทน pro เพื่อประหยัด quota
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `โปรดสรุปข้อมูลต่อไปนี้ให้กระชับและได้ใจความ${instructions ? ` โดยเน้นที่: ${instructions}` : ""}:

    """
    ${data}
    """

    สรุปเป็น bullet points:
    `;

    try {
        return await callWithRetry(async () => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการสรุปข้อมูล:", error);
        
        // ส่งคืนข้อความที่เป็นมิตรแทนการ throw error
        if (error.status === 429) {
            return "ขออภัย ระบบมีการใช้งานเกินกำหนด ไม่สามารถสรุปข้อมูลได้ในขณะนี้";
        }
        return "เกิดข้อผิดพลาดในการสรุปข้อมูล";
    }
}

module.exports = { askWithContext, summarizeData };