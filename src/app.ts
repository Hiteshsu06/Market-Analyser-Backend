import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
// import puppeteer from 'puppeteer';
import * as middlewares from './middlewares';
import api from './api';
import chromium from 'chrome-aws-lambda';


require('dotenv').config();

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

interface IndexDetail {
  name: string,
  tag: string
}

const fetchDataByIndexName = async (item: IndexDetail) => {
  const browser = await chromium.puppeteer.launch({
    args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: true,
    ignoreHTTPSErrors: true,
  })
  const page = await browser.newPage();

  try {
      // Navigate the page to a URL.
      await page.goto(`https://www.google.com/search?q=${item?.tag}`, { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('[jsname="vWLAgc"]');

      // Extract the inner text of the element with jsname="vWLAgc"
      const data = await page.evaluate((itemName) => {
          const currentPrice = document.querySelector('[jsname="vWLAgc"]');
          const prevDayChange = document.querySelector('[jsname="qRSVye"]');
          const prevDayChangePercent = document.querySelector('[jsname="rfaVEf"]');
          return {
              name: itemName,
              currentPrice: currentPrice ? currentPrice.textContent?.trim() : 'Not found',
              prevDayChange: prevDayChange ? prevDayChange.textContent?.trim() : 'Not found',
              prevDayChangePercent: prevDayChangePercent ? prevDayChangePercent.textContent?.trim() : 'Not found'
          };
      }, item.name); // Pass item.name as an argument

      return data;
  } catch (error) {
      console.error('Error fetching data:', error);
      return 'Error';
  } finally {
      await browser.close();
  }
}


const basicDomesticIndexes = async () => {
  const allindexes: IndexDetail[] = [];
  const indicesName =  [
    {name:'Nifty 50' , tag: 'nifty+50'},
    {name:'Nifty Bank' , tag: 'nifty+bank'},
    {name:'Nifty Metal' , tag: 'nifty+metal'},
    {name:'Sensex' , tag: 'sensex'},
    {name:'Nifty IT' , tag: 'nifty+It'},
    {name:'India Vix' , tag: 'india+vix'},
    {name:'Nifty Fin' , tag: 'nifty+financial+services'}
  ];
  
  for (const item of indicesName) {
      const data: any = await fetchDataByIndexName(item);
      allindexes.push(data);
  }
  
  return allindexes;
}

app.get('/', async (req, res) => {
  try {
      const data = await basicDomesticIndexes();
      res.json({
          data: data,
      });
  } catch (error) {
      console.error('Error in route handler:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
});


app.use('/api/v1', api);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

export default app;
