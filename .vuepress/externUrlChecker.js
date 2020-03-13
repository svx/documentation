const { load: cheerioLoad } = require('cheerio')
const chalk = require('chalk');
const fs = require('fs');
const axios = require('axios');
const local = (process.env.LOCAL)? true : false;
const { links: externalLinks, hostname } = require(`${process.cwd()}/.checklinkconfig.json`)

var parseString = require('xml2js').parseString;

function isAlive(docURL) {
  console.log(chalk.green(`${chalk.blue.underline.bold(docURL)} is alive!`));
}

function isDead(baseURL, docURL, status) {
  console.log(chalk.red(`${chalk.blue.underline.bold(docURL)} in ${chalk.blue.underline.bold(baseURL)} is dead - ${status}`));
}

function ParseStringSync(input) {
  return new Promise(function(resolve, reject) {
      parseString(input, function (err, result) {
        if (err) reject(err)
        resolve(result.urlset.url)
      });
  });
}

async function getSiteMapUrls() {
  try {
    if (local) {
      const siteMap = fs.readFileSync('.vuepress/dist/sitemap.xml', 'utf-8');
      let urls = (await ParseStringSync(siteMap)).map(x => x.loc[0])
      return urls;
    }
  } catch (e) {
    console.log({ ...e , msg: e.message, stack: e.stack});
    console.log(`Could not found ${chalk.blue('sitemap.xml')} please build.`)
  }
}

async function checkexternalLinks ()  {
  let checkedLinks = [];
  let urls = [];
  if (local) urls = await getSiteMapUrls();
  for (let i = 0; i < externalLinks.length; i++) {
    console.log(chalk.magenta(`Checking ${chalk.blue.underline.bold(externalLinks[i])}`));
    let website = await axios.get(externalLinks[i])
    const $ = cheerioLoad(website.data)
    links = Array.from($('a')); //jquery get all hyperlinks
    for (let j = 0; j < links.length; j++) {
        try {
          const myURL = new URL($(links[j]).attr('href'));
          if (myURL.hostname === hostname && !checkedLinks.includes(myURL.href)) {
            try {
              if (local) {
                let urlNoParams = `${myURL.protocol}//${myURL.hostname}${myURL.pathname}`;
                if (urls.includes(urlNoParams)) {
                  isAlive(myURL.href)
                } else {
                  isDead(externalLinks[i], myURL.href, 404)
                }
              }
              else {
                // Check in online documentation
                checkLink = await axios(myURL.href)
                if (checkLink.status !== 200) {
                  isDead(externalLinks[i], myURL.href, checkLink.status)
                } else {
                  checkedLinks.push(myURL.href);
                  isAlive(myURL.href)
                }
              }
            } catch(e) {
              isDead(externalLinks[i], myURL.href, e.response.status)
            }
          }
          else if (checkedLinks.includes(myURL.href)){
            isAlive(myURL.href)
          }
        } catch (e){
          // The URL was not a valid URL
        }
    }
  }
}

module.exports = checkexternalLinks

checkexternalLinks();
