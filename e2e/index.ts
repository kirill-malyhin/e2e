import puppeteer, { Page, Browser } from 'puppeteer';

// Define constants
const APPLICATION_URL: string = 'https://app.refty.ai/';
const ACCOUNT_EMAIL: string = 'refty.e2e.test@gmail.com';

// Helper function to retrieve the Google password from command-line arguments
const getGooglePassword = (): string => {
  const args = process.argv.slice(2);
  const passwordArg = args.find(arg => arg.startsWith('googlePassword='));
  return passwordArg ? passwordArg.split('=')[1] : '';
}

const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Define the login process
const googleLogin = async (page: Page): Promise<void> => {
  await page.waitForSelector('button', { visible: true });

  const buttons = await page.$$('button');
  const continueButton = buttons.find(async (btn) => {
    const text = await page.evaluate(el => el.textContent, btn);
    return text?.includes('Continue with Google');
  });
  if (continueButton) {
    await continueButton.click();
  }

  // Step 3: Handle Google login (login credentials)
  console.log(`Logging in with ${ACCOUNT_EMAIL}...`);
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Wait for email field and enter username
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
};

// Validate the price filter and check properties
const validatePrice = async (page: Page): Promise<void> => {
  await page.waitForSelector('.grid', { timeout: 60000 });
  await waitMs(5000)
  console.log('Properties loaded successfully!');

  // for some reason there are two exactly the same buttons on the page, and only one is visible and clickable.
  // for production usage must be a dedicated selector.
  const filterBtnSelector = 'button.bg-gray-100.text-black.py-3.px-6.rounded-lg.flex.items-center.justify-center.shadow-md';
  const filterButtons = await page.$$(filterBtnSelector);
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

  // Wait for properties to reload after filter is applied
  await waitMs(7000)

  // price should have its own selector
  const priceSelectors = await page.$$eval('div.p-4 p.text-xl.font-bold.text-gray-900', priceElements => {
    return priceElements.map(el => el.textContent?.trim());
  });

  const prices = priceSelectors.map(price => price?.replace(/[^\d]/g, '') || '');
  console.log('Prices:', prices);

  // task: Set min price 1M AED and verify that properties do not have prices over
  // this code works only with items, which are currently visible on the screen. As application has lazy loading, production solution should be different
  let allPricesValid = true;

  for (const priceStr of prices) {
    const price = parseInt(priceStr, 10);
    if (price === 1000000) {
      console.log(`✅ Property with price ${price} AED passed filter`);
    } else {
      console.error(`❌ Property with price not equal to 1M AED found: ${price}`);
      allPricesValid = false;
    }
  }

  if (allPricesValid) {
    console.log('All properties are equal to 1M AED price filter.');
  } else {
    console.log('Some properties not equal to 1M AED price filter.');
  }
};

// Main function to launch browser and perform the automation
const main = async (): Promise<void> => {
  // Launch browser in non-headless mode
  const browser: Browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized'],
  });

  const page: Page = await browser.newPage();

  await page.goto(APPLICATION_URL, { waitUntil: 'networkidle2' });

  await googleLogin(page);
  await validatePrice(page);

  await browser.close();
};

// Run the main function
main().catch(error => {
  console.error('Error during automation:', error);
  process.exit(1);
});
