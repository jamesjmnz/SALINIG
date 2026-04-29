import logging

from fastapi import FastAPI
from langchain_community.cache import SQLiteCache
from langchain_core.globals import set_llm_cache

from app.api.v1.router import api_router

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s – %(message)s")

set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))

app = FastAPI()

app.include_router(api_router, prefix="/api/v1")

@app.get("/")
def root():
    return {"message": "hello world"}