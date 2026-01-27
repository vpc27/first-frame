type AppConfig = {
  database: {
    url: string;
  };
  ollama: {
    host: string;
    model: string;
  };
  env: "development" | "production" | "test";
  port: number;
};

function getConfig(): AppConfig {
  const env = (process.env.NODE_ENV as AppConfig["env"]) || "development";

  const dbUrl = process.env.DATABASE_URL ?? "file:./database/gallery.db";

  const ollamaHost = process.env.OLLAMA_HOST ?? "http://localhost:11434";
  const ollamaModel = process.env.OLLAMA_MODEL ?? "llava:7b";

  const port = Number(process.env.PORT ?? "3000");

  return {
    database: {
      url: dbUrl,
    },
    ollama: {
      host: ollamaHost,
      model: ollamaModel,
    },
    env,
    port,
  };
}

export const config: AppConfig = getConfig();

