import dotenv from "dotenv";
import fastify from "fastify";
import fastifyMultipart from "@fastify/multipart";
import { formatText } from "./utils/format-text.js";
import { verifyFileType } from "./utils/verify-file-type.js";
import { MessageRequest, MessageResponse } from "./types/index.js";
import axios from "axios";

dotenv.config();

const app = fastify({ logger: true, bodyLimit: 104857600 }); // 100 MB

app.register(fastifyMultipart);
app.post("/messages:streaming", async (request, reply) => {
  try {
    const body = request.body as MessageRequest;

    if (!body || !body.content) {
      return reply
        .status(400)
        .send({ status: "error", message: "Invalid request body" });
    }

    const difyResponse = await axios({
      method: "post",
      url: "https://api.dify.ai/v1/chat-messages",
      data: {
        inputs: {},
        query: body.content,
        response_mode: "streaming",
        conversation_id: "",
        user: "FellowMe_API",
      },
      headers: {
        Authorization: `Bearer ${process.env.DIFY_API_KEY}`,
      },
      responseType: "stream",
    });

    let answer = "";
    for await (const chunk of difyResponse.data) {
      const lines = chunk.toString().split(/\r?\n/);
      for (const line of lines) {
        if (line.trim().startsWith("data:")) {
          try {
            const json = JSON.parse(line.replace("data:", "").trim());
            if (json.event === "message" && typeof json.answer === "string") {
              answer += json.answer;
            }
          } catch (e) {
            // Ignora linhas que não são JSON válidos
          }
        }
      }
    }

    const response: MessageResponse = {
      role: "assistant",
      content: answer,
      timestamp: new Date(),
      type: "text",
      subtype: "plain",
    };

    reply.status(200).send(response);
  } catch (error) {
    console.error("Erro no endpoint:", error);
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
        timeout: 60000,
        maxContentLength: 10000,
      }
    );

    const response: MessageResponse = {
      role: "assistant",
      content: difyResponse?.data?.answer
        ? formatText(difyResponse.data.answer)
        : "",
      timestamp: new Date(),
      type: "text",
      subtype: verifyFileType(difyResponse.data.answer || ""),
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

app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error("Error starting server:", err);
    process.exit(1);
  }
  console.log(`Server is running at ${address}`);
});
