import dotenv from "dotenv";
import fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";

import { MessageRequest, MessageResponse } from "./types/index.js";
import axios from "axios";

dotenv.config();

const app = fastify({ logger: true });

app.register(fastifyMultipart);
app.post("/messages:streaming", async (request, reply) => {
  try {
    const body = request.body as MessageRequest;

    if (!body || !body.content) {
      return reply
        .status(400)
        .send({ status: "error", message: "Invalid request body" });
    }

    const answer = "";

    const difyResponse = await axios.post(
      "https://api.dify.ai/v1/chat-messages",
      {
        inputs: {},
        query: body.content,
        response_mode: "streaming",
        conversation_id: "",
        user: "FellowMe_API",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
        },
        responseType: "stream",
      }
    );

    difyResponse.data.on("data", (chunk: any) => {
      console.log("Received chunk:", chunk);
    });

    difyResponse.data.on("end", () => {
      console.log("Stream ended");
    });

    const response: MessageResponse = {
      role: "assistant",
      content: "",
      timestamp: new Date(),
      type: "text",
      subtype: "plain",
    };

    reply.status(200).send(response);
  } catch (error) {
    reply
      .status(500)
      .send({ status: "error", message: "Internal Server Error" });
  }
});

app.post("/messages", async (request, reply) => {
  try {
    const body = request.body as MessageRequest;

    if (!body || !body.content) {
      return reply
        .status(400)
        .send({ status: "error", message: "Invalid request body" });
    }

    const difyResponse = await axios.post(
      "https://api.dify.ai/v1/chat-messages",
      {
        inputs: {},
        query: body.content,
        response_mode: "blocking",
        conversation_id: "",
        user: "FellowMe_API",
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const response: MessageResponse = {
      role: "assistant",
      content: difyResponse.data.answer,
      timestamp: new Date(),
      type: "text",
      subtype: "plain",
    };

    reply.status(200).send(response);
  } catch (error) {
    reply
      .status(500)
      .send({ status: "error", message: "Internal Server Error" });
  }
});

app.post("/uploads", async (request, reply) => {
  try {
    const data = await request.file();
    reply.status(200).send({
      status: "success",
      message: "File uploaded successfully",
      filename: data?.filename,
    });
  } catch (error) {
    reply
      .status(500)
      .send({ status: "error", message: "Internal Server Error" });
  }
});

app.get("/health", (request, reply) => {
  reply.status(200).send({ status: "ok", timestamp: new Date() });
});

app.listen({ port: 3000 }, (err, address) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`Server is running at ${address}`);
});
