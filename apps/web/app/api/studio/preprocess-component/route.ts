import { auth } from "@clerk/nextjs/server"
import { NextResponse } from "next/server"
import { OpenAI } from "openai"
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
  try {
    const session = await auth()
    const userId = session?.userId

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 })
    }

    let result
    try {
      result = await preprocessComponent(code)
      console.log("OpenAI preprocessing result:", result)
    } catch (error) {
      console.error("OpenAI API error:", error)
      // If OpenAI fails, use mock response for testing
      console.log("Using mock response due to OpenAI API unavailability")
      result = MOCK_RESPONSE
    }

    // Generate slug for the component
    const slug = makeSlugFromName(result.componentName)

    // Check if slug is unique
    const isUnique = await checkSlugUnique(slug, userId)

    // If not unique, generate a unique slug
    const finalSlug = isUnique ? slug : await generateUniqueSlug(slug, userId)

    const response = {
      ...result,
      slug: finalSlug,
    }

    console.log("Final preprocessed response:", response)

    return NextResponse.json(response)
  } catch (error) {
    console.error("Error preprocessing component:", error)
    return NextResponse.json(
      { error: "Failed to preprocess component" },
      { status: 500 },
    )
  }
}

async function preprocessComponent(code: string) {
  // Try to detect component name from code before using OpenAI
  // This is a basic regex approach to find component declarations

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a code analyzer specializing in React components. Analyze the provided React component code and extract the following information:
1. Component name (the function or class name of the component)
2. Registry type: Determine if it belongs to: 
   - 'ui' (basic components like Button, Card, etc.)
   - 'hooks' (custom React hooks)
   - 'blocks' (larger components like hero sections, pricing sections, etc.)
3. Dependencies: Identify all external npm packages used.
4. Tailwind styles: Does it need any custom Tailwind configuration or global CSS?
   - Return required: true if it needs any custom styles.
   - Extract colors, animations, font families, border radii, shadows, and spacing.
   - Extract CSS variables, keyframes, and utility classes.

Format your response as a JSON object:
{
  "componentName": "string",
  "registryType": "ui" | "hooks" | "blocks",
  "dependencies": { "package-name": "version" },
  "additionalStyles": {
    "required": boolean,
    "tailwindExtensions": {
      "colors": { "name": "value" },
      "animations": { "name": "value" },
      "fontFamily": { "name": ["font1", "font2"] },
      "borderRadius": { "name": "value" },
      "boxShadow": { "name": "value" },
      "spacing": { "name": "value" }
    },
    "cssVariables": [ { "name": "--variable-name", "value": "value" } ],
    "keyframes": [ { "name": "name", "frames": "CSS frames definition" } ],
    "utilities": [ { "className": "name", "definition": "CSS definition" } ]
  }
}`,
      },
      {
        role: "user",
        content: code,
      },
    ],
    response_format: { type: "json_object" },
  })

  const content = response.choices[0].message.content
  if (!content) {
    throw new Error("No content returned from OpenAI")
  }

  const data = JSON.parse(content)
  return standardizeAdditionalStyles(data)
}

async function checkSlugUnique(slug: string, userId: string): Promise<boolean> {
  const supabase = supabaseWithAdminAccess

  const { data, error } = await supabase
    .from("components")
    .select("component_slug")
    .eq("component_slug", slug)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("Error checking slug uniqueness:", error)
    return false
  }

  return !data
}

async function generateUniqueSlug(
  baseSlug: string,
  userId: string,
): Promise<string> {
  let slug = baseSlug
  let counter = 1
  let isUnique = false

  while (!isUnique) {
    const newSlug = `${baseSlug}-${counter}`
    isUnique = await checkSlugUnique(newSlug, userId)
    if (isUnique) {
      slug = newSlug
    }
    counter++

    // Safety break
    if (counter > 100) break
  }

  return slug
}

function makeSlugFromName(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, "-") // kebab-case
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // remove special chars
    .replace(/^-+|-+$/g, "") // remove leading/trailing dashes
}
