/* AZOBSS v1509 - administrator-only server-side GitHub image publishing.
 * The browser NEVER sees the GitHub credential. An authenticated Firebase admin
 * publishes a validated WebP and the authoritative local image map atomically.
 */
import crypto from 'node:crypto';

const MAX_INPUT = 7 * 1024 * 1024;
const MAPS = {
  hardware: { path: 'PC-Build/images/products/local-hardware-map-v1505.js', global: 'AZOBSS_PC_LOCAL_HARDWARE_IMAGES' },
  build: { path: 'PC-Build/images/products/local-image-map-v1502.js', global: 'AZOBSS_PC_LOCAL_IMAGES' }
};
const INDEX_PATH = 'PC-Build/index.html';
const decode = data => Buffer.from(String(data || '').replace(/\s/g, ''), 'base64').toString('utf8');
const err = (status, message, code) => Object.assign(new Error(message), {status, code});

async function githubJson(base, path, token, method = 'GET', body = undefined) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body === undefined ? {} : {'Content-Type':'application/json'})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const message = r.status === 401 ? 'Token GitHub tidak sah atau telah tamat tempoh.'
        : r.status === 403 ? 'Token GitHub tiada izin Contents: Read and Write untuk repo ini.'
        : r.status === 404 ? 'Repo atau fail map AZOBSS tidak ditemui dalam GitHub.'
        : r.status === 409 || r.status === 422 ? 'GitHub sedang menerima commit lain. Cuba simpan sekali lagi.'
        : `GitHub gagal menerima permintaan (HTTP ${r.status}).`;
      throw err(r.status, message, `github_${r.status}`);
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw err(504, 'GitHub tidak menjawab dalam 20 saat.', 'github_timeout');
    throw e;
  } finally { clearTimeout(timer); }
}

function parseMap(content, name) {
  const raw = String(content || '').trim();
  const prefix = `window.${name}=`;
  if (!raw.startsWith(prefix)) throw err(422, `Format ${name} tidak dikenal pasti.`, 'invalid_map');
  let map;
  try { map = JSON.parse(raw.slice(prefix.length).replace(/;\s*$/, '')); }
  catch { throw err(422, 'Map gambar GitHub tidak sah.', 'invalid_map_json'); }
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw err(422, 'Map gambar bukan object.', 'invalid_map');
  return map;
}

export async function publishAtomically({ token, repo, branch, kind, id, name, imageBuffer }) {
  const root = `https://api.github.com/repos/${repo}`;
  const info = MAPS[kind];
  const imagePath = `PC-Build/images/products/admin-edit-${id}.webp`;
  const revision = crypto.createHash('sha256').update(imageBuffer).digest('hex').slice(0, 12);
  const imageUrl = `/PC-Build/images/products/admin-edit-${id}.webp?v=${revision}`;
  const mapPath = info.path;
  const safeBranch = encodeURIComponent(branch);

  // All three files (asset, map and HTML cache-buster) are committed together.
  // If HEAD moves, re-read the new map to avoid dropping other administrators' updates.
  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await githubJson(root, `/git/ref/heads/${safeBranch}`, token);
    const parentSha = String(ref.object?.sha || '');
    if (!/^[a-f0-9]{40}$/.test(parentSha)) throw err(502, 'Commit GitHub tidak dapat disahkan.', 'bad_git_ref');
    const [commit, mapFile, htmlFile] = await Promise.all([
      githubJson(root, `/git/commits/${parentSha}`, token),
      githubJson(root, `/contents/${mapPath}?ref=${parentSha}`, token),
      githubJson(root, `/contents/${INDEX_PATH}?ref=${parentSha}`, token)
    ]);
    const map = parseMap(decode(mapFile.content), info.global);
    map.version = '1509';
    map.ready = true;
    map.byId = map.byId && typeof map.byId === 'object' ? map.byId : {};
    map.byId[id] = imageUrl;
    if (kind === 'build' && !id.startsWith('json-')) map.byId[`json-${id}`] = imageUrl;
    if (name) {
      const key = String(name).toLowerCase().replace(/&amp;/g,'&').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
      if (key) {map.byName = map.byName && typeof map.byName === 'object' ? map.byName : {}; map.byName[key] = imageUrl;}
    }
    if (kind === 'hardware') {
      const unique = new Set(Object.values(map.byId).filter(value => typeof value === 'string' && value.startsWith('/PC-Build/images/products/')));
      map.downloaded = Math.max(Number(map.downloaded) || 0, unique.size);
      map.missing = Math.max(0, (Number(map.expected) || 14) - map.downloaded);
      map.complete = map.missing === 0;
      map.partialAllowed = true;
    } else {map.partialAllowed = true; map.enforceLocal = true;}
    const mapText = `window.${info.global}=${JSON.stringify(map)};\n`;
    const currentHtml = decode(htmlFile.content);
    const escapedName = info.path.split('/').pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cacheRe = new RegExp(`(${escapedName}\\?v=)[^"'<>\\s]+`);
    const htmlText = currentHtml.replace(cacheRe, `$1${Date.now()}-${revision}`);
    if (htmlText === currentHtml) throw err(422, 'Rujukan map dalam PC-Build/index.html tidak ditemui.', 'map_script_missing');

    const [imageBlob, mapBlob, htmlBlob] = await Promise.all([
      githubJson(root, '/git/blobs', token, 'POST', {content:imageBuffer.toString('base64'), encoding:'base64'}),
      githubJson(root, '/git/blobs', token, 'POST', {content:mapText, encoding:'utf-8'}),
      githubJson(root, '/git/blobs', token, 'POST', {content:htmlText, encoding:'utf-8'})
    ]);
    const gitTree = await githubJson(root, '/git/trees', token, 'POST', {
      base_tree: commit.tree.sha,
      tree: [
        {path:imagePath, mode:'100644', type:'blob', sha:imageBlob.sha},
        {path:mapPath, mode:'100644', type:'blob', sha:mapBlob.sha},
        {path:INDEX_PATH, mode:'100644', type:'blob', sha:htmlBlob.sha}
      ]
    });
    const newCommit = await githubJson(root, '/git/commits', token, 'POST', {
      message:`AZOBSS v1509: publish edited ${kind} image for ${id}`,
      tree:gitTree.sha,
      parents:[parentSha]
    });
    try {
      await githubJson(root, `/git/refs/heads/${safeBranch}`, token, 'PATCH', {sha:newCommit.sha, force:false});
      return {commit:newCommit.sha, commitUrl:`https://github.com/${repo}/commit/${newCommit.sha}`, imagePath, imageUrl, mapPath};
    } catch (e) {
      if (![409,422].includes(e.status) || attempt === 2) throw e;
    }
  }
  throw err(409, 'Konflik commit GitHub. Cuba sekali lagi.', 'github_conflict');
}

