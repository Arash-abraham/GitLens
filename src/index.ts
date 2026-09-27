import Fastify from "fastify";
import { userRoutes } from "./modules/users/user.routes";

const app = Fastify({
  logger: true,
});

async function start(): Promise<void> {
  try {
    await app.register(userRoutes);

    await app.listen({
      port: 3000,
      host: "0.0.0.0",
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void start();