// すべての外部リンクに target="_blank" rel="noopener" を付与
document.addEventListener("DOMContentLoaded", function() {
  const links = document.querySelectorAll('a[href^="http"]');
  links.forEach(function(link) {
    // 自サイトへのリンクは除外
    if (!link.href.startsWith(location.origin)) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
    }
  });
});

// 画像モーダル
document.addEventListener("DOMContentLoaded", function() {
  // article内すべてのimg
  document.querySelectorAll("article img").forEach(function(img) {
    function enableZoomIfShrinked() {
      // 実画像サイズより縮小されて表示されているなら
      if (img.offsetWidth < img.naturalWidth - 2) {
        img.setAttribute("data-zoomable", "1");
        img.title = "クリックで拡大";
        // clickイベントは何度も付与してもOK
        img.onclick = function(e) {
          openImgModal(img.src);
        };
      } else {
        img.removeAttribute("data-zoomable");
        img.onclick = null;
      }
    }
    // 読み込み直後も画面リサイズ時も判定
    if (img.complete) enableZoomIfShrinked();
    else img.addEventListener('load', enableZoomIfShrinked);
    window.addEventListener('resize', enableZoomIfShrinked);
  });

  // モーダル生成
  function openImgModal(src) {
    // すでに開いてたら一度削除
    let old = document.querySelector('.img-modal-overlay');
    if (old) old.remove();
    const modal = document.createElement("div");
    modal.className = "img-modal-overlay";
    modal.innerHTML = `<img src="${src}">`;
    modal.addEventListener("click", function(ev) {
      if (ev.target === modal || ev.target === modal.querySelector('img')) {
        document.body.removeChild(modal);
      }
    });
    document.body.appendChild(modal);
  }
});

// HERO用組み換え
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  // 画像だけ取り出して .hero-image で包む
  const img = hero.querySelector('img');
  if (img) {
    // 既存の親ごと.remove()（pやspanも消える）
    img.closest('p') ? img.closest('p').remove() : img.remove();

    // .hero-image作成＆画像挿入
    const imgBox = document.createElement('div');
    imgBox.className = 'hero-image';
    imgBox.appendChild(img);
    hero.prepend(imgBox);
  }

  // 残りの要素を全てまとめて .hero-content に包む
  const contentBox = document.createElement('div');
  contentBox.className = 'hero-content';

  // 画像以外のすべての要素をheroから一時的に取り出し
  while (hero.children.length > 1) {
    contentBox.appendChild(hero.children[1]);
  }
  hero.appendChild(contentBox);
});

// ナビゲーション
document.addEventListener('DOMContentLoaded', () => {
  // 設定
  const articleSelector = 'main'; // h2探す範囲。必要に応じて調整
  const menuTitle = ''; // 目次上部にタイトルを付けたい場合

  // h2→id付与 & 目次リスト生成
  const h2s = Array.from(document.querySelectorAll(`${articleSelector} h2`));
  if (!h2s.length) return;

  // slugify: 日本語含むh2→id安全変換
  const slugify = s => s.trim()
    .replace(/[ 　]/g, '-')             // スペース→-
    .replace(/[^\w\-一-龠ぁ-んァ-ヴー]/g, '') // 記号除去
    .replace(/-{2,}/g, '-')             // --→-
    .replace(/^-|-$/g, '')              // 先頭末尾-
    .toLowerCase();

  const menuList = [];
  h2s.forEach(h2 => {
    let txt = h2.textContent || h2.innerText;
    let id = slugify(txt);
    let uniqueId = id, i = 2;
    while (document.getElementById(uniqueId)) uniqueId = id + '-' + i++;
    h2.id = uniqueId;
    menuList.push({ text: txt, id: uniqueId });
  });

  // サイド用ナビを生成（PC時のみ表示）
  const sideNav = document.createElement('aside');
  sideNav.className = 'page-nav-side';
  sideNav.innerHTML = `
    <ul>
      <li><a href="#top">ページトップ</a></li>
      ${menuList.map(item => `<li><a href="#${item.id}">${item.text}</a></li>`).join('')}
      <li><a href="/">サイトホーム</a></li>
    </ul>
  `;
  document.querySelector('.container').append(sideNav);

  // モーダル式メニューHTMLを生成・挿入
  const nav = document.createElement('nav');
  nav.className = 'page-nav';
  nav.innerHTML = `
    <button class="menu-toggle" aria-label="メニュー">
      <span></span><span></span><span></span>
    </button>
    <div class="menu-modal">
      <div class="modal-content">
        ${menuTitle ? `<div class="modal-title">${menuTitle}</div>` : ''}
        <ul>
          <li><a href="#top">ページトップ</a></li>
          ${menuList.map(item => `<li><a href="#${item.id}">${item.text}</a></li>`).join('')}
          <li><a href="/">サイトホーム</a></li>
        </ul>
      </div>
    </div>
  `;
  document.body.appendChild(nav);

  const toggleBtn = nav.querySelector('.menu-toggle');
  const modal = nav.querySelector('.menu-modal');
  const ul = nav.querySelector('ul');

  // モーダル開閉
  toggleBtn.addEventListener('click', () => {
    modal.classList.toggle('open');
    toggleBtn.classList.toggle('open');
    document.body.style.overflow = modal.classList.contains('open') ? 'hidden' : '';
  });

  // モーダル外クリックで閉じる
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('open');
      toggleBtn.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // メニュー項目クリックで閉じる
  ul.addEventListener('click', e => {
    if (e.target.tagName === 'A') {
      modal.classList.remove('open');
      toggleBtn.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // アクティブハイライト
  const menuLinks = Array.from(document.querySelectorAll('.page-nav-side li a'));
  const headings = menuLinks.map(a => document.getElementById(a.getAttribute('href').slice(1)));
  const offset = 80; // ヘッダー高さ等
  function highlightActiveHeading() {
    let index = 0;
    const scrollY = window.scrollY || window.pageYOffset;
    for (let i = 0; i < headings.length; i++) {
      if (headings[i]) {
        const top = headings[i].getBoundingClientRect().top + scrollY - offset;
        if (scrollY >= top) {
          index = i;
        }
      }
    }
    menuLinks.forEach((a, i) => {
      if (i === index) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }
  window.addEventListener('scroll', highlightActiveHeading, { passive: true });
  window.addEventListener('resize', highlightActiveHeading);
  document.addEventListener('DOMContentLoaded', highlightActiveHeading);
});