export function registerPcShopGithubImagePublisher(app, {multer, getFirebaseAdminIdentity, azBackendTrustedAdminIdentity}) {
  const upload = multer({storage:multer.memoryStorage(),limits:{fileSize:MAX_INPUT, files:1, fields:4}}).single('image');
  const config = () => ({
    repo: String(process.env.AZOBSS_GITHUB_REPO || 'zedan91/www.zedan91.github.io').trim(),
    branch: String(process.env.AZOBSS_GITHUB_BRANCH || 'main').trim(),
    token: String(process.env.AZOBSS_GITHUB_TOKEN || '').trim()
  });
  const secureAdmin = async (req,res,next) => {
    try {
      // Specifically require verified Firebase identity, never ADMIN_KEY header only.
      const identity = await getFirebaseAdminIdentity(req);
      if (!identity || !azBackendTrustedAdminIdentity(identity)) return res.status(403).json({ok:false,error:'admin_firebase_login_required',message:'Log masuk Firebase sebagai Administrator AZOBSS.'});
      req.azobssPhotoAdmin = identity;
      next();
    } catch (_) { res.status(403).json({ok:false,error:'admin_verification_failed'}); }
  };
  app.get('/api/admin/pc-shop/image-publish/status', secureAdmin, (req,res) => {
    const c = config();
    res.set('Cache-Control','no-store');
    return res.json({ok:true, configured:!!c.token, repo:c.repo, branch:c.branch, maxInputMB:7});
  });
  app.post('/api/admin/pc-shop/image-publish', secureAdmin, (req,res,next) => {
    upload(req,res,e => e ? res.status(413).json({ok:false,error:'upload_rejected',message:'Fail gambar terlalu besar. Had 7MB.'}) : next());
  }, async (req,res) => {
    res.set('Cache-Control','no-store');
    try {
      const c=config();
      if (!c.token) throw err(503,'AZOBSS_GITHUB_TOKEN belum ditetapkan dalam Render → Environment.','github_not_configured');
      if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(c.repo) || !/^[A-Za-z0-9_.\/-]+$/.test(c.branch) || c.branch.includes('..')) throw err(503,'Tetapan repo/branch GitHub tidak sah.','github_config_invalid');
      const kind = String(req.body?.productKind || '').trim();
      const id = String(req.body?.productId || '').trim();
      const name = String(req.body?.productName || '').trim().slice(0,160);
      if (!(kind in MAPS) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,95}$/.test(id)) throw err(400,'ID/kategori produk tidak sah.','product_not_identified');
      if (!req.file?.buffer) throw err(400,'Fail imej tidak dihantar.','image_missing');
      const {default:sharp} = await import('sharp');
      const input = sharp(req.file.buffer,{limitInputPixels:8_000_000,failOn:'error'});
      const meta = await input.metadata();
      if (!['jpeg','png','webp'].includes(meta.format) || !meta.width || !meta.height || meta.width>3200 || meta.height>3200 || meta.width*meta.height>8_000_000) throw err(400,'Gambar mesti JPEG/PNG/WebP, maksimum 3200px dan 8MP.','bad_image');
      const imageBuffer = await sharp(req.file.buffer,{limitInputPixels:8_000_000,failOn:'error'}).rotate().webp({quality:90,effort:4}).toBuffer();
      if (imageBuffer.length>MAX_INPUT) throw err(413,'Imej selepas diproses terlalu besar.','image_too_large');
      const result = await publishAtomically({token:c.token,repo:c.repo,branch:c.branch,kind,id,name,imageBuffer});
      console.log('AZOBSS PC image published:',kind,id,result.commit.slice(0,9),req.azobssPhotoAdmin?.uid?.slice(0,12)||'');
      return res.json({ok:true,release:'1509',status:'committed',...result,message:'Imej dan map berjaya dicommit ke GitHub. Penerbitan GitHub Pages akan menyusul.'});
    } catch (e) {
      console.warn('AZOBSS PC image publish:',e.code || 'failed',e.message);
      return res.status(e.status && e.status>=400 && e.status<600 ? e.status : 502).json({ok:false,error:e.code||'publish_failed',message:e.status ? e.message : 'Gagal menyiarkan imej. Sila semak log Render / sambungan GitHub.'});
    }
  });
}
