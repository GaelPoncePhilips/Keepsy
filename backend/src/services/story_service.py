from sqlalchemy import text
from sqlalchemy.orm import Session

from src.dtos.story_dto import (EstadoLikeStoryDTO, HashtagTendenciaDTO, LikeStoryDTO, StoriesDeUsuarioDTO, StoryDTO,
                                VistaDTO)
from src.dtos.usuario_dto import UsuarioResumenDTO
from src.repositories.notificacion_repository import NotificacionRepository
from src.repositories.story_repository import StoryRepository
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, NotFoundError


class StoryService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = StoryRepository(db)
        self.permisos = PermisosService(db)
        self.notificaciones = NotificacionRepository(db)

    def _story_visible(self, story_id: int, yo: int, incluir_destacadas: bool = False):
        """404 si no existe, venció (salvo que esté en una destacada y se pida), hay bloqueo o es de mejores amigos
        sin estar en la lista; 403 si es privada."""
        story = self.repo.buscar_por_id(story_id)
        if story is None:
            raise NotFoundError("Story no encontrada")
        if story.usuario_id != yo:
            self.permisos.exigir_ver_contenido(story.usuario_id, yo)
            vigente = self.repo.es_vigente(story_id) or (incluir_destacadas and self.repo.en_destacada(story_id))
            if not vigente or not self.repo.permite_mejores_amigos(story_id, yo):
                raise NotFoundError("Story no encontrada")
        return story

    def publicar(self, yo: int, url_imagen: str, solo_mejores_amigos: bool, texto: str | None = None) -> StoryDTO:
        texto = (texto or "").strip() or None
        story = self.repo.crear(yo, url_imagen, solo_mejores_amigos, texto)
        if texto:
            # EXTRA: @menciones. Con "mejores amigos" solo se notifica a quien puede verla.
            from src.services.menciones import notificar_menciones
            excluir = None
            if solo_mejores_amigos:
                excluir = {r[0] for r in self.db.execute(text(
                    """SELECT u.id FROM usuario u WHERE NOT EXISTS (
                           SELECT 1 FROM mejores_amigos ma WHERE ma.usuario_id = :yo AND ma.amigo_id = u.id)"""),
                    {"yo": yo}).all()}
            notificar_menciones(self.db, yo, texto, "mencion_story", excluir=excluir, story_id=story.id)
        self.db.commit()
        return StoryDTO(**self.repo.detalle(story.id, yo))

    def obtener(self, story_id: int, yo: int) -> StoryDTO:
        """Una story suelta (notificaciones, DMs): el dueño siempre; el resto si está vigente o destacada."""
        self._story_visible(story_id, yo, incluir_destacadas=True)
        return StoryDTO(**self.repo.detalle(story_id, yo))

    # ---------- Likes (EXTRA)
    def dar_like(self, story_id: int, yo: int) -> EstadoLikeStoryDTO:
        story = self._story_visible(story_id, yo, incluir_destacadas=True)
        if self.repo.dar_like(yo, story_id):
            self.notificaciones.crear(story.usuario_id, yo, "like_story", story_id=story_id)
        self.db.commit()
        return self._estado_like(story, yo)

    def quitar_like(self, story_id: int, yo: int) -> EstadoLikeStoryDTO:
        story = self._story_visible(story_id, yo, incluir_destacadas=True)
        self.repo.quitar_like(yo, story_id)
        self.notificaciones.borrar(story.usuario_id, yo, "like_story", story_id=story_id)
        self.db.commit()
        return self._estado_like(story, yo)

    def _estado_like(self, story, yo: int) -> EstadoLikeStoryDTO:
        e = self.repo.estado_like(story.id, yo)
        # La cantidad es privada del dueño, igual que en StoryDTO.
        return EstadoLikeStoryDTO(me_gusta=e["me_gusta"], cantidad_likes=e["cantidad_likes"] if story.usuario_id == yo else 0)

    def likes(self, story_id: int, yo: int, limit: int, offset: int) -> list[LikeStoryDTO]:
        story = self.repo.buscar_por_id(story_id)
        if story is None:
            raise NotFoundError("Story no encontrada")
        if story.usuario_id != yo:
            raise ForbiddenError("Solo el dueño puede ver a quién le gustó la story")
        return [LikeStoryDTO(**f) for f in self.repo.likes(story_id, limit, offset)]

    def de_seguidos(self, yo: int) -> list[StoriesDeUsuarioDTO]:
        """Agrupadas por usuario; primero los que tienen stories sin ver, luego por la más reciente (HU7)."""
        grupos: dict[int, StoriesDeUsuarioDTO] = {}
        for f in self.repo.de_seguidos(yo):
            g = grupos.get(f["usuario_id"])
            if g is None:
                g = grupos[f["usuario_id"]] = StoriesDeUsuarioDTO(
                    usuario=UsuarioResumenDTO(id=f["usuario_id"], username=f["username"], nombre=f["nombre"]),
                    todas_vistas=True, stories=[])
            g.stories.append(StoryDTO(**f))
            g.todas_vistas = g.todas_vistas and f["vista"]
        return sorted(grupos.values(), key=lambda g: (g.todas_vistas, -g.stories[-1].fecha_publicacion.timestamp()))

    def vigentes_de(self, usuario_id: int, yo: int) -> list[StoryDTO]:
        self.permisos.exigir_ver_contenido(usuario_id, yo)
        return [StoryDTO(**f) for f in self.repo.vigentes_de(usuario_id, yo)]

    def archivo(self, yo: int, limit: int, offset: int) -> list[StoryDTO]:
        return [StoryDTO(**f) for f in self.repo.archivo(yo, limit, offset)]

    def ver(self, story_id: int, yo: int) -> None:
        story = self._story_visible(story_id, yo)
        if story.usuario_id != yo:  # el dueño no cuenta como vista (HU9)
            self.repo.registrar_vista(yo, story_id)

    def vistas(self, story_id: int, yo: int, limit: int, offset: int) -> list[VistaDTO]:
        story = self.repo.buscar_por_id(story_id)
        if story is None:
            raise NotFoundError("Story no encontrada")
        if story.usuario_id != yo:
            raise ForbiddenError("Solo el dueño puede ver quién vio la story")
        return [VistaDTO(**f) for f in self.repo.vistas(story_id, limit, offset)]

    def eliminar(self, story_id: int, yo: int) -> None:
        story = self.repo.buscar_por_id(story_id)
        if story is None:
            raise NotFoundError("Story no encontrada")
        if story.usuario_id != yo:
            raise ForbiddenError("Solo el dueño puede borrar la story")
        self.repo.eliminar(story)

    def hashtags_tendencia(self) -> list[HashtagTendenciaDTO]:
        return [HashtagTendenciaDTO(**f) for f in self.repo.hashtags_tendencia()]
