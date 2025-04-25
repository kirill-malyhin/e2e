import puppeteer, { Page } from 'puppeteer';

const APPLICATION_URL: string = 'https://app.refty.ai/';
const ACCOUNT_EMAIL: string = 'refty.e2e.test@gmail.com'

const getGooglePassword = (): string => {
  const args = process.argv.slice(2);
  return args?.find(arg => arg.startsWith('googlePassword='))?.split('=')[1] || '';
}

const googleLogin = async (page: Page): Promise<void> => {
  await page.waitForSelector('button', { visible: true });
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text?.includes('Continue with Google')) {
      await btn.click();
      break;
    }
  }

  // Step 3: Handle Google login (login credentials)
  console.log(`Logging in with ${ACCOUNT_EMAIL}...`);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Wait for the email field and type in the username
  await page.waitForSelector('input[type="email"]', { visible: true });
  await page.type('input[type="email"]', ACCOUNT_EMAIL);
  await page.click('#identifierNext');

  // Wait for the password field and type the password
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', getGooglePassword());
  await page.click('#passwordNext');

  // Step 4: Wait for the "Continue" button on Google
  await page.waitForSelector('button', { visible: true });
  const continueButtons = await page.$$('button');
  for (const btn of continueButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text?.includes("Continue")) {
      await btn.click();
      break;
    }
  }
  console.log('Confirmed sign-in by clicking the Continue button.');
}

const validatePrice = async (page: Page): Promise<void> => {
  await page.waitForSelector('.grid', { timeout: 60000 });
  console.log('Properties loaded successfully!');
}

(async () => {
  // Launch browser in non-headless mode so we can see the test
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page = await browser.newPage();

  await page.goto(APPLICATION_URL, { waitUntil: 'networkidle2' });

  await googleLogin(page)

  await validatePrice(page)

  await browser.close();
})();
