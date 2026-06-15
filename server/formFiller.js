// formFiller.js
const { chromium } = require('playwright');
const { getSession, emit } = require('./sessionStore');

async function fillForm(url, fillPlan) {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  console.log('>>> Playwright is starting browser now...');

  // Use 'domcontentloaded' instead of 'networkidle' — works on Greenhouse
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Extra wait for JS to render the form
  await page.waitForTimeout(3000);

  console.log('>>> Page loaded, starting to fill fields...');

  for (let i = 0; i < fillPlan.length; i++) {
    const session = getSession();

    // Check if cancelled
    if (session.status === 'cancelled') {
      emit({ type: 'cancelled' });
      await browser.close();
      return;
    }

    // Wait while paused
    while (getSession().status === 'paused') {
      await new Promise(r => setTimeout(r, 500));
    }

    // Check again after unpause
    if (getSession().status === 'cancelled') {
      emit({ type: 'cancelled' });
      await browser.close();
      return;
    }

    let field = { ...fillPlan[i] };

    // Apply override if any
    const override = getSession().overrides[field.fieldLabel];
    if (override) {
      field.value = override;
    }

    // Update status to active
    getSession().fields[i].status = 'active';
    emit({ type: 'field_start', fieldLabel: field.fieldLabel, index: i });

    if (!field.value || field.value === 'SKIP') {
      getSession().fields[i].status = 'skipped';
      emit({ type: 'field_done', fieldLabel: field.fieldLabel, value: 'skipped', index: i });
      emit({ type: 'progress', done: i + 1, total: fillPlan.length });
      continue;
    }

    try {
      let filled = false;

      // Try by id first
      if (field.id) {
        const el = page.locator(`#${field.id}`).first();
        const count = await el.count();

        if (count > 0) {
          const tagName = await el.evaluate(e => e.tagName.toLowerCase());
          const inputType = await el.evaluate(e => e.type || '');

          if (tagName === 'select') {
            await el.selectOption({ label: field.value }).catch(() =>
              el.selectOption(field.value).catch(() => {})
            );
          } else if (inputType === 'file') {
            // skip file uploads silently
          } else if (inputType === 'checkbox' || inputType === 'radio') {
            await el.check().catch(() => {});
          } else {
            await el.fill(String(field.value));
          }
          filled = true;
        }
      }

      // Fallback: try by name
      if (!filled && field.name) {
        const el = page.locator(`[name="${field.name}"]`).first();
        const count = await el.count();

        if (count > 0) {
          const tagName = await el.evaluate(e => e.tagName.toLowerCase());

          if (tagName === 'select') {
            await el.selectOption({ label: field.value }).catch(() =>
              el.selectOption(field.value).catch(() => {})
            );
          } else {
            await el.fill(String(field.value)).catch(() => {});
          }
          filled = true;
        }
      }

      if (!filled) {
        console.log(`>>> Could not find element for field: ${field.fieldLabel}`);
      }

      getSession().fields[i].status = 'done';
      getSession().fields[i].value = field.value;
      emit({ type: 'field_done', fieldLabel: field.fieldLabel, value: field.value, index: i });
      emit({ type: 'progress', done: i + 1, total: fillPlan.length });

      await page.waitForTimeout(700);

    } catch (err) {
      console.error(`>>> Error filling "${field.fieldLabel}":`, err.message);
      getSession().fields[i].status = 'skipped';
      emit({ type: 'field_done', fieldLabel: field.fieldLabel, value: 'error', index: i });
      emit({ type: 'progress', done: i + 1, total: fillPlan.length });
    }
  }

  getSession().status = 'complete';
  emit({ type: 'complete' });
  console.log('>>> Form filling complete! Do NOT submit.');
}

module.exports = { fillForm };