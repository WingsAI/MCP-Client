export interface MessageResponse {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  type: "text" | "image" | "video" | "audio";
  subtype?: "markdown" | "html" | "plain" | "json";
}

export interface MessageRequest {
  content: string;
}
