const path = require("path");
const axios = require("axios");
const consola = require('consola');
const nodemailer = require("nodemailer");

module.exports.getCaptcha = async function getCaptcha(base64captcha) {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

  consola.info('Requesting new solve from 2Captcha')
  const res = await axios({
    timeout: 5000,
    method: "POST",
    url: "http://2captcha.com/in.php",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    data: {
      key: process.env.API_KEY_2CAPTCHA,
      method: "base64",
      body: base64captcha,
    },
  });

  if (!res.data.includes("OK")) {
    consola.error("2Captcha could not parse image, see logs");
    consola.info(res.data);
    return null;
  }

  const captchaId = res.data.split("|")[1];
  let captchaResult, captchaReviewed;
  consola.info('Beginning poll to 2Captcha for solution in 20 seconds ...')
  await sleep(20000)
  while (!captchaReviewed) {
    consola.info('Polling 2Captcha for solution ...')
    const res = await axios({
      timeout: 100000,
      method: "GET",
      url: "http://2captcha.com/res.php",
      params: {
        key: process.env.API_KEY_2CAPTCHA,
        action: "get",
        id: captchaId,
      },
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });

    if (res.data === "CAPCHA_NOT_READY") {
      consola.info('2Captcha solution not ready, sleeping 10 seconds ...')
      await sleep(10000)
    } else if (res.data.includes("OK")) {
      captchaReviewed = true;
      captchaResult = res.data.split("|")[1];
      consola.success('Captcha resolved to ', captchaResult)
    } else {
      captchaReviewed = true
      consola.error('Something went wrong reviewing captcha, see logs')
      consola.info(res.data)
    }
  }
  return captchaResult;
}


module.exports.sendMail = function sendMail(args) {
  return new Promise((res, rej) => {
    const { GOOGLE_APP_PASSWORD } = process.env;
    if (!GOOGLE_APP_PASSWORD) return rej(new Error('Did not provide GOOGLE_APP_PASSWORD environemnt variable'));

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "sgarcia.dev@gmail.com",
        pass: GOOGLE_APP_PASSWORD
      }
    });

    transporter.sendMail({
      ...args,
      from: "me@sergeigarcia.xyz",
      to: "sgarcia.dev@gmail.com"
    }, (err, info) => {
      if (err) {
        rej(err);
      }
      res(info);
    });
  });
}