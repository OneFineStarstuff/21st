import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts"

const databaseUrl = Deno.env.get("SUPABASE_DB_URL")
export const pool = new Pool(databaseUrl, 1, true)

export async function getDemoData(connection: any, demoId: string) {
  const result = await connection.queryObject`
   SELECT
    c.name,
    c.description,
    c.code,
    d.name AS demo_name,
    d.demo_code,
    string_agg(t.name, ', ') AS tags
    FROM public.demos AS d
    INNER JOIN public.components AS c
        ON d.component_id = c.id
    LEFT JOIN public.demo_tags AS dt
        ON d.id = dt.demo_id
    LEFT JOIN public.tags AS t
        ON dt.tag_id = t.id
    WHERE d.id = ${demoId}
    GROUP BY c.id, d.id;
  `
  return result.rows[0] as {
    name: string
    description: string
    code: string
    demo_name: string
    demo_code: string
    tags: string
  }
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
