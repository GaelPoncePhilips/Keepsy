-- 006: foto de perfil elegida por el usuario (NULL = avatar por defecto con forma de estrella).
BEGIN;
ALTER TABLE Usuario ADD COLUMN IF NOT EXISTS foto_url VARCHAR(500);
COMMIT;
