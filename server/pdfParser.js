// pdfParser.js
require('dotenv').config();
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function extractTextFromPDF(pdfBuffer) {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;

  let fullText = '';

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

async function extractProfileFromPDF(pdfBuffer) {
  const resumeText = await extractTextFromPDF(pdfBuffer);

  if (!resumeText || resumeText.trim().length < 50) {
    throw new Error('Could not extract text from PDF. Make sure it is a text-based PDF, not a scanned image.');
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'user',
        content: `You are a resume parser. Extract all details from this resume and return ONLY a valid JSON object with these fields:
firstName, lastName, preferredName, email, personalEmail, phone, city, country,
linkedIn, github, website, currentCompany, currentTitle, noticePeriod,
visaSponsorship, education (array of {school, degree, discipline, year}),
skills (array), projects (array of {name, description}), otherNotes.
If a field is unknown use null. Return ONLY JSON, no explanation, no markdown.

Resume text:
${resumeText}`,
      },
    ],
  });

  const text = response.choices[0].message.content;
  const clean = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch (e) {
    throw new Error('Groq returned invalid JSON. Raw response: ' + text.slice(0, 300));
  }
}

module.exports = { extractProfileFromPDF };