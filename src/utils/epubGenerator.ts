import JSZip from 'jszip';
import { EbookData } from '../types';

export async function generateEpubBlob(ebook: EbookData): Promise<Blob> {
  const zip = new JSZip();

  // 1. mimetype (must be first and uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  // 3. OEBPS/styles.css
  const styles = `
body {
  font-family: serif;
  line-height: 1.8;
  margin: 5%;
  color: #222;
}
h1, h2 {
  font-family: sans-serif;
  color: #111;
  text-align: center;
}
.chapter-title {
  margin-top: 2em;
  margin-bottom: 0.5em;
  font-size: 1.8em;
  font-weight: bold;
}
.chapter-num {
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #b45309;
  font-size: 0.9em;
  text-align: center;
  margin-bottom: 0.5em;
}
.audio-box {
  background: #fdf6e2;
  border: 1px solid #ebd599;
  border-radius: 8px;
  padding: 12px;
  margin: 20px 0;
  text-align: center;
}
p {
  text-indent: 1.5em;
  margin-bottom: 1em;
  text-align: justify;
}
p.lead {
  text-indent: 0;
  font-weight: 500;
}
`;
  zip.file('OEBPS/styles.css', styles);

  // 4. Chapter XHTML files
  const manifestItems: string[] = [];
  const spineItems: string[] = [];
  const tocNavItems: string[] = [];

  manifestItems.push(`<item id="styles" href="styles.css" media-type="text/css"/>`);
  manifestItems.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);
  manifestItems.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

  ebook.bab.forEach((ch, idx) => {
    const filename = `chapter_${idx + 1}.xhtml`;
    const itemId = `chap_${idx + 1}`;

    manifestItems.push(`<item id="${itemId}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${itemId}"/>`);
    tocNavItems.push(`<li><a href="${filename}">${escapeXml(ch.judul_bab || `Bab ${idx + 1}`)}</a></li>`);

    const paragraphs = ch.teks
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p, pIdx) => `<p class="${pIdx === 0 ? 'lead' : ''}">${escapeXml(p)}</p>`)
      .join('\n');

    const audioMarkup = ch.audio_url
      ? `<div class="audio-box">
          <p style="margin: 0 0 8px 0; font-size: 0.85em; font-weight: bold; color: #854d0e;">Narasi Suara Bahasa Indonesia</p>
          <audio controls="controls" src="${escapeXml(ch.audio_url)}" style="width: 100%;">
            Browser/E-reader Anda tidak mendukung pemutar audio langsung.
          </audio>
        </div>`
      : '';

    const chapterHtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="id" lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeXml(ch.judul_bab || `Bab ${idx + 1}`)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <div class="chapter-num">Bab ${idx + 1}</div>
  <h2 class="chapter-title">${escapeXml(ch.judul_bab || `Bab ${idx + 1}`)}</h2>
  ${audioMarkup}
  <div class="chapter-content">
    ${paragraphs}
  </div>
</body>
</html>`;

    zip.file(`OEBPS/${filename}`, chapterHtml);
  });

  // 5. OEBPS/nav.xhtml
  const navXhtml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="id" lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Daftar Isi - ${escapeXml(ebook.judul)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Daftar Isi</h1>
    <ol>
      ${tocNavItems.join('\n      ')}
    </ol>
  </nav>
</body>
</html>`;
  zip.file('OEBPS/nav.xhtml', navXhtml);

  // 6. OEBPS/toc.ncx (for older EPUB2/3 compatibility)
  const ncxNavPoints = ebook.bab
    .map(
      (ch, idx) => `
    <navPoint id="np_${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(ch.judul_bab || `Bab ${idx + 1}`)}</text></navLabel>
      <content src="chapter_${idx + 1}.xhtml"/>
    </navPoint>`
    )
    .join('');

  const tocNcx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:ebook-${Date.now()}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(ebook.judul)}</text>
  </docTitle>
  <navMap>
    ${ncxNavPoints}
  </navMap>
</ncx>`;
  zip.file('OEBPS/toc.ncx', tocNcx);

  // 7. OEBPS/content.opf
  const contentOpf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:ebook-${Date.now()}</dc:identifier>
    <dc:title>${escapeXml(ebook.judul)}</dc:title>
    <dc:creator>${escapeXml(ebook.penulis || 'Penulis')}</dc:creator>
    <dc:language>id</dc:language>
    <dc:description>${escapeXml(ebook.deskripsi || '')}</dc:description>
    <dc:date>${new Date().toISOString()}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`;
  zip.file('OEBPS/content.opf', contentOpf);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
}

function escapeXml(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
