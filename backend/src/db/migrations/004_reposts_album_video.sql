-- 004: republicaciones (reposts), videos en álbumes y likes/comentarios de items de álbum.
BEGIN;

CREATE TABLE repost (
    usuario_id INT NOT NULL REFERENCES Usuario(id) ON DELETE CASCADE,   -- quién republica
    post_id    INT NOT NULL REFERENCES Post(id)    ON DELETE CASCADE,
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, post_id)
);
CREATE INDEX idx_repost_post ON repost (post_id);
CREATE INDEX idx_repost_usuario_fecha ON repost (usuario_id, fecha DESC);

ALTER TABLE album_item
    ADD COLUMN tipo VARCHAR(5) NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
    ADD COLUMN url_video VARCHAR,
    ADD CHECK ((tipo = 'video') = (url_video IS NOT NULL));

CREATE TABLE album_item_like (
    usuario_id INT NOT NULL REFERENCES Usuario(id)    ON DELETE CASCADE,
    item_id    INT NOT NULL REFERENCES album_item(id) ON DELETE CASCADE,
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (usuario_id, item_id)
);
CREATE INDEX idx_album_item_like_item ON album_item_like (item_id);

CREATE TABLE album_item_comentario (
    id         SERIAL PRIMARY KEY,
    item_id    INT NOT NULL REFERENCES album_item(id) ON DELETE CASCADE,
    usuario_id INT NOT NULL REFERENCES Usuario(id)    ON DELETE CASCADE,
    texto      VARCHAR(300) NOT NULL CHECK (length(trim(texto)) > 0),
    fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_album_item_comentario_item ON album_item_comentario (item_id, fecha);

COMMIT;
