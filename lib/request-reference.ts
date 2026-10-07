export function requestReference(requestId: string) {
  const shortId = requestId.split("-")[0]?.toUpperCase();
  return `AP-${shortId || requestId.slice(0, 8).toUpperCase()}`;
}
