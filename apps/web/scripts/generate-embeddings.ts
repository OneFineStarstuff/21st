import { createClient } from "@supabase/supabase-js"
import { Command } from "commander"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing Supabase environment variables")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const logger = {
  info: (msg: string) => console.log(`\x1b[34minfo\x1b[0m - ${msg}`),
  success: (msg: string) => console.log(`\x1b[32msuccess\x1b[0m - ${msg}`),
  warn: (msg: string) => console.log(`\x1b[33mwarn\x1b[0m - ${msg}`),
  error: (msg: string) => console.error(`\x1b[31merror\x1b[0m - ${msg}`),
  progress: (percent: number) => {
    const barLength = 20
    const filledLength = Math.round((barLength * percent) / 100)
    const bar = "█".repeat(filledLength) + "░".repeat(barLength - filledLength)
    process.stdout.write(`\r\x1b[34mprogress\x1b[0m - [${bar}] ${percent}%`)
    if (percent === 100) process.stdout.write("\n")
  },
  divider: () => console.log("─".repeat(50)),
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const checkEmbeddingsExist = async (itemId: number, itemType: "component" | "demo") => {
  const { data: codeEmbedding } = await supabase
    .from("code_embeddings")
    .select("id")
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle()

  const { data: usageEmbedding } = await supabase
    .from("usage_embeddings")
    .select("id")
    .eq("item_id", itemId)
    .eq("item_type", itemType)
    .maybeSingle()

  return {
    codeExists: !!codeEmbedding,
    usageExists: !!usageEmbedding,
  }
}

const processItem = async (
  item: any,
  itemType: "component" | "demo",
  type: "code" | "usage" | "both",
  force: boolean,
) => {
  const itemName = item.name || "Unnamed"
  logger.info(`[${type}] Processing ${itemType} ${itemName} (ID: ${item.id})...`)

  try {
    const { codeExists, usageExists } = await checkEmbeddingsExist(item.id, itemType)
    const shouldSkip = !force && (
      (type === "code" && codeExists) ||
      (type === "usage" && usageExists) ||
      (type === "both" && codeExists && usageExists)
    )

    if (shouldSkip) {
      logger.warn(`[${type}] Embeddings already exist for ${itemType} ${item.id}, skipping...`)
      return { success: true, skipped: true }
    }

    await sleep(500)
    const { data: response, error } = await supabase.functions.invoke("generate-embeddings", {
      body: { type: itemType, id: item.id },
    })

    if (error && (!error.message.includes("Failed to send a request") || !response)) {
      logger.error(`[${type}] Error for ${itemType} ${itemName}: ${error.message}`)
      await sleep(2000)
      return { success: false, skipped: false }
    }

    logger.success(`[${type}] Successfully generated embeddings for ${itemType} ${itemName}`)
    if (response?.data?.usage_description && type !== "code") {
      const preview = response.data.usage_description.substring(0, 200) + (response.data.usage_description.length > 200 ? "..." : "")
      logger.info(`[${type}] Generated description:\n${preview}`)
    }
    return { success: true, skipped: false }
  } catch (err: any) {
    logger.error(`[${type}] Exception for ${itemType} ${item.id}: ${err.message || String(err)}`)
    await sleep(2000)
    return { success: false, skipped: false }
  }
}

const generateEmbeddings = async (
  itemType: "component" | "demo",
  type: "code" | "usage" | "both",
  force: boolean = false,
) => {
  logger.info(`Starting ${itemType} ${type} embeddings generation...`)
  logger.divider()

  const table = itemType === "component" ? "components" : "demos"
  const { data: items, error } = await supabase.from(table).select("id, name").order("id")

  if (error) throw error
  if (!items || items.length === 0) {
    logger.warn(`No ${itemType}s found`)
    return
  }

  logger.info(`Found ${items.length} ${itemType}s to process`)
  let processed = 0, successes = 0, skipped = 0

  for (const item of items) {
    const result = await processItem(item, itemType, type, force)
    processed++
    if (result.success) successes++
    if (result.skipped) skipped++
    logger.progress(Math.floor((processed / items.length) * 100))
  }

  logger.divider()
  logger.success(`Completed ${itemType} ${type} generation. Success: ${successes}, Processed: ${processed}, Skipped: ${skipped}`)
}

const program = new Command()
program
  .name("generate-embeddings")
  .option("-t, --type <type>", "code, usage, both", "both")
  .option("-c, --components", "components")
  .option("-d, --demos", "demos")
  .option("-a, --all", "all")
  .option("-f, --force", "force")
  .parse(process.argv)

const options = program.opts()
if (!options.components && !options.demos && !options.all) {
  logger.error("Specify --components, --demos, or --all")
  process.exit(1)
}

const run = async () => {
  const embedType = options.type as any
  const force = options.force || false
  if (options.components || options.all) await generateEmbeddings("component", embedType, force)
  if (options.demos || options.all) await generateEmbeddings("demo", embedType, force)
  logger.success("All tasks completed!")
}

run()
