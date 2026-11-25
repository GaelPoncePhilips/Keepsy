from typing import Literal

from pydantic import BaseModel, Field, model_validator

from src.schemas.tipos import UrlMedia


# ---------- Destacadas
class CreateDestacadaSchema(BaseModel):
    titulo: str = Field(min_length=1, max_length=50)
    portada_url: UrlMedia | None = None
    story_ids: list[int] = Field(min_length=1)


class UpdateDestacadaSchema(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=50)
    portada_url: UrlMedia | None = None


class AgregarStorySchema(BaseModel):
    story_id: int


class OrdenDestacadasSchema(BaseModel):
    destacada_ids: list[int]


class OrdenStoriesSchema(BaseModel):
    story_ids: list[int]


# ---------- Álbumes
class CreateAlbumSchema(BaseModel):
    titulo: str = Field(min_length=1, max_length=60)
    descripcion: str | None = Field(default=None, max_length=255)
    portada_url: UrlMedia | None = None


class UpdateAlbumSchema(BaseModel):
    titulo: str | None = Field(default=None, min_length=1, max_length=60)
    descripcion: str | None = Field(default=None, max_length=255)
    portada_url: UrlMedia | None = None


class InvitarSchema(BaseModel):
    usuario_id: int


class CreateAlbumItemSchema(BaseModel):
    url_imagen: UrlMedia  # en un video, la portada
    descripcion: str | None = Field(default=None, max_length=500)
    tipo: Literal["foto", "video"] = "foto"
    url_video: UrlMedia | None = None

    @model_validator(mode="after")
    def validar_video(self):
        if (self.tipo == "video") != (self.url_video is not None):
            raise ValueError("Un video necesita url_video y una foto no lo lleva")
        return self


# ---------- DMs
class CreateConversacionSchema(BaseModel):
    participantes: list[int] = Field(min_length=1, max_length=31)
    nombre: str | None = Field(default=None, max_length=60)


class CreateMensajeSchema(BaseModel):
    texto: str | None = Field(default=None, min_length=1, max_length=1000)
    post_id: int | None = None

    @model_validator(mode="after")
    def algo(self):
        if self.texto is None and self.post_id is None:
            raise ValueError("El mensaje necesita texto o post_id")
        return self
