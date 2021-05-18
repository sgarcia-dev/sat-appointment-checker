const path = require("path");
const puppeteer = require("puppeteer");
const consola = require("consola");
require("dotenv").config();
const utils = require("./utils.js");

module.exports = async (moduleKey = 1) => {
  const browser = await puppeteer.launch({
    // headless: false,
    // defaultViewport: null,
    // slowMo: 100,
    defaultViewport: {
      width: 1400,
      height: 1000,
    }
  });

  await checkSatModule(browser, moduleKey)

  consola.info("Closing browser ...");
  await browser.close();
};

async function checkSatModule(browser, moduleKey) {
  try {
    const moduleName =
      moduleKey === 1
        ? "Monterrey"
        : moduleKey === 2
        ? "Guadalupe"
        : "San Pedro";
    consola.info({
      message: "Beginning new sat check for module " + moduleName,
      badge: true,
    });
    const page = await browser.newPage();

    consola.info("Navigating to SAT page");
    await page.goto("https://citas.sat.gob.mx/citasat/agregarcita.aspx");
    consola.info("Selecting tramit options");
    await pageClickByXPath(page, `//*[contains(text(),'Nuevo León')]`);
    const moduleSelector =
      moduleKey === 1
        ? `ADSC Nuevo León "1" Monterrey`
        : moduleKey === 2
        ? `ADSC Nuevo León "2" Guadalupe`
        : `ADSC Nuevo León "3" San Pedro G`;
    await pageClickXPathAndAwaitNetwork(page, `//*[contains(text(),'${moduleSelector}')]`);
    await pageClickXPathAndAwaitNetwork(page, `//*[contains(text(),'e.firma Renovación y Revocación de Personas Físicas')]`); 

    let captchaSolved;
    while (!captchaSolved) {
      await page.click("#ModalMensajeServicio > div > div > div.modal-footer > button");
      consola.info("Beginning captcha solve ...");
      const base64captcha = await page.evaluate('document.querySelector("#captcha").getAttribute("src")');
      const captchaSolution = await utils.getCaptcha(base64captcha);
      if (!captchaSolution) throw new Error("2Captcha crashed for unknown reasons");

      consola.info("Entering found Captcha Solution");
      await page.type("#txtUserInput", captchaSolution); // Type Captcha Result
      await pageClickAndAwaitNetwork(page, "#cmdSiguiente");
      const captchaInvalid = await page.$("#LabelErrorCaptcha");
      if (captchaInvalid) {
        consola.warn({
          message: "Captcha attempt unsuccesful, attempting again ...",
          badge: false
        });
      } else {
        consola.success("Captcha solved succesfully, continuing ...");
        captchaSolved = true;
      }
    }

    consola.info('Filling in user contact information ...')
    await page.type("#TXTNombreContribuyente", process.env.SAT_NOMBRE);
    await pageTypeAndAwaitNetwork(page, "#TXTRFC", process.env.SAT_RFC);
    await pageTypeAndAwaitNetwork(page, "#TXTCorreoElectronico", process.env.SAT_EMAIL);

    const currentMonthHasAppointments = await pageCheckForAvailableAppointments(page)
    await pageClickAndAwaitNetwork(page, "#Calendario > tbody > tr:nth-child(1) > td > table > tbody > tr > td:nth-child(3)");
    const nextMonthHasAppointments = await pageCheckForAvailableAppointments(page)
    
    if (!currentMonthHasAppointments && ! nextMonthHasAppointments) {
      consola.info(`Ending check for ${moduleName} with no available appointments`);
      await page.screenshot({ path: "sat-failed-state.png", fullPage: true });
    }
  } catch (error) {
    consola.error(error)
  }
}

async function pageClickByXPath(page, selector) {
  const elements = await page.$x(selector)
  if (!elements?.[0]) throw new Error('Could not find node with selector ' + selector)
  await elements[0].click() 
}

async function pageClickXPathAndAwaitNetwork(page, xpath) {
  const [response] = await Promise.all([
    page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' }),
    pageClickByXPath(page, xpath),
  ]);
  return response
}

async function pageClickAndAwaitNetwork(page, selector) {
  const [response] = await Promise.all([
    page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' }),
    page.click(selector),
  ]);
  return response
}

async function pageTypeAndAwaitNetwork(page, selector, text) {
  const [response] = await Promise.all([
    page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle0' }),
    page.type(selector, text).then(() => page.click('body')),
  ]);
  return response
}

async function pageCheckForAvailableAppointments(page) {
  const daysWithAvailability = await page.evaluate(`Array.from(document.querySelectorAll('#Calendario td')).filter(el => el.attributes.style.value.split(';').some(rule => rule.includes('background-color') && !rule.toLowerCase().includes('white') && !rule.toUpperCase().includes('F2DEDE')))`);
  
  if (daysWithAvailability?.length) {
    consola.success({ message: 'Found appointments, notifying ... ', badge: true })
    await page.screenshot({ path: "sat.png", fullPage: true });
    await utils.sendMail({
      subject: "SAT PUPPETEER: Availability in " + moduleName,
      html: "See included attachment with availability",
      attachments: [
        {
          filename: "sat.png",
          path: path.resolve(__dirname, "sat.png"),
          cid: "sat",
        },
      ],
    });
    return true
  }
  return false
}