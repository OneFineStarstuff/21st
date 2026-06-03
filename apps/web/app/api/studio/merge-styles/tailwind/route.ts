import { mergeStyles } from "@/lib/studio-merge"

export async function POST(request: Request) {
  const { defaultConfig, dependencyConfigs } = await request.json()

  return mergeStyles({
    type: 'Tailwind CSS',
    baseContent: defaultConfig,
    dependencies: dependencyConfigs,
    resultKey: 'tailwindConfig',
    systemPrompt: "You are a Tailwind CSS expert who helps merge and optimize configurations. Always include all content completely without summarizing or truncating. Never omit any configuration properties.",
    userPromptGenerator: (base, deps) => `You are a Tailwind CSS expert. Please merge the following Tailwind CSS configurations into a single optimized configuration.

Base Tailwind Config:
\`\`\`js
${base}
\`\`\`

${deps.map((config, i) => `Dependency ${i + 1} Tailwind Config:
\`\`\`js
${config}
\`\`\`
`).join("\n")}

Please provide a merged Tailwind config that combines all configurations efficiently and includes ALL original configuration without truncation.`
  })
}
