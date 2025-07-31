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
