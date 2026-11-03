AZOBSS v1500 LOCAL PRODUCT IMAGES

Run PREPARE-LOCAL-PC-IMAGES.bat from the website root before deployment.
The preparer keeps existing valid local images, then discovers missing exact Shopify product images from each exact /products/<handle>.js endpoint (including ALL IT hardware whose catalog image field is blank).
It downloads and validates the exact product/variant image, maps it by product ID/name, enables strict local-image mode for PC Builds + Hardware Shop, and creates the v1500 self-contained deployment ZIP.

Do not replace an unknown exact product image with a generic banner or generated image.
If an exact product image cannot be obtained, the product image remains unavailable rather than showing a wrong image.
