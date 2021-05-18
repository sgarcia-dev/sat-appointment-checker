const consola = require('consola');
const cron = require('node-cron');

const checkSat = require('./sat');

(async () => {
  await checkModules()
  consola.info({
    message: 'Scheduling cron job 30 minutes from now',
    badge: true
  })
  cron.schedule('*/30 * * * *', async () => {
    console.log('------------------------------------')
    consola.info({
      message: 'New cron job starting ...',
      badge: true,
    })
    console.log('------------------------------------')
    await checkModules()
    consola.info('Cron job done, sleeping for 30 minutes ...')
  });
})()

async function checkModules() {
  await checkSat(1).catch(consola.error)
  await checkSat(2).catch(consola.error)
  await checkSat(3).catch(consola.error)
}