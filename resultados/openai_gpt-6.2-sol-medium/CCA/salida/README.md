# Savia

Carrito de compra adaptable en español con un catálogo de artículos para el hogar.

## Ejecutar

Con Node.js 20 o posterior, ejecuta `npm start` y abre `http://localhost:3000`. No hay dependencias de instalación. Usa `PORT=8080 npm start` para cambiar de puerto.

El carrito empieza con tres productos de muestra en la primera visita. Puedes ajustar las cantidades, retirar artículos, deshacer la última retirada y probar el cupón `SAVIA10`. El envío estándar cuesta 4,95 € y es gratuito a partir de 75 € de subtotal. Finalizar la compra abre la confirmación de un pedido simulado.

## Organización

- `public/js/catalog.js` contiene los productos, sus categorías, precios en céntimos y existencias de muestra. Cada identificador de producto tiene una imagen WebP del mismo nombre en `public/assets`.
- `public/js/cart.js` concentra las reglas del carrito, los cálculos y el formato versionado de persistencia. Puedes ejecutar las pruebas con `npm test`.
- `public/js/views.js` y `public/js/app.js` conectan el catálogo, la navegación y el carrito con la interfaz. El catálogo muestra lotes de seis productos y filtra por colección.
- El carrito se guarda en el navegador y se refleja en las demás pestañas del mismo origen. El servidor Node sirve los archivos de la aplicación.

Para un despliegue comercial con varios usuarios, los precios, cupones, existencias y creación de pedidos se deben validar en un servicio de comercio con almacenamiento compartido y una pasarela de pago. Esta versión simula el pedido en el navegador.

## Fotografía

Las seis imágenes de producto se generaron con la herramienta integrada de generación de imágenes y se exportaron como WebP en `public/assets`.

<details>
<summary>Prompt de generación</summary>

Use case: product-mockup. Generate ONE landscape contact sheet, exact 3 columns × 2 rows of six equally sized SQUARE photos, seamless edge to edge with absolutely no gutters, borders, lettering or design overlay. Every tile is an individual photorealistic ecommerce studio still life, object centered with generous padding so it can be cropped square. Cohesive modern Spanish slow-living home goods, tactile matte textures, warm daylight, contemporary premium editorial photography, large soft shadows. Top left: one speckled ivory ceramic coffee mug with round loop handle facing right, on seamless warm light beige. Top middle: folded dark moss olive green linen tea towel, loosely folded with natural soft creases, against warm beige. Top right: centered unlit amber glass candle jar with minimalist cream blank label and cotton wick against beige. Bottom left: elegant shallow ivory speckled stoneware bowl, viewed from 40 degrees against oatmeal backdrop. Bottom middle: natural unbleached thick cotton canvas tote bag with tall loop handles, standing against pale beige. Bottom right: minimalist smoky olive green translucent glass carafe with round narrow neck against warm ivory. Exact clean grid boundaries at one and two thirds horizontally and at half vertically. Do not add extra objects. Consistent warm cream color grading, high-end product art direction.

</details>
