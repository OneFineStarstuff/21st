import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import OpenAI from "https://deno.land/x/openai@v4.69.0/mod.ts"
import { pool, getDemoData } from "../_shared/database.ts"

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY"),
})

async function embedDemo(demoId: string) {
  console.log(`Starting to embed demo ${demoId}`)
  const connection = await pool.connect()

  try {
    const data = await getDemoData(connection, demoId)
    const text = `${data.name}. ${data.demo_name}. ${data.description}. ${data.tags}`

    console.log("Generating embedding...")
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
      encoding_format: "float",
    })
    const output = embeddingResponse.data[0].embedding
    console.log("Embedding generated successfully")

    await connection.queryObject`
      UPDATE public.demos
      SET embedding_oai = ${JSON.stringify(output)}
      WHERE id = ${demoId}
    `
    console.log(`Successfully embedded demo ${demoId}`)
  } finally {
    connection.release()
  }
}

Deno.serve(async (req: Request) => {
  const { demoId, record } = await req.json()
  const finalId = demoId ?? record?.id
  if (finalId) EdgeRuntime.waitUntil(embedDemo(finalId))
  return new Response("ok")
})
