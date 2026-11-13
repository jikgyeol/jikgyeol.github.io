// 네이버 블로그(직결영어) 최신 글 5편을 읽어 blog.json과 대표 이미지를 갱신한다.
// GitHub Actions(.github/workflows/update-blog.yml)가 하루 몇 번 실행한다.
import { writeFile, mkdir, readdir, unlink } from 'node:fs/promises';

const RSS = 'https://rss.blog.naver.com/pageandpencil.xml';
const COUNT = 5;
const IMG_DIR = 'img/blog';
const UA = 'Mozilla/5.0 (compatible; jikgyeol-site-updater)';

const decode = (s = '') => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = (s = '') => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, name) => (xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')) || [])[1] || '';
const firstSentence = (s) => (s.match(/^.*?[.?!](?=\s|$)/) || [s.slice(0, 90)])[0];

async function download(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.length > 2000 ? buf : null;
}

async function main() {
  const res = await fetch(RSS, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error('RSS ' + res.status);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]).slice(0, COUNT);
  if (items.length < COUNT) throw new Error('글 수 부족: ' + items.length);

  await mkdir(IMG_DIR, { recursive: true });
  const out = [];
  for (const it of items) {
    const link = strip(tag(it, 'link')).replace(/\?.*$/, '');
    const id = (link.match(/(\d{9,})$/) || [])[1];
    if (!id) throw new Error('글 번호 없음: ' + link);
    const descRaw = decode(tag(it, 'description'));
    const thumb = (descRaw.match(/<img[^>]+src="([^"]+)"/) || [])[1] || '';
    let img = '';
    if (thumb) {
      const ext = /\.png(\?|$)/i.test(thumb) ? 'png' : /\.gif(\?|$)/i.test(thumb) ? 'gif' : 'jpg';
      const big = thumb.replace('blogthumb.pstatic.net', 'postfiles.pstatic.net').replace(/\?type=.*$/, '?type=w966');
      const h = { Referer: 'https://blog.naver.com/', 'User-Agent': UA };
      const buf = (await download(big, h)) || (await download(thumb, h));
      if (buf) { img = IMG_DIR + '/' + id + '.' + ext; await writeFile(img, buf); }
    }
    out.push({ id, title: strip(tag(it, 'title')), cat: strip(tag(it, 'category')), link, desc: firstSentence(strip(descRaw)), img });
  }
  // 목록에서 빠진 옛 이미지는 지운다.
  const keep = new Set(out.map((o) => o.img.split('/').pop()));
  for (const f of await readdir(IMG_DIR)) if (!keep.has(f)) await unlink(IMG_DIR + '/' + f);
  await writeFile('blog.json', JSON.stringify(out, null, 1) + '\n');
  console.log(out.map((o) => o.id + ' ' + o.title).join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
