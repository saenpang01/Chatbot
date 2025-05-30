const line = require('@line/bot-sdk');
const { getAllDriveTexts } = require('./get-doc-content');
const { askWithContext, summarizeData } = require('./qa-with-context');

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

console.log('LINE Config Check:');
console.log('- Access Token exists:', !!config.channelAccessToken);
console.log('- Channel Secret exists:', !!config.channelSecret);
console.log('- Access Token length:', config.channelAccessToken?.length || 0);

// ตรวจสอบ config ก่อนสร้าง client
if (!config.channelAccessToken || !config.channelSecret) {
    console.error('❌ Missing LINE configuration. Please check your .env file.');
    console.error('Required variables: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET');
    process.exit(1);
}

const client = new line.Client(config); // ✅ แก้ไข line.Client

async function handleMessage(event) {
    console.log('📨 Received event:', JSON.stringify(event, null, 2));
    
    if (event.type !== 'message' || event.message.type !== 'text') {
        console.log('ℹ️ Skipping non-text message');
        return null;
    }

    const userMessage = event.message.text;
    const replyToken = event.replyToken;
    
    console.log('👤 User message:', userMessage);
    console.log('🔑 Reply token:', replyToken);

    try {
        console.log('📁 Fetching data from Google Drive...');
        
        // ดึงข้อมูลจาก Google Drive
        let context = "";
        try {
            const driveTexts = await getAllDriveTexts();
            console.log('driveTexts:', driveTexts); // 👈 เพิ่ม log
           if (Array.isArray(driveTexts)) { // 👈 ตรวจสอบว่าเป็น array
                if (driveTexts.length > 0) {
                    context = driveTexts.join('\n\n');
                    console.log('✅ Google Drive data loaded, length:', context.length);
                    console.log('📄 Preview:', context.substring(0, 200) + '...');
                } else {
                    console.log('⚠️ No data found in Google Drive');
                    context = "ไม่พบข้อมูลใน Google Drive";
                }
            } else if (typeof driveTexts === 'string') { // 👈 ถ้าเป็น string
                context = driveTexts; // ใช้ string นั้นเลย (อาจเป็น error message)
            } else {
                console.error('❌ Unexpected data type from getAllDriveTexts:', typeof driveTexts);
                context = "เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Drive";
            }

        } catch (driveError) {
            console.error('❌ Error fetching Google Drive data:', driveError);
            context = "เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Drive";
        }
        
        console.log('🤖 Calling Gemini API...');
        const aiResponse = await askWithContext(userMessage, context);
        console.log('✅ Gemini response:', aiResponse);

        // สร้างข้อความตอบกลับ
        const replyMessage = {
            type: 'text',
            text: aiResponse
        };

        console.log('📤 Sending reply to LINE...');
        console.log('Reply message:', JSON.stringify(replyMessage, null, 2));
        
        // ส่งข้อความกลับไปยัง LINE
        const lineResponse = await client.replyMessage(replyToken, replyMessage);
        
        console.log('✅ LINE API response:', lineResponse);
        console.log('✅ Message sent successfully to LINE');
        
        return lineResponse;

    } catch (error) {
        console.error('❌ Error in handleMessage:', error);
        
        // พยายามส่งข้อความ error กลับไป
        try {
            const errorMessage = {
                type: 'text',
                text: 'ขออภัย เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง'
            };
            
            console.log('📤 Sending error message to LINE...');
            const errorResponse = await client.replyMessage(replyToken, errorMessage);
            console.log('✅ Error message sent to LINE:', errorResponse);
            
        } catch (replyError) {
            console.error('❌ Failed to send error message to LINE:', replyError);
        }
        
        throw error;
    }
}

module.exports = { handleMessage };