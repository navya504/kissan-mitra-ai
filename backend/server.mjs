import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fromUrl } from 'geotiff';
import proj4 from 'proj4';

const port = Number(process.env.PORT || 4000);
const apiKey = process.env.DATA_GOV_IN_API_KEY;
const resourceId = '9ef84268-d588-465a-a308-a864a43d0070';
const schemesPath = fileURLToPath(new URL('./schemes.json', import.meta.url));
const cache = new Map();
const cacheTtlMs = 15 * 60 * 1000;
const satelliteCache = new Map();

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

function toRupees(value) {
  const amount = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

async function getMandiPrices(url) {
  if (!apiKey) return { error: 'Market prices need a data.gov.in API key on the backend.' };
  const state = (url.searchParams.get('state') || 'Andhra Pradesh').slice(0, 80);
  const cacheKey = state.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < cacheTtlMs) return { result: cached.result };

  const params = new URLSearchParams({ 'api-key': apiKey, format: 'json', limit: '1000', 'filters[state]': state });
  const response = await fetch(`https://api.data.gov.in/resource/${resourceId}?${params}`, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`data.gov.in returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body.records)) throw new Error('The mandi response did not contain records');

  const prices = body.records
    .filter(row => /paddy|rice/i.test(`${row.commodity || ''} ${row.variety || ''}`))
    .map(row => ({
      market: String(row.market || 'Local mandi'),
      district: String(row.district || ''),
      commodity: String(row.commodity || 'Paddy'),
      variety: String(row.variety || ''),
      arrivalDate: String(row.arrival_date || ''),
      minPrice: toRupees(row.min_price) ?? toRupees(row.modal_price) ?? 0,
      maxPrice: toRupees(row.max_price) ?? toRupees(row.modal_price) ?? 0,
      modalPrice: toRupees(row.modal_price),
    }))
    .filter(row => row.modalPrice !== null)
    .sort((a, b) => b.arrivalDate.localeCompare(a.arrivalDate) || a.market.localeCompare(b.market));

  const localDistricts = /^(anakapalli|anakapalle|visakhapatnam|kakinada)$/i;
  const localPrices = prices.filter(row => localDistricts.test(row.district));
  const selectedPrices = localPrices.length ? localPrices : prices;
  const latestByMarket = [...new Map(selectedPrices.map(row => [row.market.toLowerCase(), row])).values()].slice(0, 12);

  const result = { source: 'data.gov.in', updatedAt: new Date().toISOString(), prices: latestByMarket };
  cache.set(cacheKey, { at: Date.now(), result });
  return { result };
}

async function getSchemes(url) {
  const state = (url.searchParams.get('state') || '').trim().toLowerCase();
  const crop = (url.searchParams.get('crop') || '').trim().toLowerCase();
  const schemes = JSON.parse(await readFile(schemesPath, 'utf8'));
  const matching = schemes
    .filter(scheme => scheme.states.some(value => value === '*' || value.toLowerCase() === state))
    .map(scheme => ({
      ...scheme,
      relevant: scheme.crops.some(value => value === '*' || value.toLowerCase() === crop),
    }))
    .sort((a, b) => Number(b.relevant) - Number(a.relevant));
  return { source: 'reviewed_official_sources', updatedAt: '2026-10-31', schemes: matching };
}

function farmSquare(latitude, longitude, areaText) {
  const areaMatch = String(areaText ?? '').replaceAll(',', '').match(/[\d.]+/);
  const areaValue = areaMatch ? Number(areaMatch[0]) : 0;
  const areaAcres = /hectare|\bha\b/i.test(String(areaText)) ? areaValue * 2.47105 : areaValue;
  if (!Number.isFinite(areaAcres) || areaAcres < 0.1 || areaAcres > 500) throw new Error('Farm area must be between 0.1 and 500 acres (or equivalent hectares).');
  const sideMetres = Math.sqrt(areaAcres * 4046.8564224);
  const halfLat = sideMetres / 2 / 111320;
  const cosLat = Math.cos(latitude * Math.PI / 180);
  const halfLng = sideMetres / 2 / (111320 * Math.max(0.1, cosLat));
  return {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [longitude - halfLng, latitude - halfLat],
        [longitude + halfLng, latitude - halfLat],
        [longitude + halfLng, latitude + halfLat],
        [longitude - halfLng, latitude + halfLat],
        [longitude - halfLng, latitude - halfLat],
      ]],
    },
    areaAcres,
  };
}

function utmProjection(longitude, latitude) {
  const zone = Math.floor((longitude + 180) / 6) + 1;
  return `+proj=utm +zone=${zone} ${latitude < 0 ? '+south ' : ''}+datum=WGS84 +units=m +no_defs`;
}

function pixelWindow(image, centerX, centerY, halfSideMetres) {
  const [minX, , , maxY] = image.getBoundingBox();
  const [resX, resY] = image.getResolution();
  const pixelWidth = Math.abs(resX);
  const pixelHeight = Math.abs(resY);
  const left = Math.max(0, Math.floor((centerX - halfSideMetres - minX) / pixelWidth));
  const right = Math.min(image.getWidth(), Math.ceil((centerX + halfSideMetres - minX) / pixelWidth));
  const top = Math.max(0, Math.floor((maxY - (centerY + halfSideMetres)) / pixelHeight));
  const bottom = Math.min(image.getHeight(), Math.ceil((maxY - (centerY - halfSideMetres)) / pixelHeight));
  return { window: [left, top, right, bottom], minX, maxY, pixelWidth, pixelHeight };
}

async function openRaster(asset) {
  if (!asset?.href) throw new Error('The satellite scene is missing a required band.');
  const tiff = await fromUrl(asset.href, { allowFullFile: false, maxRanges: 4 }, AbortSignal.timeout(30000));
  return { tiff, image: await tiff.getImage() };
}

async function sceneNdvi(item, longitude, latitude, halfSideMetres) {
  const assets = item.assets || {};
  const redAsset = assets.red;
  const nirAsset = assets.nir;
  if (!redAsset?.href || !nirAsset?.href) return null;

  const projection = utmProjection(longitude, latitude);
  const [centerX, centerY] = proj4('WGS84', projection, [longitude, latitude]);
  const redRaster = await openRaster(redAsset);
  const nirRaster = await openRaster(nirAsset);
  let sclRaster;
  try {
    const redWindow = pixelWindow(redRaster.image, centerX, centerY, halfSideMetres);
    const nirWindow = pixelWindow(nirRaster.image, centerX, centerY, halfSideMetres);
    const [redLeft, redTop, redRight, redBottom] = redWindow.window;
    const [nirLeft, nirTop, nirRight, nirBottom] = nirWindow.window;
    if (redRight <= redLeft || redBottom <= redTop || nirRight <= nirLeft || nirBottom <= nirTop) return null;
    const [red, nir] = await Promise.all([
      redRaster.image.readRasters({ window: redWindow.window, interleave: true }),
      nirRaster.image.readRasters({ window: nirWindow.window, interleave: true }),
    ]);
    const sclAsset = assets.scl;
    if (sclAsset?.href) {
      try {
        sclRaster = await openRaster(sclAsset);
      } catch {
        sclRaster = null;
      }
    }
    const sclWindow = sclRaster ? pixelWindow(sclRaster.image, centerX, centerY, halfSideMetres) : null;
    const sclData = sclWindow && sclWindow.window[2] > sclWindow.window[0] && sclWindow.window[3] > sclWindow.window[1]
      ? await sclRaster.image.readRasters({ window: sclWindow.window, interleave: true })
      : null;
    const validClasses = new Set([4, 5]);
    const values = [];
    for (let row = 0; row < redWindow.window[3] - redWindow.window[1]; row += 1) {
      for (let col = 0; col < redWindow.window[2] - redWindow.window[0]; col += 1) {
        const projectedX = redWindow.minX + (redWindow.window[0] + col + 0.5) * redWindow.pixelWidth;
        const projectedY = redWindow.maxY - (redWindow.window[1] + row + 0.5) * redWindow.pixelHeight;
        if (Math.abs(projectedX - centerX) > halfSideMetres || Math.abs(projectedY - centerY) > halfSideMetres) continue;
        if (sclData && sclWindow) {
          const sclCol = Math.floor((projectedX - sclWindow.minX) / sclWindow.pixelWidth) - sclWindow.window[0];
          const sclRow = Math.floor((sclWindow.maxY - projectedY) / sclWindow.pixelHeight) - sclWindow.window[1];
          const sclWidth = sclWindow.window[2] - sclWindow.window[0];
          const sclHeight = sclWindow.window[3] - sclWindow.window[1];
          if (sclCol < 0 || sclCol >= sclWidth || sclRow < 0 || sclRow >= sclHeight || !validClasses.has(Number(sclData[sclRow * sclWidth + sclCol]))) continue;
        }
        const index = row * (redWindow.window[2] - redWindow.window[0]) + col;
        const redValue = Number(red[index]);
        const nirValue = Number(nir[index]);
        const total = redValue + nirValue;
        if (total > 0) values.push((nirValue - redValue) / total);
      }
    }
    if (!values.length) return null;
    return { ndvi: values.reduce((sum, value) => sum + value, 0) / values.length, validPixels: values.length };
  } finally {
    await Promise.all([redRaster.tiff.close(), nirRaster.tiff.close(), sclRaster?.tiff.close()].filter(Boolean));
  }
}

async function getSatelliteAnalysis(payload) {
  const latitude = Number(payload.latitude);
  const longitude = Number(payload.longitude);
  if (!Number.isFinite(latitude) || latitude < -60 || latitude > 80 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Choose a valid farm pin before analyzing satellite data.');
  }
  const field = farmSquare(latitude, longitude, payload.area);
  const cacheKey = `${latitude.toFixed(5)}:${longitude.toFixed(5)}:${field.areaAcres.toFixed(2)}`;
  const cached = satelliteCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 3 * 60 * 60 * 1000) return { result: cached.result };
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const bbox = [longitude - Math.sqrt(field.areaAcres * 4046.8564224) / (2 * 111320 * Math.max(0.1, Math.cos(latitude * Math.PI / 180))), latitude - Math.sqrt(field.areaAcres * 4046.8564224) / (2 * 111320), longitude + Math.sqrt(field.areaAcres * 4046.8564224) / (2 * 111320 * Math.max(0.1, Math.cos(latitude * Math.PI / 180))), latitude + Math.sqrt(field.areaAcres * 4046.8564224) / (2 * 111320)];
  const response = await fetch('https://earth-search.aws.element84.com/v1/search', {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/geo+json' },
    body: JSON.stringify({ collections: ['sentinel-2-c1-l2a', 'sentinel-2-l2a'], bbox, datetime: `${from.toISOString()}/${to.toISOString()}`, limit: 100 }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`Earth Search scene lookup failed (${response.status}).`);
  const catalog = await response.json();
  const candidates = (Array.isArray(catalog.features) ? catalog.features : [])
    .filter(item => item?.assets?.red?.href && item?.assets?.nir?.href && Number.isFinite(Date.parse(item.properties?.datetime)) && Number(item.properties?.['eo:cloud_cover'] ?? 100) <= 50)
    .sort((a, b) => String(b.properties?.datetime || '').localeCompare(String(a.properties?.datetime || '')));
  const scenesByPeriod = new Map();
  for (const item of candidates) {
    const date = new Date(item.properties.datetime);
    const period = Math.floor((date.getTime() - from.getTime()) / (10 * 24 * 60 * 60 * 1000));
    const current = scenesByPeriod.get(period);
    if (!current || Number(item.properties?.['eo:cloud_cover'] ?? 100) < Number(current.properties?.['eo:cloud_cover'] ?? 100)) scenesByPeriod.set(period, item);
  }
  const scenes = [...scenesByPeriod.values()].sort((a, b) => String(a.properties.datetime).localeCompare(String(b.properties.datetime)));
  const halfSideMetres = Math.sqrt(field.areaAcres * 4046.8564224) / 2;
  const points = [];
  let failedScenes = 0;
  for (const scene of scenes) {
    try {
      const values = await sceneNdvi(scene, longitude, latitude, halfSideMetres);
      if (values) points.push({ date: String(scene.properties.datetime), mean: values.ndvi, samples: values.validPixels });
    } catch (error) {
      failedScenes += 1;
      console.warn('Could not read one Sentinel-2 scene:', error instanceof Error ? error.message : 'Unknown raster error');
    }
  }
  if (!points.length && failedScenes) throw new Error('Could not read the public Sentinel-2 imagery. Please try again later.');
  if (!points.length) return { result: { source: 'Sentinel-2 L2A via Earth Search', analyzedAt: new Date().toISOString(), fieldAreaAcres: Number(field.areaAcres.toFixed(2)), boundaryMethod: 'estimated_square_from_pin_and_area', observations: [], latest: null } };
  const latest = points.at(-1);
  const previous = points.length > 1 ? points.at(-2) : null;
  const result = {
    source: 'Sentinel-2 L2A via Earth Search', analyzedAt: new Date().toISOString(), fieldAreaAcres: Number(field.areaAcres.toFixed(2)),
    boundaryMethod: 'estimated_square_from_pin_and_area',
    latest: { date: latest.date, ndvi: Number(latest.mean.toFixed(3)), vigorScore: Math.max(0, Math.min(100, Math.round(latest.mean * 100))), validPixels: latest.samples,
      changeFromPrevious: previous ? Number((latest.mean - previous.mean).toFixed(3)) : null },
    observations: points.map(point => ({ date: point.date, ndvi: Number(point.mean.toFixed(3)), validPixels: point.samples })),
  };
  satelliteCache.set(cacheKey, { at: Date.now(), result });
  return { result };
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && url.pathname === '/api/schemes') {
    try {
      return json(res, 200, await getSchemes(url));
    } catch (error) {
      console.error('Scheme catalogue could not be loaded:', error instanceof Error ? error.message : 'Unknown error');
      return json(res, 500, { error: 'Could not load the scheme catalogue.' });
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/satellite/analysis') {
    let payload;
    try { payload = await new Promise((resolve, reject) => { let body = ''; req.on('data', chunk => { body += chunk; if (body.length > 16_384) reject(new Error('Request is too large.')); }); req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Request body must be valid JSON.')); } }); req.on('error', reject); }); }
    catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : 'Invalid request.' }); }
    try {
      const { result, error } = await getSatelliteAnalysis(payload);
      if (error) return json(res, 503, { error });
      return json(res, 200, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Satellite analysis is unavailable.';
      console.error('Satellite analysis failed:', message);
      return json(res, message.startsWith('Choose a valid') || message.startsWith('Farm area') ? 400 : 502, { error: message });
    }
  }
  if (req.method !== 'GET' || url.pathname !== '/api/market/prices') return json(res, 404, { error: 'Not found' });
  try {
    const { result, error } = await getMandiPrices(url);
    if (error) return json(res, 503, { error });
    return json(res, 200, result);
  } catch (error) {
    console.error('Market provider request failed:', error instanceof Error ? error.message : 'Unknown error');
    return json(res, 502, { error: 'Could not load current mandi prices. Please try again later.' });
  }
}).listen(port, () => console.log(`Kisaan Mitra data API listening on http://localhost:${port}`));
