import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts"

export const getOpenAIClient = () => new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
})

export async function generateEmbedding(openai: any, text: string) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  })
  return response.data[0].embedding
}
