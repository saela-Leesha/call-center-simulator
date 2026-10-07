export type PublicCall<T extends { audioData?: string | null }> = Omit<T, "audioData"> & {
  hasAudio: boolean;
};

/** Strip the base64 recording from call payloads; fetch it on demand instead. */
export function publicCall<T extends { audioData?: string | null }>(call: T): PublicCall<T> {
  const { audioData, ...rest } = call;
  return { ...(rest as Omit<T, "audioData">), hasAudio: Boolean(audioData) };
}
