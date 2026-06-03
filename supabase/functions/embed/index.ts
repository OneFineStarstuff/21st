import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { pool, getDemoData } from "../_shared/database.ts"

const model = new Supabase.ai.Session("gte-small")

async function embedDemo(demoId: string) {
  console.log(`Starting to embed demo ${demoId}`)
  const connection = await pool.connect()

  try {
    const data = await getDemoData(connection, demoId)
    console.log("Demo data fetched successfully")

    const [codeText, demoCodeText] = await Promise.all([
      (await fetch(data.code)).text(),
      (await fetch(data.demo_code)).text(),
    ])
    console.log("Code content fetched successfully")

    const text = `${data.name} ${data.demo_name} ${data.description} ${data.tags} ${codeText} ${demoCodeText}`

    console.log("Generating embedding...")
    const output = await model.run(text, { mean_pool: true, normalize: true })
    console.log("Embedding generated successfully")

    await connection.queryObject`
      UPDATE public.demos
      SET embedding = ${JSON.stringify(output)}
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
