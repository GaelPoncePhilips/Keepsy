from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db.models.story_model import Story, StoryLike

# Columnas de story + si :yo ya la vio / le dio me gusta. Alias st. La cantidad de likes solo la ve el dueño.
COLUMNAS = """st.id, st.usuario_id, st.url_imagen, st.solo_mejores_amigos, st.fecha_publicacion,
              st.fecha_vencimiento, st.texto,
              EXISTS (SELECT 1 FROM vistas_story v WHERE v.story_id = st.id AND v.usuario_id = :yo) AS vista,
              EXISTS (SELECT 1 FROM story_like sl WHERE sl.story_id = st.id AND sl.usuario_id = :yo) AS me_gusta,
              CASE WHEN st.usuario_id = :yo THEN (SELECT count(*) FROM story_like sl JOIN usuario u_l ON u_l.id = sl.usuario_id
                                                  AND u_l.eliminado_en IS NULL WHERE sl.story_id = st.id)
                   ELSE 0 END AS cantidad_likes"""
# :yo puede ver esta story por la regla de mejores amigos (HU8)
PERMITE_MEJORES_AMIGOS = """(st.usuario_id = :yo OR NOT st.solo_mejores_amigos OR EXISTS (
    SELECT 1 FROM mejores_amigos ma WHERE ma.usuario_id = st.usuario_id AND ma.amigo_id = :yo))"""
VIGENTE = "st.fecha_vencimiento > LOCALTIMESTAMP"


