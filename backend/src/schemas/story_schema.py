from pydantic import BaseModel, Field

from src.schemas.tipos import UrlMedia


class CreateStorySchema(BaseModel):
    url_imagen: UrlMedia
    solo_mejores_amigos: bool = False
    texto: str | None = Field(default=None, max_length=200)  # EXTRA: texto sobre la story, con @menciones
