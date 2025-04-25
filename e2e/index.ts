import puppeteer, {Page} from 'puppeteer';

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
    if (text?.includes('Continue')) {
      await btn.click();
      break;
    }
  }
  console.log('Confirmed sign-in by clicking the Continue button.');
}

const validatePrice = async (page: Page): Promise<void> => {
  await page.waitForSelector('.grid', { timeout: 60000 });
  console.log('Properties loaded successfully!');

  // for some reason there are two exactly the same buttons on the page, and only one is visible and clickable.
  // for production usage must be a dedicated selector.
  const filterBtnSelector = 'button.bg-gray-100.text-black.py-3.px-6.rounded-lg.flex.items-center.justify-center.shadow-md';
  const filterButtons = await page.$$(filterBtnSelector)
  await filterButtons[1]?.click();

  const minPriceSelector = 'input[placeholder="Min"]';
  await page.waitForSelector(minPriceSelector);
  await page.type(minPriceSelector, '1000000');

  // primary buttons like 'Apply' action must have unique selector
  const buttons = await page.$$('button.bg-gray-100');
  for (let button of buttons) {
    const text = await page.evaluate(button => button?.querySelector('span')?.textContent?.trim(), button);
    if (text === 'Apply') {
      await button.click();
      console.log('"Apply" button clicked.');
      break;
    }
  }

  // wait for the properties to reload after setting the min price filter
  await new Promise(resolve => setTimeout(resolve, 7000));

  // price should have its own selector
  const priceSelectors = await page.$$eval('div.p-4 p.text-xl.font-bold.text-gray-900', priceElements => {
    return priceElements.map(el => el?.textContent?.trim());
  });

  const prices = priceSelectors.map(el => el?.replace(/[^\d]/g, '') || '')

  console.log('Prices:', prices);

  // this code works only with items, which are currently visible on the screen. As application has lazy loading, production solution should be different
  let allPricesValid = true;

  for (const priceStr of prices) {
    const price = parseInt(priceStr, 10);
    if (price > 1000000) {
      console.error(`❌ Property with price over 1M AED found: ${price}`);
      allPricesValid = false;
    } else {
      console.log(`✅ Property with price ${price} AED passed filter`);
    }
  }

  if (allPricesValid) {
    console.log('All properties are within the 1M AED price filter.');
  } else {
    console.log('Some properties exceed the 1M AED price filter.');
  }
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
