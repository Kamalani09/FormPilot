// formScraper.js
const { chromium } = require('playwright');

async function scrapeFormFields(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  // Get all input, select, textarea elements with their labels
  const fields = await page.evaluate(() => {
    const results = [];
    const inputs = document.querySelectorAll('input, select, textarea');

    inputs.forEach(el => {
      const id = el.id;
      let label = '';

      // Try to find label by "for" attribute
      if (id) {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) label = lbl.innerText.trim();
      }

      // Fallback: closest parent label text
      if (!label) {
        const parent = el.closest('label');
        if (parent) label = parent.innerText.trim();
      }

      // Fallback: placeholder
      if (!label && el.placeholder) label = el.placeholder;

      const options = [];
      if (el.tagName === 'SELECT') {
        el.querySelectorAll('option').forEach(o => {
          if (o.value) options.push(o.text.trim());
        });
      }

      results.push({
        label: label || 'unknown',
        type: el.type || el.tagName.toLowerCase(),
        name: el.name,
        id: el.id,
        options,
      });
    });

    return results;
  });

  await browser.close();
  return fields;
}

module.exports = { scrapeFormFields };