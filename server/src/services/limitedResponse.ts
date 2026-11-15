/** Bound provider responses even if they do not advertise a content length. */
export async function limitedText(response: Response, maxBytes: number) {
  if (!response.body) throw new Error('Empty provider response');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return Buffer.concat(chunks).toString('utf8');
      length += value.byteLength;
      if (length > maxBytes) throw new Error('Provider response too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
