import { OpenAI } from "openai"
import { NextResponse } from "next/server"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function mergeStyles(params: {
  type: 'Global CSS' | 'Tailwind CSS',
  baseContent: string,
  dependencies: string[],
  systemPrompt: string,
  userPromptGenerator: (base: string, deps: string[]) => string,
  resultKey: 'globalCss' | 'tailwindConfig'
}) {
  const { type, baseContent, dependencies, systemPrompt, userPromptGenerator, resultKey } = params

  console.log(`🔄 [${type} Merge] Request received:`, {
    baseLength: baseContent?.length,
    depCount: dependencies?.length,
  })

  if (!dependencies?.length) {
    console.log(`⏩ [${type} Merge] No custom styles to merge, returning default`)
    return NextResponse.json({ [resultKey]: baseContent })
  }

  const prompt = userPromptGenerator(baseContent, dependencies)

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
    })

    const result = JSON.parse(completion.choices[0]?.message.content || "{}")

    if (result[resultKey] && typeof result[resultKey] !== "string") {
      result[resultKey] = JSON.stringify(result[resultKey], null, 2)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error(`❌ [${type} Merge] Error:`, error)
    return NextResponse.json({ error: `Failed to merge ${type}` }, { status: 500 })
  }
}
