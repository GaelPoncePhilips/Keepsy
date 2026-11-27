from fastapi import APIRouter, Depends, Query, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from src.db.connection import get_db
from src.db.models.usuario_model import Usuario
from src.dtos.usuario_dto import (
    CreateUsuarioDTO, PerfilDTO, UpdateUsuarioDTO, UsuarioResponseDTO, UsuarioResumenDTO,
)
from src.middlewares.auth_middleware import get_current_user, verificar_dueno
from src.routers.deps import Pagina
from src.schemas.usuario_schema import CreateUsuarioSchema, UpdateUsuarioSchema
from src.services.permisos_service import PermisosService
from src.services.usuario_service import UsuarioService

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.post("", response_model=UsuarioResponseDTO, status_code=status.HTTP_201_CREATED)
def registrar(payload: CreateUsuarioSchema, db: Session = Depends(get_db)):
    return UsuarioService(db).registrar(CreateUsuarioDTO(**payload.model_dump()))


@router.get("", response_model=list[UsuarioResumenDTO])
def buscar(q: str = Query(min_length=1, max_length=30), pag: Pagina = Depends(),
           db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return UsuarioService(db).buscar(q, actual.id, pag.limit, pag.offset)


@router.get("/{usuario_id}/resumen", response_model=UsuarioResumenDTO)
def resumen(usuario_id: int, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    """Usuario por id (para datos que solo traen el id, p. ej. solicitudes o items de álbum). 404 si hay bloqueo."""
    return UsuarioResumenDTO.model_validate(PermisosService(db).usuario_visible(usuario_id, actual.id))


@router.get("/{username}/avatar", include_in_schema=False)
def avatar(username: str, db: Session = Depends(get_db)):
    """Público (lo usan las <img>): redirige a la foto de perfil; 404 si no tiene (el front dibuja la estrella)."""
    from src.repositories.usuario_repository import UsuarioRepository
    u = UsuarioRepository(db).buscar_por_username(username)
    if u is None or u.eliminado_en is not None or not u.foto_url:
        return Response(status_code=404, headers={"Cache-Control": "no-cache"})
    return RedirectResponse(u.foto_url, status_code=302, headers={"Cache-Control": "no-cache"})


@router.get("/{username}", response_model=PerfilDTO)
def perfil(username: str, db: Session = Depends(get_db), actual: Usuario = Depends(get_current_user)):
    return UsuarioService(db).perfil(username, actual.id)


@router.patch("/{usuario_id}", response_model=UsuarioResponseDTO)
def actualizar(
    usuario_id: int,
    payload: UpdateUsuarioSchema,
    db: Session = Depends(get_db),
    actual: Usuario = Depends(get_current_user),
):
    verificar_dueno(usuario_id, actual)
    return UsuarioService(db).actualizar(usuario_id, UpdateUsuarioDTO(**payload.model_dump(exclude_unset=True)))
