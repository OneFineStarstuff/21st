import { NextResponse } from "next/server"
import { OpenAI } from "openai"
import { handleAuthenticatedRequest } from "@/lib/api-utils"
import { supabaseWithAdminAccess } from "@/lib/supabase"
import { standardizeAdditionalStyles } from "@/lib/studio-utils"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const MOCK_RESPONSE = {
  componentName: "ExampleComponent",
  registryType: "ui",
  dependencies: {
    lucide_react: "latest",
  },
  additionalStyles: {
    required: false,
    tailwindExtensions: {
      colors: {},
      animations: {},
    },
    cssVariables: [],
    keyframes: [],
    utilities: [],
  },
}

export async function POST(req: Request) {
  return handleAuthenticatedRequest(req, async (userId, body) => {
    if (!body || !body.code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }
    const { code } = body

    let result
    try {
      result = await preprocessComponent(code)
    } catch (error) {
      console.error("OpenAI API error:", error)
      result = MOCK_RESPONSE
    }

    const slug = makeSlugFromName(result.componentName)
    const isUnique = await checkSlugUnique(slug, userId)
    const finalSlug = isUnique ? slug : await generateUniqueSlug(slug, userId)

    return NextResponse.json({
      ...result,
      slug: finalSlug,
    })
  })
}

async function preprocessComponent(code: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a React code analyzer. Extract:
1. Component name
2. Registry type ('ui', 'hooks', 'blocks')
3. Dependencies
4. Tailwind styles (required, extensions, CSS variables, keyframes, utilities)
Format as JSON.`,
      },
      { role: "user", content: code },
    ],
    response_format: { type: "json_object" },
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error("No content from OpenAI")
  return standardizeAdditionalStyles(JSON.parse(content))
}

async function checkSlugUnique(slug: string, userId: string): Promise<boolean> {
  const { data } = await supabaseWithAdminAccess
    .from("components")
    .select("component_slug")
    .eq("component_slug", slug)
    .eq("user_id", userId)
    .maybeSingle()
  return !data
}

async function generateUniqueSlug(baseSlug: string, userId: string): Promise<string> {
  let counter = 1
  while (counter < 100) {
    const slug = `${baseSlug}-${counter}`
    if (await checkSlugUnique(slug, userId)) return slug
    counter++
  }
  return baseSlug
}

function makeSlugFromName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}
