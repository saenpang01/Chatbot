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

// วิเคราะห์ประเภทคำถามเพื่อให้คำแนะนำที่เหมาะสม
function analyzeQuestionType(question) {
    const questionLower = question.toLowerCase();
    
    if (questionLower.includes('เศรษฐกิจ') || questionLower.includes('เกษตร') || questionLower.includes('อุตสาหกรรม')) {
        return 'economy';
    } else if (questionLower.includes('ประชากร') || questionLower.includes('ชุมชน') || questionLower.includes('สังคม')) {
        return 'population';
    } else if (questionLower.includes('เลือกตั้ง') || questionLower.includes('การเมือง') || questionLower.includes('พรรค')) {
        return 'politics';
    } else if (questionLower.includes('สถิติ') || questionLower.includes('รายงาน') || questionLower.includes('ข้อมูล')) {
        return 'statistics';
    } else if (questionLower.includes('แนะนำ') || questionLower.includes('นโยบาย') || questionLower.includes('พัฒนา')) {
        return 'policy';
    } else if (questionLower.includes('เปรียบเทียบ') || questionLower.includes('วิเคราะห์') || questionLower.includes('แนวโน้ม')) {
        return 'analysis';
    }
    
    return 'general';
}

// สร้างคำแนะนำเพิ่มเติมตามประเภทคำถาม
function generateAdditionalSuggestions(questionType, context) {
    const suggestions = {
        economy: [
            "💡 คำถามเพิ่มเติมที่เกี่ยวกับเศรษฐกิจ:",
            "• ภาคเกษตรของจังหวัดอุตรดิตถ์มีศักยภาพอย่างไร?",
            "• อุตสาหกรรมหลักที่สำคัญของจังหวัดคืออะไร?",
            "• ปัจจัยใดที่ส่งผลต่อการพัฒนาเศรษฐกิจท้องถิ่น?",
            "• แนวทางพัฒนาเศรษฐกิจที่ยั่งยืนสำหรับจังหวัด"
        ],
        population: [
            "💡 คำถามเพิ่มเติมเกี่ยวกับประชากร:",
            "• โครงสร้างประชากรของจังหวัดเป็นอย่างไร?",
            "• แนวโน้มการเปลี่ยนแปลงของประชากรในพื้นที่?",
            "• ปัญหาประชากรที่สำคัญของจังหวัด?",
            "• นโยบายที่เหมาะสมสำหรับการจัดการประชากร"
        ],
        politics: [
            "💡 คำถามเพิ่มเติมด้านการเมือง:",
            "• แนวโน้มการเลือกตั้งในจังหวัดอุตรดิตถ์?",
            "• พรรคการเมืองใดได้รับความนิยมมากที่สุด?",
            "• ปัจจัยที่มีผลต่อพฤติกรรมการเลือกตั้งของประชาชน?",
            "• เปรียบเทียบผลการเลือกตั้งในช่วงเวลาต่างๆ"
        ],
        statistics: [
            "💡 คำถามเพิ่มเติมเกี่ยวกับสถิติ:",
            "• สถิติใดที่แสดงถึงการพัฒนาของจังหวัด?",
            "• เปรียบเทียบข้อมูลสถิติระหว่างปีต่างๆ?",
            "• ข้อมูลสถิติที่น่าสนใจของจังหวัดอุตรดิตถ์?",
            "• การใช้สถิติในการวางแผนพัฒนา"
        ],
        policy: [
            "💡 คำแนะนำด้านนโยบาย:",
            "• นโยบายที่เหมาะสมสำหรับการพัฒนาจังหวัด?",
            "• แนวทางแก้ไขปัญหาเร่งด่วนของพื้นที่?",
            "• การส่งเสริมการมีส่วนร่วมของประชาชน?",
            "• ยุทธศาสตร์การพัฒนาระยะยาว"
        ],
        analysis: [
            "💡 การวิเคราะห์เพิ่มเติม:",
            "• เปรียบเทียบข้อมูลระหว่างอำเภอต่างๆ?",
            "• วิเคราะห์จุดแข็งและจุดอ่อนของจังหวัด?",
            "• คาดการณ์แนวโน้มในอนาคต?",
            "• ปัจจัยความสำเร็จในการพัฒนา"
        ],
        general: [
            "💡 คำถามที่เป็นประโยชน์:",
            "• ลักษณะเด่นของจังหวัดอุตรดิตถ์?",
            "• ข้อมูลสำคัญที่ควรทราบเกี่ยวกับจังหวัด?",
            "• การพัฒนาที่น่าสนใจในพื้นที่?",
            "• ศักยภาพและโอกาสของจังหวัด"
        ]
    };
    
    return suggestions[questionType] || suggestions.general;
}

