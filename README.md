# Ejercicio 11 · Visor geográfico de Colombia

Con GeoServer iniciado en el puerto 8080, ejecuta `node serve.mjs` desde esta carpeta. Abre http://127.0.0.1:8000/.

El servidor local entrega los archivos de `webapp/` y reenvía las solicitudes de lectura WMS y WFS al espacio `taller`. Así el navegador usa un solo origen sin cambiar la configuración de GeoServer. La guía usa Python HTTP Server para servir los archivos. Esta variante usa Node.js porque Python no estaba disponible y GeoServer no devolvió un encabezado CORS para el origen local probado.

Para comprobar el visor, alterna las capas WMS con el control de capas, busca Medellín, filtra municipios por Antioquia y haz clic en una entidad. La búsqueda usa los municipios del filtro activo, si hay uno seleccionado. La leyenda identifica las capas vectoriales WFS.

GitHub Pages necesita una fuente de datos accesible para sus visitantes. Si se publica una edición estática con GeoJSON exportado, el filtro de esa edición se aplica en el navegador. La demostración local permite comprobar el WMS, el WFS y el filtro CQL en vivo.
