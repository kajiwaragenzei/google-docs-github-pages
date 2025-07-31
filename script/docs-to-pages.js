const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

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

// heading下げ
function shiftHeadingLevelsHtml(html, n = 1) {
  const $ = cheerio.load(html);
  // h1～h6まで
  for (let i = 6; i >= 1; i--) {
    const from = `h${i}`;
    let to = i + n;
    if (to > 6) to = 6; // h7はh6に
    const toTag = `h${to}`;
    $(from).each(function () {
      $(this).replaceWith(function () {
        // 属性・内容を維持したままタグ名だけ変える
        return $('<' + toTag + '/>').html($(this).html()).attr($(this).attr());
      });
    });
  }
  return $.html();
}

// 余計な属性削除
function stripAttributesFromHtml(html, keepAttrs = ['src', 'href', 'alt']) {
  const $ = cheerio.load(html);
  $('*').each(function () {
    const oldAttrs = this.attribs;
    for (const attr in oldAttrs) {
      if (!keepAttrs.includes(attr)) {
        $(this).removeAttr(attr);
      }
    }
  });
  return $.html();
}

// Googleリダイレクトリンクから修正
function fixGoogleRedirectLinks(html) {
  const $ = cheerio.load(html);
  $('a[href^="https://www.google.com/url?"]').each(function () {
    const href = $(this).attr('href');
    // q= の値を抽出
    const qMatch = href.match(/[?&]q=([^&]+)/);
    if (qMatch) {
      const decoded = decodeURIComponent(qMatch[1]);
      $(this).attr('href', decoded);
    }
  });
  return $.html();
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

async function fetchDocsBody(docId) {
  const url = `https://docs.google.com/document/d/${docId}/export?format=html`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);
  return $('body').html() || '';
}

async function main() {
  const templatesDir = 'template';
  const templates = getAllTemplates(templatesDir);
  const validFiles = templates.map(tpl => templatePathToOutputPath(tpl));
  const validFilesSet = new Set(validFiles);
  const docIdMap = JSON.parse(process.env.DOC_IDS_JSON);
  cleanOutputDir('public', validFilesSet);

  for (const tpl of templates) {
    const tplFullPath = path.join(templatesDir, tpl);
    if (!fs.existsSync(tplFullPath)) continue;
    let html = fs.readFileSync(tplFullPath, 'utf8');
    html = applyIncludes(html);

    // Google Docs差し込み
    const docKeyMatches = [...html.matchAll(/<!--\s*docKey:\s*([a-zA-Z0-9_-]+)\s*-->/g)];
    for (const m of docKeyMatches) {
      const key = m[1];
      const docId = docIdMap[key];
      let docsBody = '';
      if (docId) {
        try {
          docsBody = await fetchDocsBody(docId);
          docsBody = shiftHeadingLevelsHtml(docsBody);
          docsBody = stripAttributesFromHtml(docsBody);
          docsBody = fixGoogleRedirectLinks(docsBody);
        } catch (e) {
          console.warn(`Docs fetch failed: ${docId} (${e.message})`);
          docsBody = '';
        }
      }
      html = html.replace(m[0], docsBody);
    }

    const outPath = path.join('public', templatePathToOutputPath(tpl));
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, 'utf8');
    console.log(`Generated: ${outPath}`);
  }

  // アセットコピー
  fs.cpSync('asset/css', 'public/css', { recursive: true });
  fs.cpSync('asset/js', 'public/js', { recursive: true });
  fs.cpSync('asset/img', 'public/img', { recursive: true });
}

main();
