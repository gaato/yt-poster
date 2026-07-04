export function escapeMentions(text: string): string {
  return text.replaceAll(/@(\w+)/g, "@\u200b$1");
}

export function buildPostText(title: string, youtubeUrl: string): string {
  return `Now I'm watching...\n\n${escapeMentions(title)}\n${youtubeUrl}`;
}
