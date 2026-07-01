from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    dubai_pulse_client_id: str = ""
    dubai_pulse_client_secret: str = ""
    dubai_pulse_token_url: str = ""
    dubai_pulse_transactions_url: str = ""

    geoapify_api_key: str = ""

    cors_origins: str = "http://localhost:3000"

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
