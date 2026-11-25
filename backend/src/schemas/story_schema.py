from pydantic import BaseModel, Field

from src.schemas.tipos import UrlMedia


class CreateStorySchema(BaseModel):
    url_imagen: UrlMedia
    solo_mejores_amigos: bool = False
