/** Remove release-title boilerplate; content stays text until the safe renderer. */
export function meaningfulReleaseNotes(notes?: string): string {
  if (!notes) return "";
  return notes
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => {
      const text = line
        .replace(/^\s*#{1,6}\s*/, "")
        .replace(/\*\*/g, "")
        .trim();
      return (
        !/^(?:(?:Shihen|Focus)\s+)?v?\d+\.\d+\.\d+(?:[-+][\w.-]+)?(?:\s*[\/—–-]\s*Update available)?$/i.test(text) &&
        !/^(?:Update available|Release notes|What's new)[:.!]?$/i.test(text) &&
        !/^[-_=]{3,}$/.test(text)
      );
    })
    .join("\n")
    .trim();
}