class StoryRepository:
    def __init__(self, db: Session):
        self.db = db

    def _filas(self, sql: str, **p) -> list[dict]:
        return [dict(r) for r in self.db.execute(text(sql), p).mappings().all()]

    def crear(self, usuario_id: int, url_imagen: str, solo_mejores_amigos: bool, texto: str | None = None) -> Story:
        """Sin commit: el caso de uso lo hace junto con las notificaciones de menciones."""
        story = Story(usuario_id=usuario_id, url_imagen=url_imagen, solo_mejores_amigos=solo_mejores_amigos, texto=texto)
        self.db.add(story)
        self.db.flush()
        return story

    def detalle(self, story_id: int, yo: int) -> dict | None:
        filas = self._filas(f"SELECT {COLUMNAS} FROM story st WHERE st.id = :id", id=story_id, yo=yo)
        return filas[0] if filas else None

    def en_destacada(self, story_id: int) -> bool:
        return self.db.execute(text("SELECT EXISTS (SELECT 1 FROM destacada_story WHERE story_id = :id)"),
                               {"id": story_id}).scalar() is True

    # ---------- Likes (EXTRA)
    def dar_like(self, usuario_id: int, story_id: int) -> bool:
        """True si es un like nuevo. Sin commit."""
        if self.db.get(StoryLike, (usuario_id, story_id)) is not None:
            return False
        self.db.add(StoryLike(usuario_id=usuario_id, story_id=story_id))
        self.db.flush()
        return True

    def quitar_like(self, usuario_id: int, story_id: int) -> None:
        self.db.query(StoryLike).filter(StoryLike.usuario_id == usuario_id, StoryLike.story_id == story_id).delete()

    def estado_like(self, story_id: int, yo: int) -> dict:
        return dict(self.db.execute(text(
            """SELECT EXISTS (SELECT 1 FROM story_like WHERE story_id = :id AND usuario_id = :yo) AS me_gusta,
                      (SELECT count(*) FROM story_like sl JOIN usuario u ON u.id = sl.usuario_id AND u.eliminado_en IS NULL
                       WHERE sl.story_id = :id) AS cantidad_likes"""), {"id": story_id, "yo": yo}).mappings().one())

    def likes(self, story_id: int, limit: int, offset: int) -> list[dict]:
        return self._filas(
            """SELECT u.id, u.username, u.nombre, sl.fecha FROM story_like sl
               JOIN usuario u ON u.id = sl.usuario_id AND u.eliminado_en IS NULL
               WHERE sl.story_id = :sid ORDER BY sl.fecha DESC LIMIT :limit OFFSET :offset""",
            sid=story_id, limit=limit, offset=offset)

    def buscar_por_id(self, story_id: int) -> Story | None:
        return self.db.get(Story, story_id)

    def eliminar(self, story: Story) -> None:
        self.db.delete(story)
        self.db.commit()

    def es_vigente(self, story_id: int) -> bool:
        return self.db.execute(text(
            "SELECT fecha_vencimiento > LOCALTIMESTAMP FROM story WHERE id = :id"), {"id": story_id}).scalar() is True

    def permite_mejores_amigos(self, story_id: int, yo: int) -> bool:
        return self.db.execute(text(
            f"SELECT {PERMITE_MEJORES_AMIGOS} FROM story st WHERE st.id = :id"), {"id": story_id, "yo": yo}).scalar() is True

    def de_seguidos(self, yo: int) -> list[dict]:
        """Stories vigentes de los seguidos aceptados, respetando mejores amigos (HU7, HU8)."""
        return self._filas(
            f"""SELECT {COLUMNAS}, u.username, u.nombre FROM story st JOIN usuario u ON u.id = st.usuario_id AND u.eliminado_en IS NULL
                WHERE {VIGENTE} AND {PERMITE_MEJORES_AMIGOS}
                  AND st.usuario_id IN (SELECT seguido_id FROM seguidores WHERE seguidor_id = :yo AND estado = 'aceptado')
                ORDER BY st.usuario_id, st.fecha_publicacion""", yo=yo)

    def vigentes_de(self, usuario_id: int, yo: int) -> list[dict]:
        return self._filas(
            f"""SELECT {COLUMNAS} FROM story st
                WHERE st.usuario_id = :uid AND {VIGENTE} AND {PERMITE_MEJORES_AMIGOS}
                ORDER BY st.fecha_publicacion""", uid=usuario_id, yo=yo)

    def archivo(self, usuario_id: int, limit: int, offset: int) -> list[dict]:
        """Todas las stories del dueño, incluidas vencidas (HU7)."""
        return self._filas(
            f"""SELECT {COLUMNAS} FROM story st WHERE st.usuario_id = :yo
                ORDER BY st.fecha_publicacion DESC LIMIT :limit OFFSET :offset""",
            yo=usuario_id, limit=limit, offset=offset)

    def registrar_vista(self, usuario_id: int, story_id: int) -> None:
        """Una vista por usuario por story (HU9)."""
        self.db.execute(text(
            "INSERT INTO vistas_story (usuario_id, story_id) VALUES (:u, :s) ON CONFLICT DO NOTHING"),
            {"u": usuario_id, "s": story_id})
        self.db.commit()

    def vistas(self, story_id: int, limit: int, offset: int) -> list[dict]:
        return self._filas(
            """SELECT u.id, u.username, u.nombre, v.fecha,
                      EXISTS (SELECT 1 FROM story_like sl WHERE sl.story_id = v.story_id AND sl.usuario_id = u.id) AS me_gusta
               FROM vistas_story v JOIN usuario u ON u.id = v.usuario_id AND u.eliminado_en IS NULL
               WHERE v.story_id = :sid ORDER BY v.fecha DESC LIMIT :limit OFFSET :offset""",
            sid=story_id, limit=limit, offset=offset)

    def hashtags_tendencia(self) -> list[dict]:
        """Top 10 por cantidad de posts de las últimas 24 h, solo cuentas públicas (HU11)."""
        return self._filas(
            """SELECT h.nombre, count(*) AS cantidad_posts
               FROM hashtags_post hp JOIN hashtag h ON h.id = hp.hashtag_id
               JOIN post p ON p.id = hp.post_id JOIN usuario u ON u.id = p.usuario_id AND u.eliminado_en IS NULL
               WHERE NOT u.es_privada AND p.fecha_publicacion > LOCALTIMESTAMP - INTERVAL '24 hours'
               GROUP BY h.nombre ORDER BY cantidad_posts DESC, h.nombre LIMIT 10""")
