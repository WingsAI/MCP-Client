//function to verify string is markdown or text
export function verifyFileType(fileContent: string): "markdown" | "plain" {
  if (/^#{1,6}\s/.test(fileContent)) {
    return "markdown";
  }

  const markdownSyntax = [
    /\*\*.*?\*\*/, // Bold
    /_.*?_/, // Italic
    /\[.*?\]\(.*?\)/, // Links
    /`.*?`/, // Inline code
    /```[\s\S]*?```/, // Code blocks
    /^[-*+]\s/, // Lists
  ];

  for (const syntax of markdownSyntax) {
    if (syntax.test(fileContent)) {
      return "markdown";
    }
  }

  return "plain";
}
