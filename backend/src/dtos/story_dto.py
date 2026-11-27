from datetime import datetime

from pydantic import BaseModel

from src.dtos.usuario_dto import UsuarioResumenDTO


class StoryDTO(BaseModel):
    id: int
    usuario_id: int
    url_imagen: str
    solo_mejores_amigos: bool
    fecha_publicacion: datetime
    fecha_vencimiento: datetime
    vista: bool = False  # si :yo ya la vio
    texto: str | None = None  # EXTRA: texto sobre la story (puede llevar @menciones)
    me_gusta: bool = False  # EXTRA: si :yo le dio me gusta
    cantidad_likes: int = 0  # EXTRA: solo con valor para el dueño

    model_config = {"from_attributes": True}


class StoriesDeUsuarioDTO(BaseModel):
    usuario: UsuarioResumenDTO
    todas_vistas: bool
    stories: list[StoryDTO]


class VistaDTO(UsuarioResumenDTO):
    fecha: datetime
    me_gusta: bool = False  # EXTRA: además de verla, le dio me gusta


class LikeStoryDTO(UsuarioResumenDTO):
    fecha: datetime


class EstadoLikeStoryDTO(BaseModel):
    me_gusta: bool
    cantidad_likes: int


class HashtagTendenciaDTO(BaseModel):
    nombre: str
    cantidad_posts: int
