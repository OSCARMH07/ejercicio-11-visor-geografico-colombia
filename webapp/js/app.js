const map = L.map('map', { preferCanvas: true }).setView([4.5709, -74.2973], 6);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const live = document.documentElement.dataset.source === 'geoserver';
const control = L.control.layers().addTo(map);
if (live) {
  for (const [type, name] of [['departamentos', 'Departamentos'], ['municipios', 'Municipios']]) {
    const layer = L.tileLayer.wms('geoserver/wms', {
      layers: `taller:${type}`, format: 'image/png', transparent: true
    });
    control.addOverlay(layer, `${name} (WMS)`);
  }
}
L.control.scale({ imperial: false }).addTo(map);

const departmentSelect = document.querySelector('#department');
const form = document.querySelector('#search');
const results = document.querySelector('#results');
const status = document.querySelector('#status');
const info = document.querySelector('#info');
const prompt = info.textContent;
const colors = { departments: '#155e75', municipalities: '#a64917' };
const legend = L.control({ position: 'bottomright' });
legend.onAdd = () => {
  const box = L.DomUtil.create('div', 'legend');
  box.innerHTML = `<strong>${live ? 'Leyenda WFS' : 'Leyenda'}</strong>
    <span><i style="background:${colors.departments}"></i>Departamentos</span>
    <span><i style="background:${colors.municipalities}"></i>Municipios</span>`;
  return box;
};
legend.addTo(map);

function title(p) {
  return p.mpio_cnmbr ? `${p.mpio_cnmbr} · ${p.dpto_cnmbr}` : p.dpto_cnmbr;
}

function description(p) {
  return `${title(p)} · Código ${p.mpio_cdpmp ?? p.dpto_ccdgo}`;
}

function vector(color) {
  const group = L.geoJSON(null, {
    style: { color, weight: 2, fillOpacity: 0.13 },
    onEachFeature(feature, layer) {
      const popup = document.createElement('div');
      popup.textContent = description(feature.properties);
      layer.bindPopup(popup);
      layer.on('mouseover', () => {
        layer.setStyle({ weight: 3, fillOpacity: 0.3 });
        info.textContent = popup.textContent;
      });
      layer.on('mouseout', () => {
        group.resetStyle(layer);
        info.textContent = prompt;
      });
      layer.on('click', () => {
        info.textContent = popup.textContent;
      });
    }
  });
  return group;
}

const departments = vector(colors.departments).addTo(map);
const municipalities = vector(colors.municipalities);
control.addOverlay(departments, live ? 'Departamentos (WFS)' : 'Departamentos');
control.addOverlay(municipalities, live ? 'Municipios (WFS)' : 'Municipios');

async function load(type, filter) {
  const params = new URLSearchParams({
    service: 'WFS', version: '2.0.0', request: 'GetFeature',
    typeNames: `taller:${type}`, outputFormat: 'application/json', srsName: 'EPSG:4326'
  });
  if (filter) params.set('cql_filter', filter);
  const response = await fetch(live ? `geoserver/wfs?${params}` : `data/${type}.geojson`);
  if (!response.ok) throw new Error(`La solicitud respondió con HTTP ${response.status}.`);
  const collection = await response.json();
  if (collection.type !== 'FeatureCollection') throw new Error('Se esperaba GeoJSON.');
  return collection;
}

const normalize = (name) => name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
let allMunicipalities;
let filterRequest = 0;

async function selectMunicipalities(code) {
  if (!code) return allMunicipalities;
  if (live) return load('municipios', `dpto_ccdgo='${code}'`);
  return {
    type: 'FeatureCollection',
    features: allMunicipalities.features.filter((feature) => feature.properties.dpto_ccdgo === code)
  };
}

departmentSelect.addEventListener('change', async () => {
  const request = ++filterRequest;
  const code = departmentSelect.value;
  results.replaceChildren();
  status.textContent = 'Actualizando municipios…';
  try {
    const data = await selectMunicipalities(code);
    if (request !== filterRequest) return;
    municipalities.clearLayers().addData(data).addTo(map);
    const bounds = municipalities.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds);
    status.textContent = `${data.features.length.toLocaleString('es-CO')} municipios.`;
  } catch (error) {
    if (request === filterRequest) {
      municipalities.clearLayers();
      status.textContent = `No se pudo aplicar el filtro. ${error.message}`;
    }
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  results.replaceChildren();
  const query = normalize(document.querySelector('#name').value);
  if (!query) return;
  const matches = [departments, municipalities].flatMap((group) =>
    group.getLayers().filter(({ feature }) => {
      const p = feature.properties;
      return normalize(p.mpio_cnmbr ?? p.dpto_cnmbr).includes(query);
    }).map((layer) => ({ group, layer }))
  );
  status.textContent = matches.length === 1 ? '1 resultado.' : matches.length > 20
    ? `${matches.length} resultados. Se muestran los primeros 20.`
    : `${matches.length} resultados.`;
  for (const { group, layer } of matches.slice(0, 20)) {
    const button = document.createElement('button');
    button.textContent = title(layer.feature.properties);
    button.addEventListener('click', () => {
      group.addTo(map);
      layer.bringToFront();
      map.fitBounds(layer.getBounds(), { maxZoom: 12 });
      layer.openPopup(layer.getBounds().getCenter());
    });
    results.append(button);
  }
});

Promise.all([load('departamentos'), load('municipios')]).then(([data, municipal]) => {
  departments.addData(data);
  municipalities.addData(municipal);
  allMunicipalities = municipal;
  const sorted = [...data.features].sort((a, b) =>
    title(a.properties).localeCompare(title(b.properties), 'es'));
  for (const { properties } of sorted) {
    if (/^\d+$/.test(properties.dpto_ccdgo)) {
      departmentSelect.add(new Option(properties.dpto_cnmbr, properties.dpto_ccdgo));
    }
  }
  departmentSelect.disabled = false;
  form.querySelector('button').disabled = false;
  status.textContent = `${data.features.length} departamentos y ${municipal.features.length.toLocaleString('es-CO')} municipios disponibles.`;
}).catch((error) => {
  status.textContent = `No se pudieron cargar las capas. ${error.message}`;
});
