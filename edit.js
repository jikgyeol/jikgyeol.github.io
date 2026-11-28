/* 직결영어 편집 모드: 주소 뒤에 ?edit 를 붙여 엽니다. 방문자에게는 아무것도 하지 않습니다. */
(function () {
  'use strict';
  var REPO = 'jikgyeol/jikgyeol.github.io', BRANCH = 'main', API = 'https://api.github.com/repos/' + REPO + '/contents/';

  /* 저장할 때 HTML을 사람이 읽기 좋게 줄을 나눕니다 */
  function jkFormat(root) {
    var BLK = /^(div|section|header|footer|main|nav|article|aside|ul|ol|li|table|thead|tbody|tr|td|th|dl|dt|dd|details|summary|figure|figcaption|h1|h2|h3|h4|p|a|img|button|script|style|svg|blockquote|form)$/i;
    function hasText(el) { for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true; return false; }
    function multi(el) {
      var t = el.localName;
      if (t === 'script' || t === 'style' || t === 'svg' || el.namespaceURI === 'http://www.w3.org/2000/svg') return false;
      if (hasText(el)) return false;
      for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (BLK.test(c.localName)) return true;
      return false;
    }
    function one(el, d) {
      var pad = new Array(d + 1).join(' ');
      if (!multi(el)) {
        var s = el.outerHTML;
        if (el.localName !== 'script' && el.localName !== 'style') s = s.replace(/\s*\n\s*/g, ' ');
        return pad + s;
      }
      var out = el.outerHTML, inner = el.innerHTML, close = '</' + el.localName + '>';
      var open = out.slice(0, out.length - inner.length - close.length);
      var lines = [pad + open];
      for (var n = el.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 1) lines.push(one(n, d + 1));
        else if (n.nodeType === 8) lines.push(pad + ' <!--' + n.nodeValue + '-->');
      }
      lines.push(pad + close);
      return lines.join('\n');
    }
    var res = [];
    for (var n = root.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 1) res.push(one(n, 0));
      else if (n.nodeType === 8) res.push('<!--' + n.nodeValue + '-->');
    }
    return res.join('\n');
  }
  window.jkFormat = jkFormat;

  var wantEdit = /[?&]edit(=|&|$)/.test(location.search);
  if (/[?&]edit=off/.test(location.search)) { sessionStorage.removeItem('jkEdit'); return; }
  if (!wantEdit && sessionStorage.getItem('jkEdit') !== '1') return;
  sessionStorage.setItem('jkEdit', '1');

  var FILE = location.pathname.split('/').pop() || 'index.html';
  if (!/\.html$/.test(FILE)) FILE = 'index.html';
  var TXT = 'h1,h2,h3,h4,p,li,dt,dd,td,th,summary,figcaption,blockquote,.eyebrow,.eb2,.eb,.lab,.cap,a.btn,.facts span,.facts b,.cv .t,.cv .a,.rows span,.rows b,.nm,.chip,.kinds i,.kinds b,.tbm-h span,.tbm-r > b,.wb .ar,.wb .tag,.lr i,.step > i,.card .n';
  var MOV = 'main > section,main > .page-hd,.band,.wbs > .wb,.g3 > *,.g4 > *,.steps > .step,.fit li,.qa > details,.tbm-r .c > img,.progs > .prog,.bio > div,.facts > div,.list > li,.tbl tr,.strip > *,.lr,.kinds > *,.grid2 > .card,.grid3 > .card,.chips > .chip,.wb-m > div';
  var dirty = false, pending = [], cur = null, lastLink = null, fileSha = null, ready = false;

  function ui(tag, attrs, html) { var e = document.createElement(tag); e.setAttribute('data-jk-ui', ''); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function inUi(el) { return !!(el && el.closest && el.closest('[data-jk-ui]')); }
  function editable(el) { return !!(el && el.closest && el.closest('main,footer') && !el.closest('[data-noedit],[data-jk-ui]')); }
  function setDirty() { if (!dirty) { dirty = true; status('고친 내용이 있습니다. 저장을 눌러 주세요.'); } }

  var st = document.createElement('style');
  st.textContent = 'body.jk-edit{padding-top:46px}body.jk-edit .hd{top:46px}' +
    '[data-jk-bar]{position:fixed;left:0;right:0;top:0;height:46px;z-index:9999;background:#151B23;color:#fff;display:flex;align-items:center;gap:10px;padding:0 16px;font:14px/1.4 Pretendard,system-ui,sans-serif}' +
    '[data-jk-bar] b{font-weight:600;margin-right:6px}[data-jk-bar] .st{flex:1;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '[data-jk-bar] button,[data-jk-tb] button,[data-jk-dlg] button{font:13.5px Pretendard,system-ui,sans-serif;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;padding:6px 12px;cursor:pointer}' +
    '[data-jk-bar] button.sv{background:#00704F;border-color:#00704F}[data-jk-bar] button:disabled{opacity:.4;cursor:default}' +
    '[data-jk-txt]{outline:1px dashed transparent;outline-offset:3px;transition:outline-color .15s}[data-jk-txt]:hover{outline-color:rgba(0,112,79,.55)}[data-jk-txt]:focus{outline:2px solid #00704F}' +
    'body.jk-edit img{cursor:pointer}body.jk-edit [data-off]{opacity:.3}body.jk-edit .jk-cur{outline:1px solid rgba(0,112,79,.6);outline-offset:4px}' +
    '[data-jk-tb]{position:fixed;z-index:9998;display:none;gap:2px;background:#151B23;padding:3px}[data-jk-tb] button{border:0;padding:5px 9px}[data-jk-tb] button:hover{background:#00704F}' +
    '[data-jk-dlg]{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center}[data-jk-dlg] .bx{background:#fff;color:#151B23;max-width:560px;width:92%;padding:26px 28px;font:15px/1.75 Pretendard,system-ui,sans-serif;max-height:86vh;overflow:auto}' +
    '[data-jk-dlg] h3{font-size:18px;margin:0 0 10px}[data-jk-dlg] ol{padding-left:20px;margin:8px 0}[data-jk-dlg] input{width:100%;font:14px monospace;padding:9px;border:1px solid #bbb;margin:12px 0}[data-jk-dlg] button{color:#151B23;border-color:#151B23;margin-right:6px}[data-jk-dlg] button.p{background:#00704F;border-color:#00704F;color:#fff}[data-jk-dlg] a{color:#00704F;text-decoration:underline}';
  document.head.appendChild(st);
  document.body.classList.add('jk-edit');

  var bar = ui('div', { 'data-jk-bar': '' }, '<b>편집 모드</b><span class="st"></span><button class="lk" disabled>링크 바꾸기</button><button class="hp">도움말</button><button class="sv">저장</button><button class="ex">나가기</button>');
  document.body.appendChild(bar);
  var tb = ui('div', { 'data-jk-tb': '' }, '<button data-a="up">위로</button><button data-a="down">아래로</button><button data-a="dup">복제</button><button data-a="off">숨기기</button><button data-a="del">삭제</button>');
  document.body.appendChild(tb);
  function status(t) { bar.querySelector('.st').textContent = FILE + ' · ' + t; }
  status('글자를 눌러 고치고, 사진을 눌러 바꿉니다.');

  function markText(scope) {
    [].forEach.call((scope || document).querySelectorAll(TXT), function (el) {
      if (!editable(el) || el.querySelector(TXT)) return;
      el.setAttribute('contenteditable', 'true'); el.setAttribute('spellcheck', 'false'); el.setAttribute('data-jk-txt', '');
    });
  }
  markText();

  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('[data-jk-txt]') && e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); setDirty(); }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  });
  document.addEventListener('paste', function (e) {
    if (!(e.target.closest && e.target.closest('[data-jk-txt]'))) return;
    e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); setDirty();
  });
  document.addEventListener('input', function (e) { if (e.target.closest && e.target.closest('[data-jk-txt]')) setDirty(); });
  document.addEventListener('selectionchange', function () {
    var s = document.getSelection(), n = s && s.anchorNode; n = n && (n.nodeType === 1 ? n : n.parentElement);
    var a = n && n.closest && n.closest('a'); if (a && editable(a)) lastLink = a; else if (n && editable(n)) lastLink = null;
    bar.querySelector('.lk').disabled = !lastLink;
  });
  document.addEventListener('click', function (e) {
    var t = e.target; if (inUi(t)) return;
    var a = t.closest && t.closest('a');
    if (a && editable(a)) { e.preventDefault(); }
    if (t.tagName === 'IMG' && editable(t)) { e.preventDefault(); pickImage(t); }
  }, true);

  document.addEventListener('mouseover', function (e) {
    if (inUi(e.target)) return;
    var el = e.target.closest && e.target.closest(MOV);
    if (!el || !editable(el) && !el.matches('main > section,main > .page-hd')) return;
    if (cur && cur !== el) cur.classList.remove('jk-cur');
    cur = el; el.classList.add('jk-cur'); place();
  });
  function place() {
    if (!cur || !document.body.contains(cur)) { tb.style.display = 'none'; return; }
    var r = cur.getBoundingClientRect();
    tb.style.display = 'flex'; tb.style.top = Math.max(50, r.top + 4) + 'px'; tb.style.left = Math.max(4, Math.min(window.innerWidth - tb.offsetWidth - 8, r.right - tb.offsetWidth - 4)) + 'px';
    tb.querySelector('[data-a=off]').textContent = cur.hasAttribute('data-off') ? '보이기' : '숨기기';
  }
  window.addEventListener('scroll', place, { passive: true });
  tb.addEventListener('click', function (e) {
    var a = e.target.getAttribute('data-a'); if (!a || !cur) return; var el = cur;
    if (a === 'up' && el.previousElementSibling) el.parentNode.insertBefore(el, el.previousElementSibling);
    if (a === 'down' && el.nextElementSibling) el.parentNode.insertBefore(el.nextElementSibling, el);
    if (a === 'dup') { var c = el.cloneNode(true); c.classList.remove('jk-cur'); el.parentNode.insertBefore(c, el.nextSibling); markText(c); }
    if (a === 'off') { if (el.hasAttribute('data-off')) el.removeAttribute('data-off'); else el.setAttribute('data-off', ''); }
    if (a === 'del') { if (!confirm('이 부분을 지울까요? 저장 전에는 새로고침으로 되돌릴 수 있습니다.')) return; el.remove(); cur = null; }
    setDirty(); place(); if (el.scrollIntoView && (a === 'up' || a === 'down')) el.scrollIntoView({ block: 'nearest' });
  });

  function pickImage(img) {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var im = new Image();
        im.onload = function () {
          var max = 1600, w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h));
          var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
          var png = /png$/i.test(f.type) && f.size < 600000;
          cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
          var url = png ? rd.result : cv.toDataURL('image/jpeg', 0.86);
          var ext = png ? 'png' : 'jpg', base = (f.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'image');
          pending = pending.filter(function (p) { return p.img !== img; });
          pending.push({ img: img, name: Date.now() + '-' + base + '.' + ext, b64: url.split(',')[1] });
          img.removeAttribute('srcset'); img.src = url; setDirty(); status('사진을 바꿨습니다. 저장하면 함께 올라갑니다.');
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    };
    inp.click();
  }

  bar.querySelector('.lk').onclick = function () {
    if (!lastLink) return; var u = prompt('연결할 주소를 넣어 주세요.', lastLink.getAttribute('href') || '');
    if (u == null) return; lastLink.setAttribute('href', u.trim()); setDirty();
  };
  bar.querySelector('.ex').onclick = function () {
    if (dirty && !confirm('저장하지 않은 내용이 있습니다. 나갈까요?')) return;
    dirty = false; sessionStorage.removeItem('jkEdit'); location.href = location.pathname;
  };
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  function dlg(html) { var d = ui('div', { 'data-jk-dlg': '' }, '<div class="bx">' + html + '</div>'); document.body.appendChild(d); return d; }
  bar.querySelector('.hp').onclick = function () {
    var d = dlg('<h3>편집 모드 쓰는 법</h3><ol><li>글자를 누르면 바로 고칠 수 있습니다. 줄을 바꿀 때는 Enter를 누릅니다.</li><li>사진이나 표지를 누르면 컴퓨터에 있는 파일로 바꿉니다.</li><li>마우스를 올리면 오른쪽 위에 위로 · 아래로 · 복제 · 숨기기 · 삭제 단추가 나옵니다. 항목을 더하려면 비슷한 항목을 복제한 뒤 고칩니다.</li><li>버튼이나 글 속 링크의 주소는 그 글자를 누른 뒤 위의 "링크 바꾸기"로 바꿉니다.</li><li>다 고쳤으면 "저장"(Ctrl+S)을 누릅니다. 1~2분 뒤 사이트에 반영됩니다.</li><li>저장 전에는 새로고침하면 고치기 전으로 돌아갑니다. 저장한 뒤에도 GitHub 기록으로 되돌릴 수 있습니다.</li><li>다른 페이지는 위 메뉴로 옮겨 가면 편집 모드가 이어집니다.</li></ol><button class="p">닫기</button>');
    d.querySelector('button').onclick = function () { d.remove(); };
  };

  function token() { return localStorage.getItem('jkToken') || ''; }
  function askToken() {
    return new Promise(function (ok, no) {
      var d = dlg('<h3>저장용 열쇠(토큰)를 한 번 넣어 주세요</h3><p>이 컴퓨터의 이 브라우저에만 저장되고, 사이트 방문자에게는 보이지 않습니다.</p><ol><li><a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub 토큰 만들기</a>를 엽니다.</li><li>Token name은 "직결영어 편집", Expiration은 원하는 기간으로 정합니다.</li><li>Resource owner는 <b>jikgyeol</b>, Repository access는 <b>Only select repositories</b>에서 jikgyeol.github.io를 고릅니다.</li><li>Permissions의 Repository permissions에서 <b>Contents</b>를 <b>Read and write</b>로 바꿉니다.</li><li>Generate token을 누르고 나온 값을 아래에 붙여 넣습니다.</li></ol><input placeholder="github_pat_로 시작하는 값"><button class="p">저장하고 계속</button><button class="c">취소</button>');
      d.querySelector('.p').onclick = function () { var v = d.querySelector('input').value.trim(); if (!v) return; localStorage.setItem('jkToken', v); d.remove(); ok(v); };
      d.querySelector('.c').onclick = function () { d.remove(); no(new Error('cancel')); };
    });
  }
  function b64utf8(s) { var b = new TextEncoder().encode(s), r = ''; for (var i = 0; i < b.length; i += 0x8000) r += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(r); }
  function utf8b64(c) { var bin = atob(c.replace(/\n/g, '')), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function gh(path, opt) {
    opt = opt || {}; var h = { Accept: 'application/vnd.github+json' }; var t = token(); if (t) h.Authorization = 'Bearer ' + t;
    return fetch(API + path + (opt.method ? '' : '?ref=' + BRANCH + '&t=' + Date.now()), { method: opt.method || 'GET', headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' });
  }
  function revOf(text) { var m = text.match(/<meta name="jk-rev" content="([^"]*)"/); return m ? m[1] : ''; }
  function myRev() { var m = document.querySelector('meta[name="jk-rev"]'); return m ? m.content : ''; }
  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }

  gh(FILE).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
    if (!j) return; fileSha = j.sha; var latest = revOf(utf8b64(j.content));
    if (latest && latest !== myRev()) { bar.querySelector('.sv').disabled = true; status('최근 저장본이 아직 화면에 반영되지 않았습니다. 1~2분 뒤 새로고침해 주세요.'); }
    ready = true;
  }).catch(function () { ready = true; });

  function clean(c) {
    /* 글자 칸 안에 브라우저가 만든 div·p를 줄바꿈으로 바꿉니다 (p 안의 div는 문단을 깨뜨림) */
    [].forEach.call(c.querySelectorAll('p[data-jk-txt],h1[data-jk-txt],h2[data-jk-txt],h3[data-jk-txt],h4[data-jk-txt],summary[data-jk-txt],figcaption[data-jk-txt],span[data-jk-txt],b[data-jk-txt],a[data-jk-txt],i[data-jk-txt],em[data-jk-txt],strong[data-jk-txt]'), function (t) {
      [].slice.call(t.querySelectorAll('div,p')).forEach(function (b) {
        var f = document.createDocumentFragment();
        if (b.previousSibling && !(b.previousSibling.nodeType === 1 && b.previousSibling.localName === 'br')) f.appendChild(document.createElement('br'));
        while (b.firstChild) f.appendChild(b.firstChild);
        if (f.lastChild && f.lastChild.nodeType === 1 && f.lastChild.localName === 'br' && b.nextSibling) f.removeChild(f.lastChild);
        b.parentNode.replaceChild(f, b);
      });
      while (t.lastChild && t.lastChild.nodeType === 1 && t.lastChild.localName === 'br') t.removeChild(t.lastChild);
    });
    [].forEach.call(c.querySelectorAll('[data-jk-ui]'), function (e) { e.remove(); });
    [].forEach.call(c.querySelectorAll('[contenteditable],[data-jk-txt],[spellcheck]'), function (e) { e.removeAttribute('contenteditable'); e.removeAttribute('data-jk-txt'); e.removeAttribute('spellcheck'); });
    [].forEach.call(c.querySelectorAll('.jk-cur'), function (e) { e.classList.remove('jk-cur'); });
    [].forEach.call(c.querySelectorAll('[class=""]'), function (e) { e.removeAttribute('class'); });
    [].forEach.call(c.querySelectorAll('.wb[hidden],.band[hidden]'), function (e) { e.removeAttribute('hidden'); });
    var chips = c.querySelectorAll('.chip'); [].forEach.call(chips, function (e, i) { e.classList.toggle('on', i === 0); });
    [].forEach.call(c.querySelectorAll('.qa details[open]'), function (e) { e.removeAttribute('open'); });
    [].forEach.call(c.querySelectorAll('.tip.on'), function (e) { e.classList.remove('on'); });
    [].forEach.call(c.querySelectorAll('[aria-expanded="true"]'), function (e) { e.setAttribute('aria-expanded', 'false'); });
    var hd = c.querySelector('.hd'); if (hd) hd.classList.remove('open');
  }

  var saving = false;
  function save() {
    if (saving || bar.querySelector('.sv').disabled) return;
    if (!token()) { askToken().then(save, function () {}); return; }
    saving = true; status('저장 중입니다…');
    var text, sha;
    gh(FILE).then(function (r) { if (r.status === 401) throw { tok: 1 }; if (!r.ok) throw new Error('파일을 읽지 못했습니다 (' + r.status + ')'); return r.json(); })
      .then(function (j) {
        sha = j.sha; text = utf8b64(j.content);
        if (revOf(text) !== myRev()) throw new Error('다른 곳에서 먼저 저장된 내용이 있습니다. 새로고침한 뒤 다시 고쳐 주세요.');
        return pending.reduce(function (p, it) {
          return p.then(function () {
            return gh('img/up/' + it.name, { method: 'PUT', body: { message: '홈페이지 편집: 사진 올림 ' + it.name, content: it.b64, branch: BRANCH } })
              .then(function (r) { if (r.status === 401 || r.status === 403) throw { tok: 1 }; if (!r.ok) throw new Error('사진을 올리지 못했습니다 (' + r.status + ')'); it.path = 'img/up/' + it.name; });
          });
        }, Promise.resolve());
      })
      .then(function () {
        var c = document.body.cloneNode(true);
        pending.forEach(function (it) { var i = [].indexOf.call(document.body.querySelectorAll('img'), it.img); var ci = c.querySelectorAll('img')[i]; if (ci) ci.setAttribute('src', it.path); });
        clean(c);
        var rev = stamp(), bs = text.search(/<body[^>]*>/), bo = text.match(/<body[^>]*>/)[0];
        var head = text.slice(0, bs);
        head = /<meta name="jk-rev"/.test(head) ? head.replace(/<meta name="jk-rev" content="[^"]*">/, '<meta name="jk-rev" content="' + rev + '">') : head.replace('</head>', '<meta name="jk-rev" content="' + rev + '">\n</head>');
        var out = head + bo + '\n' + jkFormat(c) + '\n</body>\n</html>\n';
        return gh(FILE, { method: 'PUT', body: { message: '홈페이지 편집: ' + FILE, content: b64utf8(out), sha: sha, branch: BRANCH } })
          .then(function (r) { if (r.status === 401 || r.status === 403) throw { tok: 1 }; if (r.status === 409) throw new Error('다른 곳에서 먼저 저장된 내용이 있습니다. 새로고침한 뒤 다시 고쳐 주세요.'); if (!r.ok) throw new Error('저장하지 못했습니다 (' + r.status + ')'); return r.json(); })
          .then(function () { var m = document.querySelector('meta[name="jk-rev"]'); if (!m) { m = document.createElement('meta'); m.name = 'jk-rev'; document.head.appendChild(m); } m.content = rev; pending = []; dirty = false; status('저장했습니다. 1~2분 뒤 사이트에 반영됩니다.'); });
      })
      .catch(function (e) {
        if (e && e.tok) { localStorage.removeItem('jkToken'); status('토큰이 맞지 않거나 쓰기 권한이 없습니다. 저장을 다시 눌러 토큰을 넣어 주세요.'); }
        else status((e && e.message) || '저장하지 못했습니다.');
      })
      .then(function () { saving = false; });
  }
  bar.querySelector('.sv').onclick = save;
  window.jkPreview = function () { var c = document.body.cloneNode(true); clean(c); return jkFormat(c); };
})();
