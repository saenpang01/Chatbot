const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function authorize() {
  try {
    // ตรวจสอบว่ามีไฟล์ credentials.json หรือไม่
    const credentialsPath = path.join(__dirname, 'credentials.json');
    
    if (!fs.existsSync(credentialsPath)) {
      throw new Error('ไม่พบไฟล์ credentials.json กรุณาสร้าง Service Account และดาวน์โหลดไฟล์ JSON');
    }

    console.log('กำลังโหลด credentials...');
    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

    // ตรวจสอบว่าเป็น Service Account หรือไม่
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error('ไฟล์ credentials.json ไม่ใช่ Service Account กรุณาดาวน์โหลดไฟล์ JSON ของ Service Account');
    }

    console.log(`Service Account Email: ${credentials.client_email}`);

    // สร้าง JWT Auth สำหรับ Service Account
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key.replace(/\\n/g, '\n'), // แก้ไข line breaks
      [
        'https://www.googleapis.com/auth/documents.readonly',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    );

    // ทำการ authorize
    console.log('กำลัง authorize กับ Google API...');
    await auth.authorize();
    
    console.log('Google API authentication สำเร็จ');
    return auth;
  } catch (error) {
    console.error('Google API authentication ล้มเหลว:', error.message);
    
    // แสดงข้อมูลเพิ่มเติมเพื่อช่วยแก้ไขปัญหา
    if (error.message.includes('invalid_grant')) {
      console.error('คำแนะนำ: ตรวจสอบว่าได้แชร์ Google Doc ให้กับ Service Account แล้วหรือไม่');
    }
    
    throw error;
  }
}

module.exports = { authorize };
authorize();