// ฟังก์ชันหลัก: รับคำถาม + context → ส่งให้ Gemini ตอบพร้อมคำแนะนำ
async function askWithContext(question, context) {
    await rateLimiter();
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const questionType = analyzeQuestionType(question);

    const prompt = `
คุณคือแชทบอทผู้ช่วยที่เชี่ยวชาญในการวิเคราะห์ข้อมูลจังหวัดอุตรดิตถ์ 
ด้านการเมือง เศรษฐกิจ สังคม และประชากร

ข้อมูลที่มีอยู่:
"""
${context}
"""

คำถาม: ${question}

คำแนะนำในการตอบ:
1. ตอบคำถามโดยอิงจากข้อมูลที่ให้มาเท่านั้น
2. ให้คำตอบที่กระชับ ตรงประเด็น และเข้าใจง่าย
3. หากข้อมูลไม่เพียงพอ ให้บอกว่า "ข้อมูลไม่เพียงพอ" และแนะนำว่าควรหาข้อมูลเพิ่มเติมจากแหล่งใด
4. ใช้ตัวเลขและข้อมูลจริงในการสนับสนุนคำตอบ
5. เพิ่มการวิเคราะห์เชิงลึกที่เป็นประโยชน์ต่อการตัดสินใจ
6. ให้คำแนะนำที่เป็นประโยชน์ต่อการพัฒนาจังหวัดหรือการบริหารงานของผู้นำท้องถิ่น

รูปแบบการตอบ:
📋 คำตอบ: [คำตอบหลักโดยอิงจากข้อมูล]

🔍 การวิเคราะห์เพิ่มเติม: [วิเคราะห์เชิงลึกหากมีข้อมูลเพียงพอ]

💡 คำแนะนำเชิงนโยบาย: [ข้อเสนอแนะที่เป็นประโยชน์ต่อการพัฒนาจังหวัด]
`;

    try {
        const response = await callWithRetry(async () => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });

        // เพิ่มคำแนะนำเพิ่มเติมตามประเภทคำถาม
        const additionalSuggestions = generateAdditionalSuggestions(questionType, context);
        
        return `${response}\n\n${additionalSuggestions.join('\n')}`;
        
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการถามพร้อมบริบท:", error);
        
        if (error.status === 429) {
            return "ขออภัย ระบบมีการใช้งานเกินกำหนด กรุณารอสักครู่แล้วลองใหม่อีกครั้ง";
        }
        return "ขออภัย เกิดข้อผิดพลาดในการประมวลผลคำถาม";
    }
}

async function summarizeData(data, instructions = "") {
    await rateLimiter();
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
คุณคือผู้เชี่ยวชาญในการสรุปข้อมูลธุรกิจ
โปรดสรุปข้อมูลต่อไปนี้ให้กระชับและครอบคลุม${instructions ? ` โดยเน้นที่: ${instructions}` : ""}:

"""
${data}
"""

รูปแบบการสรุป:
📊 สรุปข้อมูลสำคัญ:
• [จุดสำคัญที่ 1]
• [จุดสำคัญที่ 2]
• [จุดสำคัญที่ 3]

📈 แนวโน้มและการเปลี่ยนแปลง:
• [แนวโน้มที่สำคัญ]

⚠️ ประเด็นที่ต้องติดตาม:
• [ปัญหาหรือโอกาสที่สำคัญ]

💡 ข้อเสนอแนะ:
• [คำแนะนำเชิงปฏิบัติ]
`;

    try {
        return await callWithRetry(async () => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการสรุปข้อมูล:", error);
        
        if (error.status === 429) {
            return "ขออภัย ระบบมีการใช้งานเกินกำหนด ไม่สามารถสรุปข้อมูลได้ในขณะนี้";
        }
        return "เกิดข้อผิดพลาดในการสรุปข้อมูล";
    }
}

// เพิ่มฟังก์ชันใหม่สำหรับให้คำแนะนำเชิงลึก
async function getSmartRecommendations(question, context) {
    await rateLimiter();
    
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
วิเคราะห์ข้อมูลจังหวัดอุตรดิตถ์และให้คำแนะนำเชิงนโยบายที่เป็นประโยชน์:

ข้อมูล:
"""
${context}
"""

คำถามเดิม: ${question}

ให้คำแนะนำในรูปแบบ:

🎯 นโยบายระยะสั้น (6 เดือน - 1 ปี):
• [นโยบายที่สามารถดำเนินการได้ทันที]

🚀 ยุทธศาสตร์ระยะยาว (3-5 ปี):
• [แผนการพัฒนาระยะยาว]

📊 การติดตามและประเมินผล:
• [ตัวชี้วัดหรือ KPI ที่ควรติดตาม]

⭐ แนวคิดสร้างสรรค์:
• [ข้อเสนอแนะที่นวัตกรรมหรือแปลกใหม่สำหรับการพัฒนาจังหวัด]

🤝 การมีส่วนร่วมของประชาชน:
• [วิธีการให้ประชาชนเข้ามามีส่วนร่วม]
`;

    try {
        return await callWithRetry(async () => {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        });
    } catch (error) {
        console.error("❌ เกิดข้อผิดพลาดในการให้คำแนะนำ:", error);
        return "ไม่สามารถสร้างคำแนะนำเพิ่มเติมได้ในขณะนี้";
    }
}

module.exports = { askWithContext, summarizeData, getSmartRecommendations };