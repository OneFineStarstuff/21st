import { pool, getDemoData } from "./database.ts"

export async function handleEmbedRequest(
  req: Request,
  embedLogic: (connection: any, demoId: string, data: any) => Promise<void>
) {
  const { demoId, record } = await req.json()
  const finalId = demoId ?? record?.id

  if (finalId) {
    EdgeRuntime.waitUntil((async () => {
      console.log(`Starting to embed demo ${finalId}`)
      const connection = await pool.connect()
      try {
        const data = await getDemoData(connection, finalId)
        await embedLogic(connection, finalId, data)
        console.log(`Successfully embedded demo ${finalId}`)
      } catch (err) {
        console.error(`Failed to embed demo ${finalId}:`, err)
      } finally {
        connection.release()
      }
    })())
  }

  return new Response("ok")
}

export async function fetchFileContent(url: string) {
  const res = await fetch(url)
  return await res.text()
}
