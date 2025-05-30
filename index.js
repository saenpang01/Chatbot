require('dotenv').config();
const express = require('express');
const line = require('@line/bot-sdk');
const { handleMessage } = require('./line-handler'); // ✅ Import handleMessage

const app = express();
const PORT = process.env.PORT || 3000;

const config = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN, // ✅ แก้ชื่อตัวแปร
    channelSecret: process.env.LINE_CHANNEL_SECRET // ✅ แก้ชื่อตัวแปร
};

console.log('🚀 Starting server...');
console.log('Environment variables check:');
console.log('- PORT:', PORT);
console.log('- LINE_CHANNEL_ACCESS_TOKEN exists:', !!process.env.LINE_CHANNEL_ACCESS_TOKEN);
console.log('- LINE_CHANNEL_SECRET exists:', !!process.env.LINE_CHANNEL_SECRET);
console.log('- GEMINI_API_KEY exists:', !!process.env.GEMINI_API_KEY);

app.get('/', (req, res) => {
    res.send('LINE Bot Server is running! 🤖');
});

// LINE Webhook endpoint
app.post('/webhook', line.middleware(config), (req, res) => { // ✅ แก้ไข middleware
    console.log('\n🔔 Webhook received');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const events = req.body.events;
    console.log('Number of events:', events?.length || 0);

    if (!events || events.length === 0) {
        console.log('ℹ️ No events to process');
        return res.status(200).send('OK');
    }

    // ประมวลผล events ทั้งหมด
    Promise.all(events.map(event => {
        console.log('\n📋 Processing event:', event.type);
        return handleMessage(event);
    }))
    .then((results) => {
        console.log('✅ All events processed successfully');
        console.log('Results:', results);
        res.status(200).send('OK');
    })
    .catch((error) => {
        console.error('❌ Error processing events:', error);
        res.status(500).send('Internal Server Error');
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('❌ Express error:', error);
    res.status(500).send('Something went wrong!');
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server is running on port ${PORT}`);
    console.log(`📡 Webhook URL: http://localhost:${PORT}/webhook`);
});

// Handle process termination
process.on('SIGTERM', () => {
    console.log('👋 Server shutting down...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});