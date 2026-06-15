// instructionParser.js
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function parseInstruction(userMessage, currentFields) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: `The user gave this instruction while a form fill is paused: "${userMessage}"

Current form fields and their values:
${JSON.stringify(currentFields, null, 2)}

Return ONLY a JSON array of overrides like: [{"fieldLabel": "Email", "newValue": "personal@gmail.com"}]
A single message may affect multiple fields. If user says skip, set newValue to "SKIP".
Return ONLY JSON, no explanation, no markdown.`
      }
    ],
  });

  const text = response.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { parseInstruction };