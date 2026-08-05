const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const systemInstruction = [
  'אתה עוזר קולי באתר של נועם גבאי, מורה פרטי למתמטיקה.',
  'ענה בעברית, בקצרה ובטון ידידותי.',
  'בתהליך קביעת שיעור: אם חסר תאריך, בקש רק תאריך. אם חסרה שעה, בקש רק שעה.',
  'אם גם תאריך וגם שעה כבר סופקו, אל תגיד שהשיעור נקבע ואל תאשר הזמנה בעצמך.',
  'האתר בלבד מבצע הזמנה בפועל באמצעות JavaScript לאחר בדיקת זמינות.',
  'מותר לך להסביר שהמערכת בודקת זמינות או להעביר להשלמת רישום, אבל אסור לטעון שקבעת שיעור.'
].join('\n');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { Allow: 'POST' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing GEMINI_API_KEY' })
    };
  }

  try {
    const { history = [] } = JSON.parse(event.body || '{}');
    const contents = Array.isArray(history) ? history : [];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Gemini request failed' })
      };
    }

    const answer = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim() || 'לא הצלחתי לענות כרגע. נסו שוב בעוד רגע.';

    return {
      statusCode: 200,
      body: JSON.stringify({ answer })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || 'Server error' })
    };
  }
};
