import express from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import puppeteer from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import * as middlewares from './middlewares';
import api from './api';

require('dotenv').config();

const app = express();

app.use(morgan('dev'));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-eval'"],
      'object-src': ["'self'"]
    }
  }
}));
app.use(cors());
app.use(express.json());

interface IndexDetail {
  name: string,
  tag: string
}

const fetchDataByIndexName = async (item: IndexDetail) => {
  const puppeteerOptions = {
    headless: true, // or false depending on your preference
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  };

  puppeteerExtra.use(StealthPlugin());
  const browser = await puppeteerExtra.launch(puppeteerOptions);

  try {
    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${item.tag}`, { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('[jsname="vWLAgc"]');

    const data = await page.evaluate(() => {
      const currentPrice = document.querySelector('[jsname="vWLAgc"]');
      const prevDayChange = document.querySelector('[jsname="qRSVye"]');
      const prevDayChangePercent = document.querySelector('[jsname="rfaVEf"]');
      return {
        currentPrice: currentPrice ? currentPrice.textContent?.trim() : 'Not found',
        prevDayChange: prevDayChange ? prevDayChange.textContent?.trim() : 'Not found',
        prevDayChangePercent: prevDayChangePercent ? prevDayChangePercent.textContent?.trim() : 'Not found'
      };
    });

    return {
      name: item.name,
      ...data
    };
  } catch (error) {
    console.error('Error fetching data:', error);
    return 'Error';
  } finally {
    await browser.close();
  }
};

const basicDomesticIndexes = async () => {
  const indicesName: IndexDetail[] = [
    { name: 'Nifty 50', tag: 'nifty+50' },
    { name: 'Nifty Bank', tag: 'nifty+bank' },
    { name: 'Nifty Metal', tag: 'nifty+metal' },
    { name: 'Sensex', tag: 'sensex' },
    { name: 'Nifty IT', tag: 'nifty+It' },
    { name: 'India Vix', tag: 'india+vix' },
    { name: 'Nifty Fin', tag: 'nifty+financial+services' }
  ];

  const allIndexes: any[] = [];

  for (const item of indicesName) {
    const data: any = await fetchDataByIndexName(item);
    allIndexes.push(data);
  }

  return allIndexes;
};

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
