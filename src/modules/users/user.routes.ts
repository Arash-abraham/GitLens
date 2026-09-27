import type { FastifyInstance } from "fastify";
import { getUser, importUser } from "./user.service";

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.post("/users/:username/import", async (request, reply) => {
    const { username } = request.params as {
      username: string;
    };

    const user = await importUser(username);

    return reply.send(user);
  });

  app.get("/users/:username", async (request, reply) => {
    const { username } = request.params as {
      username: string;
    };

    const user = await getUser(username);

    if (!user) {
      return reply.code(404).send({
        message: "User not found",
      });
    }

    return reply.send(user);
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      service: "gitlens",
    };
  });

}