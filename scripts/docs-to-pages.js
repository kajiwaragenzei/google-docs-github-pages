const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

// テンプレートディレクトリ再帰取得
function getAllTemplates(dir, prefix = '') {
  let files = [];
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    const relPath = path.join(prefix, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getAllTemplates(fullPath, relPath));
    } else if (file.endsWith('.html')) {
      files.push(relPath);
    }
  }
  return files;
}

// Google Docsの<body>だけ取得
async function fetchDocsBody(docId) {
  try {
    const url = `https://docs.google.com/document/d/${docId}/export?format=html`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch Docs: ${url} [${res.status}]`);
    const html = await res.text();
    const $ = cheerio.load(html);
    return $('body').html() || '';
  } catch (e) {
    console.warn(e.message);
    return ''; // 取得できない場合は空文字を返す
  }
}

// 出力先決定
function templatePathToOutputPath(templatePath) {
  if (templatePath === 'home.html') return 'index.html';
  return templatePath.replace(/\.html$/, '/index.html');
}

// メイン処理
async function main() {
  const templatesDir = 'template';
  const outputDir = 'public';
  const templates = getAllTemplates(templatesDir);

  for (const tpl of templates) {
    const tplPath = path.join(templatesDir, tpl);
    let html = fs.readFileSync(tplPath, 'utf8');

    // <!-- docId: xxx --> 全抽出
    const docIdMatches = [...html.matchAll(/<!--\s*docId:\s*([a-zA-Z0-9_-]+)\s*-->/g)];
    for (const m of docIdMatches) {
      const docId = m[1];
      const docsBody = await fetchDocsBody(docId);
      html = html.replace(m[0], docsBody);
    }

    // 出力先: home.html→index.html, 他は .html→/index.html
    const outPath = path.join(outputDir, templatePathToOutputPath(tpl));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Generated: ${outPath}`);
  }
}

main();
