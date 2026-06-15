import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts"
import { handleEmbedRequest } from "../_shared/embed-utils.ts"

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
})

Deno.serve(async (req: Request) => {
  return handleEmbedRequest(req, async (connection, demoId, data) => {
    const text = `${data.name}. ${data.demo_name}. ${data.description}. ${data.tags}`
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    })
    const output = embeddingResponse.data[0].embedding
    await connection.queryObject`
      UPDATE public.demos
      SET embedding_oai = ${JSON.stringify(output)}
      WHERE id = ${demoId}
    `
  })
})
