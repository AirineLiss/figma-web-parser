// parse-tokens.js
import fs from 'fs';
import path from 'path';
import { Client } from 'figma-js';

// получить из env FIGMA_TOKEN, FILE_KEY и ARTBOARD_NODE_ID
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.env.FILE_KEY; 
const ARTBOARD_ID = process.env.ARTBOARD_NODE_ID;

if (!FIGMA_TOKEN || !FILE_KEY || !ARTBOARD_ID) {
  console.error('Не забудьте задать FIGMA_TOKEN, FILE_KEY и ARTBOARD_NODE_ID');
  process.exit(1);
}

const client = Client({ personalAccessToken: FIGMA_TOKEN });

// утилита: snake_case → camelCase
function toCamel(s) {
  return s.replace(/_([a-z])/g, (_, g1) => g1.toUpperCase());
}

// утилита: заменить единицы измерения
function convertUnits(val, from, to) {
  return val.replace(new RegExp(from + '\\b', 'g'), to);
}

async function run() {
  // запросить узел-артборд
  const { data } = await client.fileNodes(FILE_KEY, { ids: [ARTBOARD_ID] });
  const artboard = data.nodes[ARTBOARD_ID].document;
  
  // считаем, что каждая directChild — это строка таблицы (Frame/Group)
  const rows = artboard.children;

  // первая строка — заголовок, пропускаем
  const dataRows = rows.slice(1);

  const tokens = dataRows.map(row => {
    // у строки найти все текстовые ноды
    const texts = row.children.filter(n => n.type === 'TEXT');
    // отсортировать по координате X
    texts.sort((a, b) => a.absoluteBoundingBox.x - b.absoluteBoundingBox.x);
    const alias = texts[0].characters.trim();
    const value = texts[1].characters.trim();
    return { alias, value };
  });

  // сборка трех вариантов
  const web = {};
  const ios = {};
  const android = {};

  tokens.forEach(({ alias, value }) => {
    web[ alias ] = value; 

    const cam = toCamel(alias);
    ios[ cam ] = convertUnits(value, 'px', 'pt');
    android[ cam ] = convertUnits(value, 'px', 'dp');
  });

  // записать файлы
  fs.writeFileSync(path.resolve('tokens.web.json'), JSON.stringify(web, null, 2));
  fs.writeFileSync(path.resolve('tokens.ios.json'), JSON.stringify(ios, null, 2));
  fs.writeFileSync(path.resolve('tokens.android.json'), JSON.stringify(android, null, 2));

  console.log('Готово: tokens.web.json, tokens.ios.json, tokens.android.json');
}

run().catch(err => {
  console.error('Ошибка:', err);
  process.exit(1);
});