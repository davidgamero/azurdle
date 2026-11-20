import { load } from 'cheerio';
import AdmZip from 'adm-zip';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'yaml';

const directoryUrl = 'https://azure.microsoft.com/en-us/products/';
const iconPageUrl = 'https://learn.microsoft.com/en-us/azure/architecture/icons/';
const docsUrl = 'https://raw.githubusercontent.com/MicrosoftDocs/azure-docs/main/articles/index.yml';
const root = new URL('../', import.meta.url);
const clean = (text) => text.replace(/\s+/g, ' ').trim();
const normalize = (text) => text.toLowerCase().replace(/\([^)]*\)/g, '').replace(/microsoft|azure|service(s)?|[^a-z0-9]/g, '');
const slug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return Buffer.from(await response.arrayBuffer());
}
await mkdir(new URL('.cache/', root), { recursive: true });
await mkdir(new URL('src/data/', root), { recursive: true });
await mkdir(new URL('public/icons/', root), { recursive: true });
const cached = async (name, url) => {
  const path = new URL(`.cache/${name}`, root);
  if (process.argv.includes('--cached')) {
    try { return await readFile(path); } catch { /* Fetch files not yet cached. */ }
  }
  const data = await download(url); await writeFile(path, data); return data;
};
const $ = load(await cached('products.html', directoryUrl));
const iconPage = load(await cached('icon-page.html', iconPageUrl));
const iconZipUrl = iconPage('a').map((_, a) => iconPage(a).attr('href')).get().find((url) => /Azure_Public_Service_Icons.*\.zip$/.test(url));
if (!iconZipUrl) throw new Error('Microsoft icon download link missing. Check the source page.');
const zip = new AdmZip(await cached('icons.zip', iconZipUrl));
const icons = zip.getEntries().filter((entry) => entry.entryName.endsWith('.svg')).map((entry) => ({
  entry,
  name: entry.entryName.split('/').pop().replace(/^\d+-icon-(service|general)-/, '').replace(/\.svg$/, ''),
}));
const overrides = JSON.parse(await readFile(new URL('scripts/icon-mapping.json', root), 'utf8'));
const docs = parse((await cached('docs-index.yml', docsUrl)).toString()).productDirectory.items;
const services = new Map();
let category = '';
// Walking headings and cards in document order preserves Microsoft's categories.
$('main h2, main .card-body').each((_, element) => {
  const node = $(element);
  if (node.is('h2')) { category = clean(node.text()); return; }
  const name = clean(node.find('h3').text());
  const description = clean(node.find('[data-oc-token-text]').text());
  const url = node.find('a').filter((_, a) => clean($(a).text()) === 'Product').first().attr('href');
  if (!name || !description || !url || !category || category === 'Select a category:') return;
  const canonical = new URL(url, directoryUrl).href.replace(/\/$/, '');
  if (services.has(canonical)) {
    const existing = services.get(canonical);
    if (!existing.categories.includes(category)) existing.categories.push(category);
    if (existing.name !== name && !existing.aliases.includes(name)) existing.aliases.push(name);
    return;
  }
  const mapping = overrides[name];
  const icon = mapping ? icons.find((icon) => icon.name === mapping.icon) : icons.find((icon) => normalize(icon.name) === normalize(name));
  if (mapping?.icon && !icon) throw new Error(`Unknown mapped icon for ${name}: ${mapping.icon}`);
  const id = slug(name);
  const aliases = [...new Set([...(mapping?.aliases ?? []), ...(name.match(/\(([^)]+)\)/)?.slice(1) ?? [])])];
  services.set(canonical, { id, name, categories: [category], description, url: canonical, aliases,
    icon: icon ? `icons/${id}.svg` : 'icons/generic.svg',
    iconSource: icon?.entry.entryName ?? null,
    playable: Boolean(icon),
  });
});
const catalog = [...services.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));
if (catalog.length < 150) throw new Error(`Only ${catalog.length} services found; refusing to replace the catalog.`);
// Supplement the architecture pack with icons published in Microsoft's documentation hub.
for (const service of catalog.filter((service) => !service.iconSource)) {
  const doc = docs.find((doc) => normalize(doc.title) === normalize(overrides[service.name]?.docsTitle ?? service.name));
  if (!doc?.imageSrc || doc.imageSrc.endsWith('/azure.svg')) continue;
  const url = doc.imageSrc.startsWith('/') ? new URL(doc.imageSrc, 'https://learn.microsoft.com').href : new URL(doc.imageSrc, docsUrl).href;
  const image = await cached(`doc-${service.id}.svg`, url);
  if (!image.toString().includes('<svg')) throw new Error(`Expected SVG: ${url}`);
  await writeFile(new URL(`public/icons/${service.id}.svg`, root), image);
  service.icon = `icons/${service.id}.svg`;
  service.iconSource = url;
  service.playable = true;
}
for (const service of catalog) {
  if (service.iconSource && !service.iconSource.startsWith('https://')) await writeFile(new URL(`public/${service.icon}`, root), zip.getEntry(service.iconSource).getData());
}
await writeFile(new URL('public/icons/generic.svg', root), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#d9eaff" stroke="#3977b7" stroke-width="2" d="M16 47a12 12 0 0 1-2-24 18 18 0 0 1 35-1 13 13 0 0 1-1 25z"/><path fill="#3977b7" d="M29 27h6v6h-6zm0 10h6v6h-6z"/></svg>');
const data = {
  fetchedAt: new Date().toISOString(),
  source: directoryUrl,
  iconSource: iconPageUrl,
  iconArchive: iconZipUrl,
  documentationSource: docsUrl,
  version: createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 12),
  services: catalog,
};
const existingIds = new Set(catalog.filter((service) => service.playable).map((service) => service.id));
try {
  const pool = JSON.parse(await readFile(new URL('src/data/daily-pool.json', root), 'utf8'));
  const missing = pool.filter((id) => !existingIds.has(id));
  if (missing.length) throw new Error(`Frozen daily pool services removed, renamed, or missing icons: ${missing.join(', ')}. Preserve stable IDs before refreshing.`);
} catch (error) { if (error.code !== 'ENOENT') throw error; }
await writeFile(new URL('src/data/catalog.json', root), JSON.stringify(data, null, 2) + '\n');
// Freeze the daily pool on first import. Refreshing names/icons must not reshuffle daily answers.
try { await readFile(new URL('src/data/daily-pool.json', root)); } catch {
  await writeFile(new URL('src/data/daily-pool.json', root), JSON.stringify(catalog.filter((s) => s.playable).map((s) => s.id), null, 2) + '\n');
}
console.log(`Scraped ${catalog.length} products; ${catalog.filter((s) => s.playable).length} with matched official icons.`);
console.log('Unmatched:', catalog.filter((s) => !s.playable).map((s) => s.name).join('\n'));
