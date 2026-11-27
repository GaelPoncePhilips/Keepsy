import re

from sqlalchemy.orm import Session

from src.db.models.usuario_model import Usuario
from src.dtos.post_dto import ComentarioDTO, CreatePostDTO, PostDetalleDTO
from src.dtos.usuario_dto import UsuarioResumenDTO
from src.repositories.post_repository import PostRepository
from src.services.menciones import extraer_menciones, notificar_menciones
from src.services.permisos_service import PermisosService
from src.utils.errors import ForbiddenError, NotFoundError

# '#' no precedido por letra/número (evita "a#b"); \w incluye acentos y ñ.
HASHTAG_RE = re.compile(r"(?<!\w)#(\w{1,100})")


def extraer_hashtags(texto: str | None) -> list[str]:
    """Hashtags en minúscula, sin repetir y en orden de aparición (HU2)."""
    return list(dict.fromkeys(h.lower() for h in HASHTAG_RE.findall(texto or "")))


class PostService:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PostRepository(db)
        self.permisos = PermisosService(db)

    def _post_visible(self, post_id: int, yo: int):
        """El post si :yo puede verlo; 404 si no existe o hay bloqueo, 403 si es privado (HU4/HU5)."""
        post = self.repo.buscar_por_id(post_id)
        if post is None:
            raise NotFoundError("Post no encontrado")
        self.permisos.exigir_ver_contenido(post.usuario_id, yo)
        return post

    def _sin_acceso(self, dueno_id: int, usernames: list[str]) -> set[int]:
        """Ids de los usuarios mencionados que no pueden ver el contenido de :dueno_id."""
        dueno = self.permisos.usuarios.buscar_activo(dueno_id)
        fuera: set[int] = set()
        for nombre in usernames:
            u = self.permisos.usuarios.buscar_por_username(nombre)
            if u is None or dueno is None:
                continue
            if self.permisos.usuarios.hay_bloqueo(dueno_id, u.id) or not self.permisos.puede_ver_contenido(dueno, u.id):
                fuera.add(u.id)
        return fuera

    # ---------- posts
    def publicar(self, dto: CreatePostDTO) -> PostDetalleDTO:
        post = self.repo.crear_con_hashtags(dto.model_dump(), extraer_hashtags(dto.descripcion))
        notificar_menciones(self.db, dto.usuario_id, post.descripcion, "mencion", post_id=post.id)
        self.db.commit()
        return PostDetalleDTO(**self.repo.detalle(post.id, dto.usuario_id))

    def obtener(self, post_id: int, yo: int) -> PostDetalleDTO:
        self._post_visible(post_id, yo)
        return PostDetalleDTO(**self.repo.detalle(post_id, yo))

    def listar_de_usuario(self, usuario_id: int, yo: int, tipo: str | None, limit: int, offset: int):
        self.permisos.exigir_ver_contenido(usuario_id, yo)
        return [PostDetalleDTO(**f) for f in self.repo.listar_por_usuario(usuario_id, yo, tipo, limit, offset)]

    def editar(self, post_id: int, yo: int, descripcion: str | None) -> PostDetalleDTO:
        post = self.repo.buscar_por_id(post_id)
        if post is None:
            raise NotFoundError("Post no encontrado")
        if post.usuario_id != yo:
            raise ForbiddenError("Solo el autor puede editar el post")
        antes = set(extraer_menciones(post.descripcion))
        self.repo.editar_descripcion(post, descripcion, extraer_hashtags(descripcion))
        nuevas = " ".join(f"@{m}" for m in extraer_menciones(descripcion) if m not in antes)
        notificar_menciones(self.db, yo, nuevas, "mencion", post_id=post_id)
        self.db.commit()
        return PostDetalleDTO(**self.repo.detalle(post_id, yo))

    def editar_comentario(self, comentario_id: int, yo: int, texto: str) -> ComentarioDTO:
        c = self.repo.buscar_comentario(comentario_id)
        if c is None:
            raise NotFoundError("Comentario no encontrado")
        if c.usuario_id != yo:
            raise ForbiddenError("Solo el autor puede editar el comentario")
        self.repo.editar_comentario(c, texto)
        autor = self.permisos.usuarios.buscar_activo(yo)
        return ComentarioDTO(id=c.id, post_id=c.post_id, usuario_id=c.usuario_id, autor_username=autor.username,
                             texto=c.texto, fecha=c.fecha, fecha_edicion=c.fecha_edicion)

    def eliminar(self, post_id: int, yo: int) -> None:
        post = self.repo.buscar_por_id(post_id)
        if post is None:
            raise NotFoundError("Post no encontrado")
        if post.usuario_id != yo:
            raise ForbiddenError("Solo el autor puede borrar el post")
        self.repo.eliminar(post)

    # ---------- feed y recomendaciones
    def feed(self, actual: Usuario, limit: int, offset: int):
        filas = self.repo.feed(actual.id, actual.reels_desactivados, limit, offset)
        return [PostDetalleDTO(**f) for f in filas]

    def por_hashtag(self, nombre: str, yo: int, limit: int, offset: int):
        return [PostDetalleDTO(**f) for f in self.repo.por_hashtag(nombre.lstrip("#").lower(), yo, limit, offset)]

    # ---------- likes y comentarios (HU5)
    def dar_like(self, post_id: int, yo: int) -> PostDetalleDTO:
        post = self._post_visible(post_id, yo)
        self.repo.dar_like(yo, post)
        return PostDetalleDTO(**self.repo.detalle(post_id, yo))

    def quitar_like(self, post_id: int, yo: int) -> None:
        post = self.repo.buscar_por_id(post_id)
        if post is None:
            raise NotFoundError("Post no encontrado")
        self.repo.quitar_like(yo, post)

    def likes(self, post_id: int, yo: int, limit: int, offset: int):
        self._post_visible(post_id, yo)
        return [UsuarioResumenDTO(**f) for f in self.repo.usuarios_que_dieron_like(post_id, limit, offset)]

    def comentar(self, post_id: int, yo: int, texto: str) -> ComentarioDTO:
        post = self._post_visible(post_id, yo)
        c = self.repo.comentar(yo, post, texto)
        # El dueño ya recibe 'comentario'; los mencionados además tienen que poder ver el post.
        excluir = {post.usuario_id} | self._sin_acceso(post.usuario_id, extraer_menciones(texto))
        notificar_menciones(self.db, yo, texto, "mencion_comentario", excluir, post_id=post.id, comentario_id=c.id)
        self.db.commit()
        autor = self.permisos.usuarios.buscar_activo(yo)
        return ComentarioDTO(id=c.id, post_id=c.post_id, usuario_id=c.usuario_id,
                             autor_username=autor.username, texto=c.texto, fecha=c.fecha)

    def comentarios(self, post_id: int, yo: int, limit: int, offset: int):
        self._post_visible(post_id, yo)
        return [ComentarioDTO(**f) for f in self.repo.comentarios(post_id, limit, offset)]

    def eliminar_comentario(self, comentario_id: int, yo: int) -> None:
        c = self.repo.buscar_comentario(comentario_id)
        if c is None:
            raise NotFoundError("Comentario no encontrado")
        post = self.repo.buscar_por_id(c.post_id)
        if yo not in (c.usuario_id, post.usuario_id):
            raise ForbiddenError("Solo el autor del comentario o el dueño del post pueden borrarlo")
        self.repo.eliminar_comentario(c)
