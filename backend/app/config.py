import os

from pydantic_settings import BaseSettings

_DEFAULT_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")


class Settings(BaseSettings):
    dubai_pulse_client_id: str = ""
    dubai_pulse_client_secret: str = ""
    dubai_pulse_token_url: str = ""
    dubai_pulse_transactions_url: str = ""

    geoapify_api_key: str = ""

    cors_origins: str = "http://localhost:3000"

    # Where DLD CSVs / KHDA XLSX are loaded from. Override in production to point
    # at a mounted disk (e.g. DATA_DIR=/var/data on Render) so real data
    # survives redeploys without being committed to the repo.
    data_dir: str = _DEFAULT_DATA_DIR

    @property
    def dubai_pulse_configured(self) -> bool:
        return bool(
            self.dubai_pulse_client_id
            and self.dubai_pulse_client_secret
            and self.dubai_pulse_transactions_url
        )

    @property
    def geoapify_configured(self) -> bool:
        return bool(self.geoapify_api_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
