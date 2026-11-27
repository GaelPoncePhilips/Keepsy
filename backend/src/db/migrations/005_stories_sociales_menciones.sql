-- 005: likes y texto en stories, stories en DMs (respuestas y reenvíos) y notificaciones de menciones y likes de story.
BEGIN;

-- Texto sobre la story (puede llevar @menciones).
ALTER TABLE Story ADD COLUMN texto VARCHAR(200);

CREATE TABLE story_like (
    usuario_id INT NOT NULL REFERENCES Usuario(id) ON DELETE CASCADE,
    story_id   INT NOT NULL REFERENCES Story(id)   ON DELETE CASCADE,
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, story_id)
);
CREATE INDEX idx_story_like_story ON story_like (story_id, fecha DESC);

-- Mensaje con story: respuesta (con texto) o story reenviada (sin texto).
-- El CHECK de contenido se valida en la API: con ON DELETE SET NULL, borrar un post o una story
-- compartidos sin texto violaba el CHECK y bloqueaba el borrado.
ALTER TABLE Mensaje ADD COLUMN story_id INT REFERENCES Story(id) ON DELETE SET NULL;
ALTER TABLE Mensaje DROP CONSTRAINT IF EXISTS mensaje_check;

ALTER TABLE Notificacion ADD COLUMN story_id INT REFERENCES Story(id) ON DELETE CASCADE;
ALTER TABLE Notificacion DROP CONSTRAINT IF EXISTS notificacion_tipo_check;
ALTER TABLE Notificacion ADD CONSTRAINT notificacion_tipo_check CHECK (tipo IN (
    'seguidor_nuevo', 'solicitud', 'solicitud_aceptada', 'like', 'comentario', 'invitacion_album',
    'mencion', 'mencion_comentario', 'like_story', 'mencion_story'));

COMMIT;
