require('dotenv').config();
const { Client } = require('@notionhq/client');
const fs = require('fs');
const path = require('path');
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;
const { NotionToMarkdown } = require("notion-to-md");
const mdIt = require("markdown-it")();
const n2m = new NotionToMarkdown({ notionClient: notion });

// Notionページ本文取得
async function getPageBlocks(pageId) {
  const blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...response.results);
    cursor = response.next_cursor;
  } while (cursor);
  return blocks;
}

// テンプレートディレクトリから .html ファイル一覧を再帰取得
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

// テンプレート名から出力先パスを決定
function templatePathToOutputPath(templatePath) {
  if (templatePath === 'home.html') return 'index.html';
  return templatePath.replace(/\.html$/, '/index.html');
}

// publicディレクトリの不要ファイル削除
function cleanOutputDir(baseDir, validFilesSet) {
  if (!fs.existsSync(baseDir)) return;
  const alwaysKeepFiles = new Set(['CNAME', 'README.md', '.nojekyll']); // ←追加
  for (const file of fs.readdirSync(baseDir)) {
    const fullPath = path.join(baseDir, file);
    const relPath = path.relative('public', fullPath);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanOutputDir(fullPath, validFilesSet);
      if (fs.readdirSync(fullPath).length === 0) {
        fs.rmdirSync(fullPath);
      }
    } else {
      // validFilesSet か alwaysKeepFiles に含まれたら消さない！
      if (!validFilesSet.has(relPath) && !alwaysKeepFiles.has(relPath)) {
        fs.unlinkSync(fullPath);
        console.log(`Deleted old file: ${relPath}`);
      }
    }
  }
}

// 共通パーツ読み込み（再帰的）
function applyIncludes(html, commonDir = 'template_common', depth = 0) {
  if (depth > 10) throw new Error('Include loop detected!');
  return html.replace(/\$\{include:([^\}]+)\}/g, (match, filename) => {
    const filePath = path.join(commonDir, filename);
    if (!fs.existsSync(filePath)) {
      console.warn(`Include not found: ${filePath}`);
      return '';
    }
    const part = fs.readFileSync(filePath, 'utf8');
    // 再帰的にさらにインクルードを解決
    return applyIncludes(part, commonDir, depth + 1);
  });
}

// headingタグのレベルを下げる
function shiftHeadingLevels(markdown) {
  return markdown
    .replace(/^##### /gm, '###### ') // heading_5 -> h6
    .replace(/^#### /gm, '##### ')   // heading_4 -> h5
    .replace(/^### /gm, '#### ')     // heading_3 -> h4
    .replace(/^## /gm, '### ')       // heading_2 -> h3
    .replace(/^# /gm, '## ');        // heading_1 -> h2
}


async function main() {
  // 1. Notionページデータを取得
  const dbResponse = await notion.databases.query({ database_id: databaseId });
  const notionPages = {};
  for (const page of dbResponse.results) {
    const title = page.properties.名前.title[0]?.plain_text || "No Title";
    const pageId = page.id;
    notionPages[title] = { pageId, page };
  }

  // 2. テンプレート一覧を取得（ここでファイルが存在するもののみ！）
  const templatesDir = 'template'; // テンプレート用ディレクトリ
  const templates = getAllTemplates(templatesDir);

  // 3. 生成されるべき出力ファイル一覧
  const validFiles = templates.map(tpl => templatePathToOutputPath(tpl));
  const validFilesSet = new Set(validFiles);

  // 4. 不要HTMLファイル削除
  cleanOutputDir('public', validFilesSet);

  // 5. Notion本文キャッシュ
  for (const pageName of Object.keys(notionPages)) {
    if (!notionPages[pageName].body) {
      const mdBlocks = await n2m.pageToMarkdown(notionPages[pageName].pageId);
      const mdStringObj = n2m.toMarkdownString(mdBlocks);
      let markdown = mdStringObj.parent;
      markdown = shiftHeadingLevels(markdown);
      notionPages[pageName].body = mdIt.render(markdown);
    }
  }

  // 6. テンプレートごとに出力
  for (const tpl of templates) {
    const tplFullPath = path.join(templatesDir, tpl);
    if (!fs.existsSync(tplFullPath)) {
      console.warn(`Template not found: ${tplFullPath}`);
      continue;
    }
    let html = fs.readFileSync(tplFullPath, 'utf8');
    html = applyIncludes(html)
    html = html.replace(/\$\{([^}]+)\}/g, (match, pageName) => {
      const entry = notionPages[pageName];
      if (!entry) {
        console.warn(`Warning: Notion page not found for "${pageName}"`);
        return '';
      }
      return entry.body || '';
    });

    const outPath = path.join('public', templatePathToOutputPath(tpl));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Generated: ${outPath}`);
  }

  // 7. アセット転送
  fs.cpSync('asset/css', 'public/css', { recursive: true });
  fs.cpSync('asset/js', 'public/js', { recursive: true });
  fs.cpSync('asset/img', 'public/img', { recursive: true });
}

main();
