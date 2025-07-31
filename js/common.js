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
