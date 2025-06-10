function classifyMessage(text) {
  const lower = text.toLowerCase().trim();

  const greetings = ['สวัสดี', 'hello', 'hi', 'ดีจ้า', 'ทักทาย'];
  const helpWords = ['ทำอะไรได้', 'ช่วยอะไร', 'ใช้งานยังไง', 'แนะนำ'];
  const questionMarkers = ['?', 'อะไร', 'เท่าไร', 'กี่คน', 'มีกี่', 'ข้อมูล', 'นโยบาย', 'เขต'];

  const isGreeting = greetings.some(g => lower.startsWith(g));
  const isHelp = helpWords.some(h => lower.includes(h));
  const isQuestion = questionMarkers.some(q => lower.includes(q)) || lower.endsWith('?');

  if (isGreeting) return 'greeting';
  if (isHelp) return 'help';
  if (isQuestion) return 'question';

  return 'unknown';
}

module.exports = { classifyMessage };