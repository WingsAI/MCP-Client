export function formatText(text: string): string {
  let result = text.replace(/\n\s*\d+/g, "\n");
  result = result.replace(/\n{2,}/g, "\n");

  return result.replace(/\n/g, "<br>");
}
