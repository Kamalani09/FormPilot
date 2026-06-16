// instructionParser.js
const { generateText } = require('ai');
const { groq } = require('@ai-sdk/groq');

async function parseInstruction(userMessage, currentFields) {
  const { text } = await generateText({
    model: groq('llama-3.3-70b-versatile'),
    prompt: `The user gave this instruction while a form fill is paused: "${userMessage}"

Current form fields and their values:
${JSON.stringify(currentFields, null, 2)}

Return ONLY a JSON array of overrides like: [{"fieldLabel": "Email", "newValue": "personal@gmail.com"}]
A single message may affect multiple fields. If user says skip, set newValue to "SKIP".
Return ONLY JSON, no explanation, no markdown.`,
  });

  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

module.exports = { parseInstruction };
