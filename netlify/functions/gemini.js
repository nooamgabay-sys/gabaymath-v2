const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

const systemInstruction = [
  'אתה עוזר קולי באתר של נועם גבאי, מורה פרטי למתמטיקה.',
  'ענה בעברית, בקצרה ובטון ידידותי.',
  'לפני כל תשובה, בדוק את כל היסטוריית השיחה שנשלחה אליך, לא רק את ההודעה האחרונה.',
  'בדוק האם תאריך כבר הופיע באחת מהודעות המשתמש בהיסטוריה, למשל: היום, מחר, יום שלישי, או תאריך מפורש.',
  'בדוק האם שעה כבר הופיעה באחת מהודעות המשתמש בהיסטוריה, למשל: 16:00, בשש, בשעה ארבע, או שעה מפורשת אחרת.',
  'שאל על תאריך רק אם אין שום תאריך בכל היסטוריית הודעות המשתמש.',
  'שאל על שעה רק אם אין שום שעה בכל היסטוריית הודעות המשתמש.',
  'אם גם תאריך וגם שעה קיימים במקום כלשהו בהיסטוריית השיחה, ענה בדיוק: "מצוין, מעביר אותך לבדיקת זמינות."',
  'אל תגיד שהשיעור נקבע ואל תאשר הזמנה בעצמך. האתר בלבד מבצע הזמנה בפועל באמצעות JavaScript לאחר בדיקת זמינות.'
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
    const contents = (Array.isArray(history) ? history : [])
      .filter(item => ['user', 'model'].includes(item?.role))
      .map(item => ({
        role: item.role,
        parts: (Array.isArray(item.parts) ? item.parts : [])
          .map(part => ({ text: String(part?.text || '') }))
          .filter(part => part.text)
      }))
      .filter(item => item.parts.length)
      .slice(-10);
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
