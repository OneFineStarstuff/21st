import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { handleEmbedRequest, fetchFileContent } from "../_shared/embed-utils.ts"

const model = new Supabase.ai.Session("gte-small")

Deno.serve(async (req: Request) => {
  return handleEmbedRequest(req, async (connection, demoId, data) => {
    const [codeText, demoCodeText] = await Promise.all([
      fetchFileContent(data.code),
      fetchFileContent(data.demo_code),
    ])
    const text = `${data.name} ${data.demo_name} ${data.description} ${data.tags} ${codeText} ${demoCodeText}`
    const output = await model.run(text, { mean_pool: true, normalize: true })
    await connection.queryObject`
      UPDATE public.demos
      SET embedding = ${JSON.stringify(output)}
      WHERE id = ${demoId}
    `
  })
})
