const fs = require('fs');
const { google } = require('googleapis');
const path = require('path');
const { JWT } = require('google-auth-library');

// โหลด credentials
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

const SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
];

const auth = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });
const docs = google.docs({ version: 'v1', auth });
const sheets = google.sheets({ version: 'v4', auth });

// ดึงข้อความจาก Google Doc
async function getTextFromGoogleDoc(docId) {
    try {
        const res = await docs.documents.get({ documentId: docId });
        const content = res.data.body.content || [];
        return content
            .map(el => el.paragraph?.elements?.map(e => e.textRun?.content).join('') || '')
            .join('\n');
    } catch (err) {
        console.error(`❌ อ่าน Google Doc ${docId} ล้มเหลว:`, err.message);
        return `Error reading document: ${err.message}`;
    }
}

// ดึงข้อความจาก Google Sheet
async function getTextFromGoogleSheet(fileId) {
    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: fileId,
            range: 'A1:Z1000',
        });
        const rows = res.data.values || [];
        return rows.map(row => row.join('\t')).join('\n');
    } catch (err) {
        console.error(`❌ อ่าน Google Sheet ${fileId} ล้มเหลว:`, err.message);
        return `Error reading spreadsheet: ${err.message}`;
    }
}

// รวมทุกไฟล์จาก Google Drive
async function getAllDriveTexts() {
    const results = [];

    try {
        const res = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.google-apps.spreadsheet'",
            fields: 'files(id, name, mimeType)',
            pageSize: 20, // ปรับจำนวนไฟล์ที่ต้องการอ่าน
        });

        for (const file of res.data.files) {
            try {
                let text = '';
                if (file.mimeType.includes('document')) {
                    text = await getTextFromGoogleDoc(file.id);
                } else if (file.mimeType.includes('spreadsheet')) {
                    text = await getTextFromGoogleSheet(file.id);
                }

                results.push(`📄 ${file.name}\n${text}`);
            } catch (err) {
                console.error(`❌ อ่านไฟล์ ${file.name} ล้มเหลว:`, err.message);
                results.push(`📄 ${file.name}\nError: ${err.message}`);
            }
        }

        // Always return a string, never throw
        return results.length > 0 ? results.join('\n---\n') : 'No files found or accessible.';
        
    } catch (err) {
        console.error("❌ ดึงข้อมูลจาก Google Drive ล้มเหลว:", err.message);
        // Return error message as string instead of throwing
        return `Error accessing Google Drive: ${err.message}`;
    }
}

module.exports = { getAllDriveTexts };