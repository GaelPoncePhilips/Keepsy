-- 007: publicaciones con varias fotos (carrusel). url_imagen es la primera; el resto va acá, en orden.
BEGIN;
ALTER TABLE Post ADD COLUMN IF NOT EXISTS imagenes_extra VARCHAR[] NOT NULL DEFAULT '{}';
COMMIT;
